import "@typespec/http";

using TypeSpec.Http;

// --- Scalars ---

@doc("ISO 8601 weekday number: 1 = Monday, 7 = Sunday.")
scalar Weekday extends int32;

@doc("Time of day in HH:MM format (24-hour clock).")
scalar TimeString extends string;

// --- Domain models ---

model Calendar {
  id: int32;
  @doc("URL-friendly identifier, e.g. \"andrey-novosad\".")
  slug: string;
  name: string;
  @doc("IANA timezone name, e.g. \"Europe/Moscow\".")
  timezone: string;
  createdAt: utcDateTime;
}

model AvailabilityRule {
  id: int32;
  calendarId: int32;
  @doc("ISO weekdays when the rule applies.")
  weekdays: Weekday[];
  startTime: TimeString;
  endTime: TimeString;
}

model SlotDuration {
  id: int32;
  calendarId: int32;
  @doc("Duration in minutes, e.g. 15 or 30.")
  minutes: int32;
}

enum BookingStatus {
  confirmed: "confirmed",
  cancelled: "cancelled",
}

model Booking {
  id: int32;
  calendarId: int32;
  guestName: string;
  guestEmail: string;
  @doc("Optional note from the guest describing the meeting purpose.")
  note: string | null;
  startsAt: utcDateTime;
  endsAt: utcDateTime;
  status: BookingStatus;
  createdAt: utcDateTime;
}

// --- Request / response shapes ---

model CalendarPublicView {
  name: string;
  timezone: string;
  @doc("Available slot durations in minutes.")
  slotDurations: int32[];
}

model FreeSlot {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
  durationMinutes: int32;
}

model CreateBookingRequest {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
  guestName: string;
  guestEmail: string;
  @doc("Optional note from the guest.")
  note?: string;
}

model BookingConfirmation {
  booking: Booking;
}

model CalendarSummary {
  id: int32;
  slug: string;
  name: string;
  @doc("IANA timezone name, e.g. \"Europe/Moscow\".")
  timezone: string;
  createdAt: utcDateTime;
}

model CreateCalendarRequest {
  @doc("Human-readable display name, e.g. \"Andrey Novosad\".")
  name: string;
  @doc("URL-friendly identifier, e.g. \"andrey-novosad\". Only lowercase letters, digits and hyphens, 3–50 chars.")
  slug: string;
  @doc("IANA timezone name, e.g. \"Europe/Moscow\".")
  timezone: string;
}

model CalendarSettings {
  calendar: Calendar;
  availabilityRules: AvailabilityRule[];
  slotDurations: SlotDuration[];
}

model AvailabilityRuleInput {
  weekdays: Weekday[];
  startTime: TimeString;
  endTime: TimeString;
}

model UpdateAvailabilityRequest {
  @doc("Replaces all existing rules.")
  rules: AvailabilityRuleInput[];
}

model AddSlotDurationRequest {
  @doc("Duration in minutes, must be a positive multiple of 15.")
  minutes: int32;
}

// --- Errors ---

@error
model NotFoundError {
  @statusCode code: 404;
  message: string;
}

@error
model ConflictError {
  @statusCode code: 409;
  message: string;
}

@error
model ValidationError {
  @statusCode code: 422;
  message: string;
  details?: Record<string[]>;
}
