# Booking App

A web application for scheduling meetings. Calendar owners share their
availability; guests book time slots without creating an account.

## Architecture

Monorepo managed with **pnpm workspaces**:

| Package | Description |
| --- | --- |
| `packages/api-spec` | TypeSpec API contract → OpenAPI 3.0 |
| `apps/backend` | Fastify + Prisma + PostgreSQL _(coming soon)_ |
| `apps/frontend` | React + Mantine + Vite _(coming soon)_ |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript (full-stack) |
| API contract | TypeSpec → OpenAPI 3.0 |
| Backend | Fastify, Prisma ORM |
| Frontend | React, Mantine UI, Vite |
| Database | PostgreSQL |
| Package manager | pnpm workspaces |

## Domain Model

### Calendar

The central entity, identified by a URL-friendly `slug`
(e.g. `andrey-novosad`).

| URL | Who | Purpose |
| --- | --- | --- |
| `/:slug` | Guest | Browse availability, book a slot |
| `/:slug/manage` | Owner | Manage settings and bookings |

### AvailabilityRule

Defines when the owner accepts bookings: a set of weekdays and a time range.
Multiple rules are supported
(e.g. Mon–Fri 09:00–17:00 **and** Sat 10:00–14:00).
Default: weekdays (Mon–Fri), 09:00–17:00.

### SlotDuration

Duration options offered to guests, in minutes. Default: **15** and **30**.
The owner can add, edit, or remove options; values must be positive
multiples of 15.

### Booking

A confirmed reservation created by a guest. Contains:

- Guest name, email, and an optional note describing the meeting purpose.
- `startsAt` / `endsAt` stored as UTC timestamps.
- Status: `confirmed` or `cancelled`.

Overlap protection is enforced at the database level via a PostgreSQL
`EXCLUDE` constraint on `tstzrange(starts_at, ends_at, '[)')`, scoped per
calendar and excluding cancelled bookings.

## API

The full contract is defined in `packages/api-spec` using TypeSpec.
Run `pnpm build` inside that package to emit `openapi.yaml`.

### Public (guest, no auth)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/calendars/:slug` | Calendar info and available slot durations |
| `GET` | `/api/calendars/:slug/slots` | Free slots by duration and date range |
| `POST` | `/api/calendars/:slug/bookings` | Book a slot |

### Management (owner, no auth in current version)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/manage/:slug` | Calendar settings |
| `PATCH` | `/api/manage/:slug/availability` | Replace availability rules |
| `GET` | `/api/manage/:slug/slot-durations` | List slot durations |
| `POST` | `/api/manage/:slug/slot-durations` | Add a slot duration |
| `DELETE` | `/api/manage/:slug/slot-durations/:id` | Remove a slot duration |
| `GET` | `/api/manage/:slug/bookings` | List bookings (filterable by status) |
| `PATCH` | `/api/manage/:slug/bookings/:id/cancel` | Cancel a booking |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install dependencies

```sh
pnpm install
```

### Generate OpenAPI spec

```sh
cd packages/api-spec
pnpm build
# outputs packages/api-spec/openapi.yaml
```
