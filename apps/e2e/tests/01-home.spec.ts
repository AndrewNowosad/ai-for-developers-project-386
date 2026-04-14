import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('shows the Calendars heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calendars' })).toBeVisible();
  });

  test('creates a new calendar and redirects to manage page', async ({ page }) => {
    const slug = `pw-${Date.now()}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'New calendar' }).click();

    // Wait for the modal and its form to be fully interactive
    await expect(page.getByLabel('Name')).toBeVisible({ timeout: 5_000 });

    // Name auto-generates the slug, then we overwrite it for determinism.
    await page.getByLabel('Name').fill('Playwright Test Calendar');
    await page.getByLabel('Slug').fill(slug);

    await page.getByRole('button', { name: 'Create' }).click();

    // Should redirect to /:slug/manage
    await expect(page).toHaveURL(`/${slug}/manage`, { timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: 'Playwright Test Calendar' }),
    ).toBeVisible();
  });

  test('shows a validation error for a too-short slug', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New calendar' }).click();
    await expect(page.getByLabel('Name')).toBeVisible({ timeout: 5_000 });

    await page.getByLabel('Name').fill('X');
    await page.getByLabel('Slug').fill('ab'); // minimum is 3 chars

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText(/3–50 chars/)).toBeVisible();
  });

  test('shows Slug already taken error for a duplicate slug', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New calendar' }).click();
    await expect(page.getByLabel('Name')).toBeVisible({ timeout: 5_000 });

    await page.getByLabel('Name').fill('Duplicate');
    await page.getByLabel('Slug').fill('e2e-demo'); // already created by globalSetup

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Slug already taken')).toBeVisible();
  });

  test('new calendar appears in the calendars table', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('cell', { name: 'e2e-demo' }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
