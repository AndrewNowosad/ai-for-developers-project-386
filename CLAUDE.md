# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## Project Overview

A full-stack booking app where calendar owners define availability and guests
book time slots without accounts. Built as a pnpm monorepo with:

- `apps/backend` — Fastify + Prisma API server (TypeScript)
- `apps/frontend` — React + Mantine SPA, built with Vite (TypeScript)
- `apps/e2e` — Playwright end-to-end tests
- `packages/api-spec` — TypeSpec API contract → generates OpenAPI YAML

## Commands

### Root (from repo root)

```bash
pnpm install            # Install all workspace dependencies
pnpm build              # Build all packages
pnpm e2e                # Run Playwright E2E tests
pnpm docker:dev         # Build images + start full stack (db, backend, frontend)
pnpm docker:seed        # Seed demo calendar into running Docker DB
pnpm docker:logs        # Tail all container logs
pnpm docker:down        # Stop containers
pnpm docker:clean       # Stop containers + delete DB volume
```

### Backend (`apps/backend`)

```bash
pnpm dev                # Start dev server with tsx watch (requires local DB)
pnpm build              # Compile TypeScript → dist/
pnpm start              # Run production build
pnpm db:migrate         # Create + apply new Prisma migration (interactive)
pnpm db:deploy          # Apply pending migrations (non-interactive, production)
pnpm db:generate        # Regenerate Prisma client after schema changes
pnpm db:seed            # Run seed.ts to create demo calendar
```

### Frontend (`apps/frontend`)

```bash
pnpm dev                # Vite dev server; proxies /api → http://localhost:3000
pnpm dev:mock           # Vite dev server with MSW mocks (no backend required)
pnpm build              # Build static assets → dist/
pnpm test               # Run Vitest once
pnpm test:watch         # Run Vitest in watch mode
```

### E2E (`apps/e2e`)

```bash
pnpm test               # Run all Playwright tests (headless, 1 worker)
pnpm test:ui            # Playwright UI inspector
pnpm test:headed        # Run with browser visible
pnpm test:debug         # Debug mode
```

### API Spec (`packages/api-spec`)

```bash
pnpm build              # Compile TypeSpec → tsp-output/openapi.yaml
pnpm watch              # Rebuild on change
```

## Architecture

### API Contract

TypeSpec files in `packages/api-spec/` are the source of truth for the HTTP
API. Changes to the API shape should start here. The generated
`tsp-output/@typespec/openapi3/openapi.yaml` is committed and consumed by
the frontend.

**Route groups:**

- `GET|POST /api/manage` and `GET|PATCH|DELETE /api/manage/:slug/...` —
  owner management (no auth currently)
- `GET /api/calendars/:slug` — public calendar info + slot durations
- `GET /api/calendars/:slug/slots` — available slots
  (query: `duration`, `from`, `to`)
- `POST /api/calendars/:slug/bookings` — create booking

### Backend

Entry: `apps/backend/src/index.ts` → `server.ts`
(Fastify factory + CORS + routes).

- `src/routes/public.ts` — guest-facing endpoints
- `src/routes/manage.ts` — owner management endpoints
- `src/lib/slots.ts` — slot availability generation logic
- `src/db.ts` — Prisma singleton
- `src/seed.ts` — demo data seeder

**Key database constraint:** PostgreSQL `EXCLUDE USING gist` on `bookings`
prevents overlapping confirmed bookings per calendar. Requires `btree_gist`
extension. This is enforced at the DB level, not only in application code.

Required env vars: `DATABASE_URL` (PostgreSQL connection string), optional
`PORT` (default 3000), `HOST` (default 0.0.0.0).

### Frontend

Entry: `apps/frontend/src/main.tsx` — mounts React with React Query,
Mantine, and React Router.

- **Pages:** `HomePage` (`/`), `BookingPage` (`/:slug`),
  `ManagePage` (`/:slug/manage`)
- **API layer:** `src/api/client.ts` — React Query hooks
- **Mock mode:** MSW (`src/mocks/browser.ts`) intercepts API calls when
  `VITE_MOCK=true`; used by `pnpm dev:mock` and Vitest tests

In local dev, Vite proxies `/api` to `http://localhost:3000`. In production,
Nginx handles the same proxy. The `VITE_API_BASE_URL` env var is injected at
build time for Render deployments.

### E2E Tests

Playwright configured for 1 worker (sequential) to avoid DB race conditions.
`global-setup.ts` seeds a test calendar before each run. CI starts
`docker compose up -d db migrate backend` and health-checks it before
running tests.

### Database Migrations

Single Prisma migration in `apps/backend/prisma/migrations/`. After changing
`schema.prisma`, run `pnpm db:migrate` to create a new migration file. Never
hand-edit existing migration SQL.

### Deployment (Render.com)

`render.yaml` defines three services: PostgreSQL 16, a Node.js web service
(backend), and a static site (frontend). Backend build on Render runs
`pnpm deploy` (flat node_modules), generates Prisma client, then runs
`db:deploy`. All three are auto-deployed on push to `main`.
