import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const SLUG = 'e2e-demo';

// Reset availability to Mon–Fri 09:00–17:00 before each test so tests
// are independent of each other's side-effects.
test.beforeEach(async () => {
  const res = await fetch(`${BACKEND_URL}/api/manage/${SLUG}/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rules: [
        { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`beforeEach availability reset failed: ${res.status}`);
});

test.describe('Manage page – Availability tab', () => {
  test('shows the existing Mon–Fri rule on load', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await expect(page.getByRole('tab', { name: 'Availability' })).toBeVisible();

    // The Mon–Fri badges should all be visible in the rule card
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await expect(page.getByText(day).first()).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByText('09:00 – 17:00')).toBeVisible();
  });

  test('adds a new Saturday rule via the modal', async ({ page }) => {
    await page.goto(`/${SLUG}/manage`);
    await expect(page.getByText('09:00 – 17:00')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Add Rule' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Uncheck Mon–Fri and check only Sat
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await page.getByLabel(day).uncheck();
    }
    await page.getByLabel('Sat').check();

    // Set a different time window so the rule is visually distinct
    await page.getByLabel('Start time').fill('10:00');
    await page.getByLabel('End time').fill('14:00');

    // Scope to the dialog to avoid matching the "Add Rule" button in the background
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

    // Modal closes; new rule card is visible in the panel
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Sat')).toBeVisible();
    await expect(page.getByText('10:00 – 14:00')).toBeVisible();
  });

  test('saves availability changes and shows a success notification', async ({
    page,
  }) => {
    await page.goto(`/${SLUG}/manage`);
    await expect(page.getByText('09:00 – 17:00')).toBeVisible({ timeout: 10_000 });

    // Add a Saturday rule
    await page.getByRole('button', { name: 'Add Rule' }).click();
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await page.getByLabel(day).uncheck();
    }
    await page.getByLabel('Sat').check();
    await page.getByLabel('Start time').fill('10:00');
    await page.getByLabel('End time').fill('14:00');
    // Scope to the dialog to avoid matching the "Add Rule" button in the background
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Availability updated')).toBeVisible({ timeout: 10_000 });
  });

  test('removes a rule from the list before saving', async ({ page }) => {
    // Use API to set up two rules so we have something to remove
    await fetch(`${BACKEND_URL}/api/manage/${SLUG}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rules: [
          { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
          { weekdays: [6], startTime: '10:00', endTime: '14:00' },
        ],
      }),
    });

    await page.goto(`/${SLUG}/manage`);
    await expect(page.getByText('10:00 – 14:00')).toBeVisible({ timeout: 10_000 });

    // The rules are ordered Mon–Fri (index 0) then Sat (index 1).
    // Click the second "Remove rule" button to remove the Saturday rule.
    await page.getByRole('button', { name: 'Remove rule' }).nth(1).click();

    // The Saturday card disappears from the list immediately (local state)
    await expect(page.getByText('10:00 – 14:00')).not.toBeVisible();
    // The Mon–Fri rule should still be present
    await expect(page.getByText('09:00 – 17:00')).toBeVisible();
  });
});
