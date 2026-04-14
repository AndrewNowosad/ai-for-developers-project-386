import type { FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { prisma } from '../db.js';
import { generateFreeSlots } from '../lib/slots.js';

// ---- serialisers -------------------------------------------------------

function serializeBooking(b: {
  id: number;
  calendarId: number;
  guestName: string;
  guestEmail: string;
  note: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  createdAt: Date;
}) {
  return {
    id: b.id,
    calendarId: b.calendarId,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    note: b.note,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  };
}

function isConflictError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === 'P2002') return true;
  // PostgreSQL exclusion violation (23P01) surfaces via Prisma as P2010
  if (err.code === 'P2010') {
    const cause = err.meta?.cause;
    return typeof cause === 'string' && cause.includes('23P01');
  }
  return false;
}

// ---- routes ------------------------------------------------------------

export const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/calendars/:slug
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params;

    const calendar = await prisma.calendar.findUnique({
      where: { slug },
      include: { slotDurations: { orderBy: { minutes: 'asc' } } },
    });

    if (!calendar) {
      return reply.status(404).send({ code: 404, message: 'Calendar not found' });
    }

    return {
      name: calendar.name,
      timezone: calendar.timezone,
      slotDurations: calendar.slotDurations.map((sd) => sd.minutes),
    };
  });

  // GET /api/calendars/:slug/slots?duration=X&from=YYYY-MM-DD&to=YYYY-MM-DD
  fastify.get<{
    Params: { slug: string };
    Querystring: { duration?: string; from?: string; to?: string };
  }>('/:slug/slots', async (request, reply) => {
    const { slug } = request.params;

    const qSchema = z.object({
      duration: z
        .string({ required_error: 'duration is required' })
        .transform(Number)
        .pipe(z.number().int().positive()),
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
        .optional(),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
        .optional(),
    });

    const parsed = qSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(422).send({
        code: 422,
        message: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { duration, from, to } = parsed.data;

    if (from && to && from > to) {
      return reply.status(422).send({
        code: 422,
        message: 'Validation error',
        details: { to: ['"to" must be >= "from"'] },
      });
    }

    const calendar = await prisma.calendar.findUnique({
      where: { slug },
      include: { availabilityRules: true, slotDurations: true },
    });

    if (!calendar) {
      return reply.status(404).send({ code: 404, message: 'Calendar not found' });
    }

    const validDuration = calendar.slotDurations.some((sd) => sd.minutes === duration);
    if (!validDuration) {
      return reply.status(422).send({
        code: 422,
        message: 'Validation error',
        details: { duration: ['Not a valid slot duration for this calendar'] },
      });
    }

    const tz = calendar.timezone;
    const nowInTz = DateTime.now().setZone(tz);
    const effectiveFrom = from ?? nowInTz.toFormat('yyyy-MM-dd');
    const effectiveTo = to ?? nowInTz.plus({ days: 14 }).toFormat('yyyy-MM-dd');

    // Fetch only confirmed bookings that overlap with the requested window
    const windowStart = DateTime.fromISO(effectiveFrom, { zone: tz }).startOf('day').toJSDate();
    const windowEnd = DateTime.fromISO(effectiveTo, { zone: tz }).endOf('day').toJSDate();

    const bookings = await prisma.booking.findMany({
      where: {
        calendarId: calendar.id,
        status: 'confirmed',
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    return generateFreeSlots(
      calendar.availabilityRules,
      bookings,
      duration,
      effectiveFrom,
      effectiveTo,
      tz,
    );
  });

  // POST /api/calendars/:slug/bookings
  fastify.post<{
    Params: { slug: string };
    Body: unknown;
  }>('/:slug/bookings', async (request, reply) => {
    const { slug } = request.params;

    const bodySchema = z.object({
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      guestName: z.string().min(1),
      guestEmail: z.string().email(),
      note: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({
        code: 422,
        message: 'Validation error',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { startsAt, endsAt, guestName, guestEmail, note } = parsed.data;
    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(endsAt);

    if (endsAtDate <= startsAtDate) {
      return reply.status(422).send({
        code: 422,
        message: 'Validation error',
        details: { endsAt: ['endsAt must be after startsAt'] },
      });
    }

    const calendar = await prisma.calendar.findUnique({ where: { slug } });
    if (!calendar) {
      return reply.status(404).send({ code: 404, message: 'Calendar not found' });
    }

    // Application-level overlap check (DB EXCLUDE constraint is the safety net)
    const overlap = await prisma.booking.findFirst({
      where: {
        calendarId: calendar.id,
        status: 'confirmed',
        startsAt: { lt: endsAtDate },
        endsAt: { gt: startsAtDate },
      },
    });

    if (overlap) {
      return reply.status(409).send({ code: 409, message: 'Time slot is already booked' });
    }

    try {
      const booking = await prisma.booking.create({
        data: {
          calendarId: calendar.id,
          guestName,
          guestEmail,
          note: note ?? null,
          startsAt: startsAtDate,
          endsAt: endsAtDate,
          status: 'confirmed',
        },
      });

      return reply.status(201).send({ booking: serializeBooking(booking) });
    } catch (err) {
      if (isConflictError(err)) {
        return reply.status(409).send({ code: 409, message: 'Time slot is already booked' });
      }
      throw err;
    }
  });
};
