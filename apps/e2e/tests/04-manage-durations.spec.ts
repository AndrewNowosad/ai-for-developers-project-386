import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const SLUG = 'e2e-demo';

async function getDurations(): Promise<Array<{ id: number; minutes: number }>> {
  const res = await fetch(`${BACKEND_URL}/api/manage/${SLUG}/slot-durations`);
  return res.json();
}

// Reset slot durations to [15, 30] before each test
test.beforeEach(async () => {
  const target = [15, 30];
  const durations = await getDurations();

  // Add any missing
  for (const minutes of target) {
    if (!durations.some((d) => d.minutes === minutes)) {
      await fetch(`${BACKEND_URL}/api/manage/${SLUG}/slot-durations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
    }
  }

  // Remove extras (safe only when count > 1)
  const current = await getDurations();
  for (const d of current.filter((d) => !target.includes(d.minutes))) {
    const latest = await getDurations();
    if (latest.length > 1) {
      await fetch(`${BACKEND_URL}/api/manage/${SLUG}/slot-durations/${d.id}`, {
        method: 'DELETE',
      });
    }
  }
});

test.describe('Manage page – Slot Durations tab', () => {
  test('shows existing durations on load', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Slot Durations' }).click();

    await expect(page.getByText('15 minutes')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('30 minutes')).toBeVisible();
  });

  test('adds a new 45-minute duration', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Slot Durations' }).click();

    await expect(page.getByText('15 minutes')).toBeVisible({ timeout: 10_000 });

    // Clear the NumberInput and type 45
    const durationInput = page.getByLabel('New duration (minutes)');
    await durationInput.fill('45');

    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('45 minutes')).toBeVisible({ timeout: 10_000 });
  });

  test('removes a duration when its close button is clicked', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Slot Durations' }).click();

    await expect(page.getByText('30 minutes')).toBeVisible({ timeout: 10_000 });

    // Find the 30-min card and click its remove button
    const thirtyCard = page
      .locator('div')
      .filter({ hasText: /^30 minutes$/ })
      .filter({ has: page.getByRole('button', { name: 'Remove duration' }) })
      .first();

    await thirtyCard.getByRole('button', { name: 'Remove duration' }).click();

    await expect(page.getByText('30 minutes')).not.toBeVisible({ timeout: 5_000 });
    // The 15-min duration should still be present
    await expect(page.getByText('15 minutes')).toBeVisible();
  });

  test('shows an error notification when adding a duplicate duration', async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Slot Durations' }).click();

    await expect(page.getByText('15 minutes')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('New duration (minutes)').fill('15');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(
      page.getByText('This duration already exists'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Add button is disabled for non-multiples of 15', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await page.getByRole('tab', { name: 'Slot Durations' }).click();

    await page.getByLabel('New duration (minutes)').fill('20');

    await expect(page.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
