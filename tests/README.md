# Tests

- `npm run test:run` runs every Vitest suite (`tests/**/*.test.ts`).
- `tests/db`: the Drizzle migrations run against an in-process Postgres (PGlite) and are checked against `server/db/schema.ts`.
- `tests/security`: every handler under `server/api` is mounted on a real HTTP server, with real Better Auth sessions on PGlite. The suite checks that identity only ever comes from the session.
- `tests/e2e`: Playwright specs. Point `PLAYWRIGHT_TEST_BASE_URL` at a running app or a preview deployment.
