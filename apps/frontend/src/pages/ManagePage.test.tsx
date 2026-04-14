import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderPage } from '../test/utils';
import ManagePage from './ManagePage';

function render(slug = 'test') {
  return renderPage(<ManagePage />, '/:slug/manage', `/${slug}/manage`);
}

describe('ManagePage', () => {
  describe('loading states', () => {
    it('shows calendar name and timezone after load', async () => {
      render();
      await screen.findByText('Test Calendar');
      expect(screen.getByText('Timezone: UTC')).toBeInTheDocument();
    });

    it('shows error alert when calendar is not found', async () => {
      render('not-found');
      await screen.findByText('Not found');
    });
  });

  describe('Availability tab (default)', () => {
    it('renders all three tabs', async () => {
      render();
      await screen.findByText('Test Calendar');
      expect(screen.getByRole('tab', { name: 'Availability' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Slot Durations' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Bookings' })).toBeInTheDocument();
    });

    it('shows weekday badges and time range for each rule', async () => {
      render();
      await screen.findByText('09:00 – 17:00');
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
    });

    it('removes a rule when close button is clicked', async () => {
      const user = userEvent.setup();
      render();
      await screen.findByText('09:00 – 17:00');
      await user.click(screen.getByRole('button', { name: 'Remove rule' }));
      expect(screen.queryByText('09:00 – 17:00')).not.toBeInTheDocument();
    });

    it('opens "Add Rule" modal on button click', async () => {
      const user = userEvent.setup();
      render();
      await screen.findByText('Test Calendar');
      await user.click(screen.getByRole('button', { name: 'Add Rule' }));
      await screen.findByText('New availability rule');
    });

    it('saves updated rules without error', async () => {
      const user = userEvent.setup();
      render();
      await screen.findByText('Test Calendar');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      // On success, no error notification is shown
      await waitFor(() => {
        expect(screen.queryByText(/Failed to save/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Slot Durations tab', () => {
    async function openDurationsTab() {
      const user = userEvent.setup();
      render();
      await screen.findByText('Test Calendar');
      await user.click(screen.getByRole('tab', { name: 'Slot Durations' }));
      return user;
    }

    it('lists current slot durations', async () => {
      await openDurationsTab();
      await screen.findByText('15 minutes');
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
    });

    it('shows notification when adding a duplicate duration (409)', async () => {
      server.use(
        http.post('/api/manage/:slug/slot-durations', () =>
          HttpResponse.json({ message: 'Already exists' }, { status: 409 }),
        ),
      );
      const user = await openDurationsTab();
      await screen.findByText('15 minutes');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      await screen.findByText('This duration already exists');
    });

    it('shows notification when deleting the last duration (409)', async () => {
      server.use(
        http.delete('/api/manage/:slug/slot-durations/:id', () =>
          HttpResponse.json({ message: 'Last one' }, { status: 409 }),
        ),
      );
      const user = await openDurationsTab();
      await screen.findByText('15 minutes');
      const [closeBtn] = screen.getAllByRole('button', { name: 'Remove duration' });
      await user.click(closeBtn);
      await screen.findByText('Cannot remove the last slot duration');
    });
  });

  describe('Bookings tab', () => {
    async function openBookingsTab() {
      const user = userEvent.setup();
      render();
      await screen.findByText('Test Calendar');
      await user.click(screen.getByRole('tab', { name: 'Bookings' }));
      return user;
    }

    it('lists bookings with guest name and status', async () => {
      await openBookingsTab();
      await screen.findByText('Alice Smith');
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('confirmed')).toBeInTheDocument();
    });

    it('shows a cancel button for confirmed bookings', async () => {
      await openBookingsTab();
      await screen.findByText('Alice Smith');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('shows success notification after cancelling a booking', async () => {
      const user = await openBookingsTab();
      await screen.findByText('Alice Smith');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await screen.findByText('Booking cancelled');
    });

    it('shows "no bookings" when list is empty', async () => {
      server.use(
        http.get('/api/manage/:slug/bookings', () => HttpResponse.json([])),
      );
      await openBookingsTab();
      await screen.findByText('No bookings found.');
    });
  });
});
