# Tennis Match Platform

A platform for amateur tennis players in Ecuador to track matches, ratings and tournaments.

## Tech stack

- **Nuxt 4** (Vue, Nitro server routes), TypeScript
- **Neon Postgres** through **Drizzle ORM** (`server/db`)
- **Better Auth**: email and password, database sessions (`server/utils/auth.ts`)
- **Nuxt UI** and the design system in `assets/css/design-system.css`
- Hosted on **Vercel** (project `tennis-match`)

## Getting started

```bash
npm install
cp .env.example .env   # fill in the values
npm run db:migrate     # applies server/db/migrations to DATABASE_URL_UNPOOLED
npm run dev
```

Environment variables are listed in `.env.example`. The team keeps the real values in Infisical
(`/luis-factory/tennismatch`). Never point a local run at the Neon `main` branch.

## Database

- The schema lives in `server/db/schema.ts`. `npm run db:generate` writes a new migration after a schema change,
  and `npm run db:check` validates the migration history.
- `docs/schema-decisions.md` explains how the old Supabase SQL files were reconciled.

## Auth and authorisation

- The server takes identity only from the session: `requireUser`, `requireAdmin`, `requireOrganizer` and
  `requirePlayer` in `server/utils/session.ts`. Never read a user id from a request body, query or header.
- Roles (`player`, `admin`, `tournament_organizer`) live in `user.role`. Promote an admin with SQL on the
  intended branch: `update "user" set role = 'admin' where email = '...'`.

## Tests

```bash
npm run test:run          # all Vitest suites
npm run typecheck:server  # server-side TypeScript
npm run build
```

`tests/security` runs every API route against real sessions on an in-process Postgres. A new route must be
classified in `tests/security/route-access.ts`, or the suite fails.
