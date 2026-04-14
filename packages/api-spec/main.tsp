import "@typespec/http";
import "@typespec/openapi3";
import "./models.tsp";

using TypeSpec.Http;

@service({
  title: "Booking App API",
})
@server("http://localhost:3000", "Local")
namespace BookingApi;

// ---------------------------------------------------------------------------
// Public API — accessible to guests without authentication
// ---------------------------------------------------------------------------

@route("/api/calendars/{slug}")
interface PublicCalendars {
  @get
  @doc("Get calendar info and available slot durations.")
  get(@path slug: string): CalendarPublicView | NotFoundError;

  @get
  @route("/slots")
  @doc("""
    Return free time slots for the given duration within a date range.
    Both `from` and `to` are ISO 8601 dates (YYYY-MM-DD) in the calendar's timezone.
    Defaults to the next 14 days when omitted.
  """)
  getSlots(
    @path slug: string,
    @query @doc("Slot duration in minutes.") duration: int32,
    @query @doc("Start of the range, e.g. 2026-04-14.") from?: string,
    @query @doc("End of the range, e.g. 2026-04-28.") to?: string,
  ): FreeSlot[] | NotFoundError | ValidationError;

  @post
  @route("/bookings")
  @doc("Book a free time slot.")
  createBooking(
    @path slug: string,
    @body body: CreateBookingRequest,
  ): BookingConfirmation | NotFoundError | ConflictError | ValidationError;
}

// ---------------------------------------------------------------------------
// Owners API — list and create calendars (auth added later)
// ---------------------------------------------------------------------------

@route("/api/manage")
interface ManageOwners {
  @get
  @doc("List all calendars.")
  list(): CalendarSummary[];

  @post
  @doc("Create a new calendar. The slug must be unique.")
  create(@body body: CreateCalendarRequest): Calendar | ConflictError | ValidationError;
}

// ---------------------------------------------------------------------------
// Management API — accessible to the calendar owner (auth added later)
// ---------------------------------------------------------------------------

@route("/api/manage/{slug}")
interface ManageCalendars {
  @get
  @doc("Get full calendar settings: rules, slot durations.")
  get(@path slug: string): CalendarSettings | NotFoundError;

  @patch
  @route("/availability")
  @doc("Replace all availability rules with the provided set.")
  updateAvailability(
    @path slug: string,
    @body body: UpdateAvailabilityRequest,
  ): AvailabilityRule[] | NotFoundError | ValidationError;

  @get
  @route("/slot-durations")
  @doc("List all slot durations for this calendar.")
  listSlotDurations(@path slug: string): SlotDuration[] | NotFoundError;

  @post
  @route("/slot-durations")
  @doc("Add a new slot duration.")
  addSlotDuration(
    @path slug: string,
    @body body: AddSlotDurationRequest,
  ): SlotDuration | NotFoundError | ConflictError | ValidationError;

  @delete
  @route("/slot-durations/{id}")
  @doc("Remove a slot duration. Fails if it is the last remaining one.")
  deleteSlotDuration(
    @path slug: string,
    @path id: int32,
  ): NoContentResponse | NotFoundError | ConflictError;

  @get
  @route("/bookings")
  @doc("List bookings, optionally filtered by status.")
  listBookings(
    @path slug: string,
    @query status?: BookingStatus,
  ): Booking[] | NotFoundError;

  @patch
  @route("/bookings/{id}/cancel")
  @doc("Cancel a booking. Idempotent if already cancelled.")
  cancelBooking(
    @path slug: string,
    @path id: int32,
  ): Booking | NotFoundError;
}
