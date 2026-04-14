import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const SLUG = 'e2e-demo';

/** Returns the next Mon–Fri date starting from tomorrow. */
function nextWeekday(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Creates a confirmed booking at 09:00 UTC on the next weekday.
 *
 * Idempotency rules:
 * - 201: fresh booking created — the test owns it.
 * - 409: a confirmed booking already exists in that slot (from an earlier test
 *   in this file that did not cancel it). The test will find and work with it.
 * - If the slot holds a CANCELLED booking, the server creates a new confirmed
 *   one (cancelled bookings don't block new reservations).
 */
test.beforeEach(async () => {
  const dateStr = nextWeekday().toISOString().slice(0, 10);
  await fetch(`${BACKEND_URL}/api/calendars/${SLUG}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Use 10:00 so this doesn't conflict with the 09:00 slot booked by 02-booking tests
      startsAt: `${dateStr}T10:00:00Z`,
      endsAt: `${dateStr}T10:15:00Z`,
      guestName: 'E2E Test Guest',
      guestEmail: 'e2e-guest@example.com',
      note: 'Created by Playwright',
    }),
  });
  // Ignore the response status: both 201 (created) and 409 (already confirmed)
  // leave a confirmed booking present in the DB for the test to use.
});

test.describe('Manage page – Bookings tab', () => {
  test('shows the confirmed booking in the list', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Bookings' }).click();

    await expect(
      page.getByRole('cell', { name: 'E2E Test Guest' }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('cell', { name: 'e2e-guest@example.com' }).first(),
    ).toBeVisible();
  });

  test('cancels a confirmed booking', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Bookings' }).click();

    // The Cancel button is only rendered for confirmed bookings
    const cancelBtn = page
      .getByRole('row')
      .filter({ hasText: 'E2E Test Guest' })
      .getByRole('button', { name: 'Cancel' })
      .first();

    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // Success toast
    await expect(page.getByText('Booking cancelled')).toBeVisible({ timeout: 5_000 });

    // After data refetch, no Cancel button remains for E2E Test Guest rows
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'E2E Test Guest' })
        .getByRole('button', { name: 'Cancel' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('Confirmed filter shows only confirmed bookings', async ({ page }) => {
    // beforeEach ensures there is a confirmed booking in the DB
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Bookings' }).click();

    // Switch to the "Confirmed" filter.
    // Mantine v7 non-searchable Select does not expose role="combobox"; the
    // visible element is a readonly <input> — click it to open the dropdown.
    const statusSelect = page.locator('input[readonly]').first();
    await statusSelect.click();
    await page.getByRole('option', { name: 'Confirmed' }).click();

    // Our confirmed booking must appear
    await expect(
      page.getByRole('cell', { name: 'E2E Test Guest' }),
    ).toBeVisible({ timeout: 10_000 });

    // Every visible status badge should say "confirmed"
    const badges = page.locator('table tbody').getByText('confirmed');
    await expect(badges.first()).toBeVisible();
    await expect(page.locator('table tbody').getByText('cancelled')).not.toBeVisible();
  });
});
