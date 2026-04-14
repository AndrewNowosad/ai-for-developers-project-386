/**
 * Global setup: ensures the `e2e-demo` calendar exists in the DB with a
 * known availability schedule and slot durations before any test runs.
 *
 * Safe to run on a fresh DB (CI) and on an existing DB (local dev repeats).
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
export const E2E_SLUG = 'e2e-demo';

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}/api${path}`, init);
}

async function ensureCalendar(): Promise<void> {
  const res = await apiFetch('/manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: E2E_SLUG,
      name: 'E2E Demo Calendar',
      timezone: 'UTC',
    }),
  });

  if (res.status !== 201 && res.status !== 409) {
    throw new Error(
      `Failed to create calendar: HTTP ${res.status} – ${await res.text()}`,
    );
  }
}

async function resetAvailability(): Promise<void> {
  const res = await apiFetch(`/manage/${E2E_SLUG}/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rules: [
        { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to reset availability: HTTP ${res.status}`);
  }
}

async function resetSlotDurations(): Promise<void> {
  const target = [15, 30];

  // Add any missing target durations (ignore 409 – already exists)
  for (const minutes of target) {
    await apiFetch(`/manage/${E2E_SLUG}/slot-durations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes }),
    });
  }

  // Remove any extra durations not in the target list
  // Re-fetch after additions so we have up-to-date IDs
  const listRes = await apiFetch(`/manage/${E2E_SLUG}/slot-durations`);
  const all: Array<{ id: number; minutes: number }> = await listRes.json();
  const extras = all.filter((d) => !target.includes(d.minutes));

  for (const d of extras) {
    const countRes = await apiFetch(`/manage/${E2E_SLUG}/slot-durations`);
    const current: Array<unknown> = await countRes.json();
    if (current.length > 1) {
      await apiFetch(`/manage/${E2E_SLUG}/slot-durations/${d.id}`, {
        method: 'DELETE',
      });
    }
  }
}

export default async function globalSetup(): Promise<void> {
  console.log('[e2e setup] Seeding e2e-demo calendar…');
  await ensureCalendar();
  await resetAvailability();
  await resetSlotDurations();
  console.log('[e2e setup] Done.');
}
