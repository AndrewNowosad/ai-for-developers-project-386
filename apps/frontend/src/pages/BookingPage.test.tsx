import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderPage } from '../test/utils';
import BookingPage from './BookingPage';

function render(slug = 'test') {
  return renderPage(<BookingPage />, '/:slug', `/${slug}`);
}

// Clicks the first available time slot and waits for the booking modal to appear.
async function openBookingModal() {
  const user = userEvent.setup();
  render();
  await screen.findByText('Test Calendar');
  const [firstSlot] = await screen.findAllByRole('button', {
    name: /^\d{2}:\d{2}$/,
  });
  await user.click(firstSlot);
  // Wait for Mantine Modal transition to complete
  await screen.findByText('Book your appointment');
  return user;
}

describe('BookingPage', () => {
  describe('loading states', () => {
    it('shows calendar name and timezone after load', async () => {
      render();
      await screen.findByText('Test Calendar');
      expect(screen.getByText('Timezone: UTC')).toBeInTheDocument();
    });

    it('shows error alert when calendar is not found', async () => {
      render('not-found');
      await screen.findByText('Calendar not found');
    });
  });

  describe('duration selector', () => {
    it('renders a button for each available duration', async () => {
      render();
      await screen.findByText('Test Calendar');
      expect(screen.getByRole('button', { name: '15 min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '30 min' })).toBeInTheDocument();
    });

    it('auto-selects the first duration on load', async () => {
      render();
      await screen.findByText('Test Calendar');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '15 min' })).toHaveAttribute(
          'data-variant',
          'filled',
        );
      });
    });

    it('switches selection when another duration is clicked', async () => {
      const user = userEvent.setup();
      render();
      await screen.findByText('Test Calendar');
      await user.click(screen.getByRole('button', { name: '30 min' }));
      expect(screen.getByRole('button', { name: '30 min' })).toHaveAttribute(
        'data-variant',
        'filled',
      );
      expect(screen.getByRole('button', { name: '15 min' })).toHaveAttribute(
        'data-variant',
        'outline',
      );
    });
  });

  describe('slot picker', () => {
    it('shows available time slots after load', async () => {
      render();
      await screen.findByText('Test Calendar');
      // Mock returns 2 slots (09:00 and 10:00 UTC)
      const timeButtons = await screen.findAllByRole('button', {
        name: /^\d{2}:\d{2}$/,
      });
      expect(timeButtons.length).toBe(2);
    });

    it('shows "no slots" message when API returns empty array', async () => {
      server.use(
        http.get('/api/calendars/:slug/slots', () => HttpResponse.json([])),
      );
      render();
      await screen.findByText('Test Calendar');
      await screen.findByText('No available slots for this date.');
    });
  });

  describe('booking flow', () => {
    it('opens modal when a slot is clicked', async () => {
      await openBookingModal();
      expect(screen.getByText('Book your appointment')).toBeInTheDocument();
    });

    it('modal contains name, email, and note fields', async () => {
      await openBookingModal();
      expect(screen.getByLabelText(/Your name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Note/)).toBeInTheDocument();
    });

    it('shows validation errors when submitted empty', async () => {
      const user = await openBookingModal();
      await user.click(screen.getByRole('button', { name: /Confirm booking/ }));
      await screen.findByText('Name is required');
    });

    it('shows confirmation screen after successful booking', async () => {
      const user = await openBookingModal();
      await user.type(screen.getByLabelText(/Your name/), 'Jane Doe');
      await user.type(screen.getByLabelText(/Email/), 'jane@example.com');
      await user.click(screen.getByRole('button', { name: /Confirm booking/ }));
      await screen.findByText('Booking Confirmed');
    });

    it('shows conflict notification when slot is taken (409)', async () => {
      server.use(
        http.post('/api/calendars/:slug/bookings', () =>
          HttpResponse.json({ message: 'Slot taken' }, { status: 409 }),
        ),
      );
      const user = await openBookingModal();
      await user.type(screen.getByLabelText(/Your name/), 'Jane Doe');
      await user.type(screen.getByLabelText(/Email/), 'jane@example.com');
      await user.click(screen.getByRole('button', { name: /Confirm booking/ }));
      await screen.findByText('Slot no longer available');
    });
  });
});
