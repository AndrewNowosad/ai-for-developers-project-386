import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

// ---- serialisers -------------------------------------------------------

function serializeCalendar(c: {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  createdAt: Date;
}) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

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

// ---- routes ------------------------------------------------------------

export const manageRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/manage/:slug
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params;

    const calendar = await prisma.calendar.findUnique({
      where: { slug },
      include: {
        availabilityRules: true,
        slotDurations: { orderBy: { minutes: 'asc' } },
      },
    });

    if (!calendar) {
      return reply.status(404).send({ code: 404, message: 'Calendar not found' });
    }

    return {
      calendar: serializeCalendar(calendar),
      availabilityRules: calendar.availabilityRules,
      slotDurations: calendar.slotDurations,
    };
  });

  // PATCH /api/manage/:slug/availability
  fastify.patch<{ Params: { slug: string }; Body: unknown }>(
    '/:slug/availability',
    async (request, reply) => {
      const { slug } = request.params;

      const bodySchema = z.object({
        rules: z.array(
          z.object({
            weekdays: z
              .array(z.number().int().min(1).max(7))
              .min(1, 'At least one weekday required'),
            startTime: z.string().regex(/^\d{2}:\d{2}$/, 'must be HH:MM'),
            endTime: z.string().regex(/^\d{2}:\d{2}$/, 'must be HH:MM'),
          }),
        ),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({
          code: 422,
          message: 'Validation error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const calendar = await prisma.calendar.findUnique({ where: { slug } });
      if (!calendar) {
        return reply.status(404).send({ code: 404, message: 'Calendar not found' });
      }

      const rules = await prisma.$transaction(async (tx) => {
        await tx.availabilityRule.deleteMany({ where: { calendarId: calendar.id } });
        await tx.availabilityRule.createMany({
          data: parsed.data.rules.map((r) => ({
            calendarId: calendar.id,
            weekdays: r.weekdays,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        });
        return tx.availabilityRule.findMany({ where: { calendarId: calendar.id } });
      });

      return rules;
    },
  );

  // GET /api/manage/:slug/slot-durations
  fastify.get<{ Params: { slug: string } }>('/:slug/slot-durations', async (request, reply) => {
    const { slug } = request.params;

    const calendar = await prisma.calendar.findUnique({ where: { slug } });
    if (!calendar) {
      return reply.status(404).send({ code: 404, message: 'Calendar not found' });
    }

    const durations = await prisma.slotDuration.findMany({
      where: { calendarId: calendar.id },
      orderBy: { minutes: 'asc' },
    });

    return durations;
  });

  // POST /api/manage/:slug/slot-durations
  fastify.post<{ Params: { slug: string }; Body: unknown }>(
    '/:slug/slot-durations',
    async (request, reply) => {
      const { slug } = request.params;

      const bodySchema = z.object({
        minutes: z
          .number({ invalid_type_error: 'minutes must be a number' })
          .int()
          .positive()
          .refine((n) => n % 15 === 0, { message: 'must be a positive multiple of 15' }),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({
          code: 422,
          message: 'Validation error',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const calendar = await prisma.calendar.findUnique({ where: { slug } });
      if (!calendar) {
        return reply.status(404).send({ code: 404, message: 'Calendar not found' });
      }

      const existing = await prisma.slotDuration.findUnique({
        where: { calendarId_minutes: { calendarId: calendar.id, minutes: parsed.data.minutes } },
      });
      if (existing) {
        return reply.status(409).send({ code: 409, message: 'Slot duration already exists' });
      }

      const duration = await prisma.slotDuration.create({
        data: { calendarId: calendar.id, minutes: parsed.data.minutes },
      });

      return reply.status(201).send(duration);
    },
  );

  // DELETE /api/manage/:slug/slot-durations/:id
  fastify.delete<{ Params: { slug: string; id: string } }>(
    '/:slug/slot-durations/:id',
    async (request, reply) => {
      const { slug, id: idStr } = request.params;
      const id = Number(idStr);

      if (!Number.isInteger(id) || id < 1) {
        return reply.status(404).send({ code: 404, message: 'Slot duration not found' });
      }

      const calendar = await prisma.calendar.findUnique({ where: { slug } });
      if (!calendar) {
        return reply.status(404).send({ code: 404, message: 'Calendar not found' });
      }

      const duration = await prisma.slotDuration.findFirst({
        where: { id, calendarId: calendar.id },
      });
      if (!duration) {
        return reply.status(404).send({ code: 404, message: 'Slot duration not found' });
      }

      const count = await prisma.slotDuration.count({ where: { calendarId: calendar.id } });
      if (count <= 1) {
        return reply.status(409).send({ code: 409, message: 'Cannot remove the last slot duration' });
      }

      await prisma.slotDuration.delete({ where: { id } });

      return reply.status(204).send();
    },
  );

  // GET /api/manage/:slug/bookings?status=confirmed|cancelled
  fastify.get<{ Params: { slug: string }; Querystring: { status?: string } }>(
    '/:slug/bookings',
    async (request, reply) => {
      const { slug } = request.params;
      const { status } = request.query;

      const calendar = await prisma.calendar.findUnique({ where: { slug } });
      if (!calendar) {
        return reply.status(404).send({ code: 404, message: 'Calendar not found' });
      }

      const bookings = await prisma.booking.findMany({
        where: {
          calendarId: calendar.id,
          ...(status === 'confirmed' || status === 'cancelled' ? { status } : {}),
        },
        orderBy: { startsAt: 'asc' },
      });

      return bookings.map(serializeBooking);
    },
  );

  // PATCH /api/manage/:slug/bookings/:id/cancel
  fastify.patch<{ Params: { slug: string; id: string } }>(
    '/:slug/bookings/:id/cancel',
    async (request, reply) => {
      const { slug, id: idStr } = request.params;
      const id = Number(idStr);

      if (!Number.isInteger(id) || id < 1) {
        return reply.status(404).send({ code: 404, message: 'Booking not found' });
      }

      const calendar = await prisma.calendar.findUnique({ where: { slug } });
      if (!calendar) {
        return reply.status(404).send({ code: 404, message: 'Calendar not found' });
      }

      const booking = await prisma.booking.findFirst({
        where: { id, calendarId: calendar.id },
      });
      if (!booking) {
        return reply.status(404).send({ code: 404, message: 'Booking not found' });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      return serializeBooking(updated);
    },
  );
};
