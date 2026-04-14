import { test, expect } from '@playwright/test';

/**
 * Returns the next weekday (Mon–Fri) starting from tomorrow, along with
 * whether it falls in the next calendar month relative to today.
 */
function nextWeekday(): { date: Date; needsNextMonth: boolean } {
  const today = new Date();
  const target = new Date(today);
  target.setDate(today.getDate() + 1);
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }
  return {
    date: target,
    needsNextMonth: target.getMonth() !== today.getMonth(),
  };
}

/**
 * Formats a Date as "D MMMM YYYY" (e.g. "15 April 2026") which matches
 * the aria-label format Mantine v7 DatePicker sets on each day button.
 */
function dayAriaLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

test.describe('Booking page – guest books a slot', () => {
  test('shows calendar name and timezone after load', async ({ page }) => {
    await page.goto('/e2e-demo');
    await expect(
      page.getByRole('heading', { name: 'E2E Demo Calendar' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Timezone: UTC')).toBeVisible();
  });

  test('auto-selects the first duration (15 min) on load', async ({ page }) => {
    await page.goto('/e2e-demo');
    await expect(page.getByRole('heading', { name: 'E2E Demo Calendar' })).toBeVisible();

    // Mantine Button sets data-variant="filled" when active
    await expect(page.getByRole('button', { name: '15 min' })).toHaveAttribute(
      'data-variant',
      'filled',
      { timeout: 5_000 },
    );
  });

  test('switches duration when another button is clicked', async ({ page }) => {
    await page.goto('/e2e-demo');
    await expect(page.getByRole('heading', { name: 'E2E Demo Calendar' })).toBeVisible();

    await page.getByRole('button', { name: '30 min' }).click();
    await expect(page.getByRole('button', { name: '30 min' })).toHaveAttribute(
      'data-variant',
      'filled',
    );
    await expect(page.getByRole('button', { name: '15 min' })).toHaveAttribute(
      'data-variant',
      'outline',
    );
  });

  test('shows available time slots for a weekday date', async ({ page }) => {
    const { needsNextMonth } = nextWeekday();

    await page.goto('/e2e-demo');
    await expect(page.getByRole('heading', { name: 'E2E Demo Calendar' })).toBeVisible();

    // Navigate to next month in the DatePicker if the target date is there
    if (needsNextMonth) {
      await page.locator('[data-direction="next"]').click();
    }

    await page.getByRole('button', { name: dayAriaLabel(nextWeekday().date) }).click();

    // Slots load (e2e-demo is Mon–Fri 09:00–17:00 UTC with 15-min durations)
    await expect(
      page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const slotButtons = page.getByRole('button', { name: /^\d{2}:\d{2}$/ });
    await expect(slotButtons).not.toHaveCount(0);
  });

  test('shows "no slots" message when date has no availability', async ({ page }) => {
    await page.goto('/e2e-demo');
    await expect(page.getByRole('heading', { name: 'E2E Demo Calendar' })).toBeVisible();

    // Find next Saturday (no availability defined for weekends)
    const today = new Date();
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7));

    if (saturday.getMonth() !== today.getMonth()) {
      await page.locator('[data-direction="next"]').click();
    }
    await page.getByRole('button', { name: dayAriaLabel(saturday) }).click();

    await expect(
      page.getByText('No available slots for this date.'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('completes the full booking flow', async ({ page }) => {
    const { date, needsNextMonth } = nextWeekday();

    await page.goto('/e2e-demo');
    await expect(page.getByRole('heading', { name: 'E2E Demo Calendar' })).toBeVisible();

    if (needsNextMonth) {
      await page.locator('[data-direction="next"]').click();
    }
    await page.getByRole('button', { name: dayAriaLabel(date) }).click();

    // Wait for time slots to appear and click the first available (non-disabled) one
    await expect(
      page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
    const firstSlot = page
      .getByRole('button', { name: /^\d{2}:\d{2}$/, disabled: false })
      .first();
    await firstSlot.click();

    // Booking modal opens
    await expect(page.getByText('Book your appointment')).toBeVisible();

    // Fill the booking form
    await page.getByLabel('Your name').fill('E2E Booking User');
    await page.getByLabel('Email').fill('e2e-booking@example.com');
    await page.getByLabel('Note (optional)').fill('Playwright integration test');

    await page.getByRole('button', { name: 'Confirm booking' }).click();

    // Confirmation screen
    await expect(
      page.getByRole('heading', { name: 'Booking Confirmed' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows validation errors when booking form is submitted empty', async ({
    page,
  }) => {
    const { date, needsNextMonth } = nextWeekday();

    await page.goto('/e2e-demo');
    await expect(page.getByRole('heading', { name: 'E2E Demo Calendar' })).toBeVisible();

    if (needsNextMonth) {
      await page.locator('[data-direction="next"]').click();
    }
    await page.getByRole('button', { name: dayAriaLabel(date) }).click();

    // Wait for slots to load; skip any disabled ones (booked by a prior test)
    await expect(
      page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
    const firstAvailableSlot = page
      .getByRole('button', { name: /^\d{2}:\d{2}$/, disabled: false })
      .first();
    await firstAvailableSlot.click();

    await expect(page.getByText('Book your appointment')).toBeVisible();

    // Submit without filling anything
    await page.getByRole('button', { name: 'Confirm booking' }).click();

    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('shows an error for unknown calendar slug', async ({ page }) => {
    await page.goto('/no-such-calendar-xyz');
    await expect(page.getByText('Calendar not found')).toBeVisible({ timeout: 10_000 });
  });
});
