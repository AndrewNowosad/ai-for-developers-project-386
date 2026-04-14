import { DateTime } from 'luxon';

interface Rule {
  weekdays: number[];
  startTime: string;
  endTime: string;
}

interface BookingWindow {
  startsAt: Date;
  endsAt: Date;
}

export interface FreeSlot {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}

/**
 * Generate free time slots for a given date range in the calendar's timezone.
 *
 * @param rules       Availability rules (weekdays + time range).
 * @param bookings    Existing confirmed bookings to exclude.
 * @param duration    Slot duration in minutes.
 * @param fromDate    Start date, "YYYY-MM-DD", in the calendar's timezone.
 * @param toDate      End date, "YYYY-MM-DD", in the calendar's timezone.
 * @param timezone    IANA timezone name, e.g. "Europe/Moscow".
 */
export function generateFreeSlots(
  rules: Rule[],
  bookings: BookingWindow[],
  duration: number,
  fromDate: string,
  toDate: string,
  timezone: string,
): FreeSlot[] {
  // Pre-compute booked intervals as ms timestamps for fast overlap checks
  const bookedMs = bookings.map((b) => ({
    start: b.startsAt.getTime(),
    end: b.endsAt.getTime(),
  }));

  const nowMs = Date.now();
  const slots: FreeSlot[] = [];

  let day = DateTime.fromISO(fromDate, { zone: timezone }).startOf('day');
  const lastDay = DateTime.fromISO(toDate, { zone: timezone }).startOf('day');

  while (day <= lastDay) {
    const weekday = day.weekday; // 1 = Monday … 7 = Sunday (ISO 8601)

    for (const rule of rules.filter((r) => r.weekdays.includes(weekday))) {
      slots.push(...slotsForRule(day, rule, duration, nowMs, bookedMs));
    }

    day = day.plus({ days: 1 });
  }

  return slots;
}

type BookedMs = { start: number; end: number };

function slotsForRule(
  day: DateTime,
  rule: Rule,
  duration: number,
  nowMs: number,
  bookedMs: BookedMs[],
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  const [sh, sm] = rule.startTime.split(':').map(Number);
  const [eh, em] = rule.endTime.split(':').map(Number);

  let slotStart = day.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const windowEnd = day.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
  let slotEnd = slotStart.plus({ minutes: duration });

  while (slotEnd <= windowEnd) {
    const startMs = slotStart.toMillis();
    const endMs = slotEnd.toMillis();
    const isFree =
      endMs > nowMs && !bookedMs.some((b) => startMs < b.end && endMs > b.start);

    if (isFree) {
      slots.push({
        startsAt: slotStart.toUTC().toISO()!,
        endsAt: slotEnd.toUTC().toISO()!,
        durationMinutes: duration,
      });
    }

    slotStart = slotEnd;
    slotEnd = slotStart.plus({ minutes: duration });
  }

  return slots;
}
