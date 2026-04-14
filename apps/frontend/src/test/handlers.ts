import { http, HttpResponse } from 'msw';
import type {
  CalendarPublicView,
  Slot,
  CalendarSettings,
  Booking,
  BookingConfirmation,
} from '../api/client';

export const mockCalendar: CalendarPublicView = {
  name: 'Test Calendar',
  timezone: 'UTC',
  slotDurations: [15, 30],
};

export const mockSettings: CalendarSettings = {
  calendar: {
    id: 1,
    slug: 'test',
    name: 'Test Calendar',
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00Z',
  },
  availabilityRules: [
    {
      id: 1,
      calendarId: 1,
      weekdays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00',
    },
  ],
  slotDurations: [
    { id: 1, calendarId: 1, minutes: 15 },
    { id: 2, calendarId: 1, minutes: 30 },
  ],
};

export const mockSlots: Slot[] = [
  {
    startsAt: '2026-04-14T09:00:00Z',
    endsAt: '2026-04-14T09:30:00Z',
    durationMinutes: 30,
    available: false,
  },
  {
    startsAt: '2026-04-14T10:00:00Z',
    endsAt: '2026-04-14T10:30:00Z',
    durationMinutes: 30,
    available: true,
  },
];

export const mockBookings: Booking[] = [
  {
    id: 1,
    calendarId: 1,
    guestName: 'Alice Smith',
    guestEmail: 'alice@example.com',
    note: 'Project discussion',
    startsAt: '2026-04-14T09:00:00Z',
    endsAt: '2026-04-14T09:30:00Z',
    status: 'confirmed',
    createdAt: '2026-04-13T12:00:00Z',
  },
];

export const mockBookingConfirmation: BookingConfirmation = {
  booking: {
    id: 2,
    calendarId: 1,
    guestName: 'Jane Doe',
    guestEmail: 'jane@example.com',
    note: null,
    startsAt: '2026-04-14T09:00:00Z',
    endsAt: '2026-04-14T09:30:00Z',
    status: 'confirmed',
    createdAt: '2026-04-14T08:00:00Z',
  },
};

export const handlers = [
  http.get('/api/calendars/:slug', ({ params }) => {
    if (params.slug === 'not-found') {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(mockCalendar);
  }),

  http.get('/api/calendars/:slug/slots', () =>
    HttpResponse.json(mockSlots),
  ),

  http.post('/api/calendars/:slug/bookings', () =>
    HttpResponse.json(mockBookingConfirmation),
  ),

  http.get('/api/manage/:slug', ({ params }) => {
    if (params.slug === 'not-found') {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(mockSettings);
  }),

  http.get('/api/manage/:slug/bookings', () =>
    HttpResponse.json(mockBookings),
  ),

  http.get('/api/manage/:slug/slot-durations', () =>
    HttpResponse.json(mockSettings.slotDurations),
  ),

  http.patch('/api/manage/:slug/availability', () =>
    HttpResponse.json(mockSettings.availabilityRules),
  ),

  http.post('/api/manage/:slug/slot-durations', () =>
    HttpResponse.json({ id: 3, calendarId: 1, minutes: 45 }),
  ),

  http.delete('/api/manage/:slug/slot-durations/:id', () =>
    new HttpResponse(null, { status: 204 }),
  ),

  http.patch('/api/manage/:slug/bookings/:id/cancel', () =>
    HttpResponse.json({ ...mockBookings[0], status: 'cancelled' }),
  ),
];
