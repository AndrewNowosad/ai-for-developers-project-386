// Types derived from OpenAPI spec (packages/api-spec)

export type BookingStatus = 'confirmed' | 'cancelled';

export interface CalendarPublicView {
  name: string;
  timezone: string;
  slotDurations: number[];
}

export interface FreeSlot {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}

export interface CreateBookingRequest {
  startsAt: string;
  endsAt: string;
  guestName: string;
  guestEmail: string;
  note?: string;
}

export interface Booking {
  id: number;
  calendarId: number;
  guestName: string;
  guestEmail: string;
  note: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  createdAt: string;
}

export interface BookingConfirmation {
  booking: Booking;
}

export interface AvailabilityRule {
  id: number;
  calendarId: number;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export interface AvailabilityRuleInput {
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export interface SlotDuration {
  id: number;
  calendarId: number;
  minutes: number;
}

export interface Calendar {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface CalendarSummary {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface CreateCalendarRequest {
  name: string;
  slug: string;
  timezone: string;
}

export interface CalendarSettings {
  calendar: Calendar;
  availabilityRules: AvailabilityRule[];
  slotDurations: SlotDuration[];
}

export interface UpdateAvailabilityRequest {
  rules?: AvailabilityRuleInput[];
}

export interface AddSlotDurationRequest {
  minutes: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  // Public
  getCalendar: (slug: string) =>
    request<CalendarPublicView>(`${BASE}/calendars/${slug}`),

  getSlots: (slug: string, duration: number, from?: string, to?: string) => {
    const params = new URLSearchParams({ duration: String(duration) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return request<FreeSlot[]>(`${BASE}/calendars/${slug}/slots?${params}`);
  },

  createBooking: (slug: string, data: CreateBookingRequest) =>
    request<BookingConfirmation>(`${BASE}/calendars/${slug}/bookings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Owners
  listCalendars: () =>
    request<CalendarSummary[]>(`${BASE}/manage`),

  createCalendar: (data: CreateCalendarRequest) =>
    request<Calendar>(`${BASE}/manage`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Management
  getCalendarSettings: (slug: string) =>
    request<CalendarSettings>(`${BASE}/manage/${slug}`),

  updateAvailability: (slug: string, data: UpdateAvailabilityRequest) =>
    request<AvailabilityRule[]>(`${BASE}/manage/${slug}/availability`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  listSlotDurations: (slug: string) =>
    request<SlotDuration[]>(`${BASE}/manage/${slug}/slot-durations`),

  addSlotDuration: (slug: string, data: AddSlotDurationRequest) =>
    request<SlotDuration>(`${BASE}/manage/${slug}/slot-durations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSlotDuration: (slug: string, id: number) =>
    request<void>(`${BASE}/manage/${slug}/slot-durations/${id}`, {
      method: 'DELETE',
    }),

  listBookings: (slug: string, status?: BookingStatus) => {
    const qs = status ? `?status=${status}` : '';
    return request<Booking[]>(`${BASE}/manage/${slug}/bookings${qs}`);
  },

  cancelBooking: (slug: string, id: number) =>
    request<Booking>(`${BASE}/manage/${slug}/bookings/${id}/cancel`, {
      method: 'PATCH',
    }),
};
