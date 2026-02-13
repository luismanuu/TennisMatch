# Configuration

This project uses environment variables for Clerk (auth), Supabase (DB), and optional LLM features.

## Quick start

1. Copy `.env.example` to `.env`
2. Fill in the required values
3. Start the app (`pnpm dev`)

The server runs **startup validation** (see `server/utils/env-validation.ts`). If required variables are missing/invalid, the app fails fast with a clear error.

## Required environment variables (local dev)

### Supabase

- `SUPABASE_URL`: your Supabase project URL (must be a valid URL)
- `SUPABASE_ANON_KEY`: Supabase anon/public key (used by the client)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (**server-only secret**)

### Clerk

- `NUXT_CLERK_SECRET_KEY` (or `CLERK_SECRET_KEY`): Clerk secret key (**server-only secret**, must start with `sk_`)
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (or `CLERK_PUBLISHABLE_KEY`): Clerk publishable key (**public**, safe to expose)

> The server validation only *requires* the Clerk secret key; the publishable key is used for the auth UI/client configuration.

## Optional environment variables

- `NUXT_PUBLIC_APP_URL`: base URL used for link generation in some server utilities and admin actions (defaults to `http://localhost:3000`)
- `OPENROUTER_API_KEY`: enables optional OpenRouter-based logic (fallback scoring / LLM tooling)
- `DATABASE_URL`: Prisma / direct Postgres connection string (see `prisma/README.md`)

## Tests / tooling (optional)

- `PLAYWRIGHT_TEST_BASE_URL`: override Playwright base URL (default: `http://localhost:3000`)
- `VITEST_RUN_REAL_API=true`: run the “real API” Clerk integration test (otherwise tests use mocks)

### E2E tests with real Clerk

By default, sign-in e2e tests use a **mocked** Clerk API; the “sign in and redirect” test is skipped. To run it against **real Clerk**:

1. Create a test user in your Clerk Dashboard (or use an existing one) and note their **Clerk user ID** (e.g. `user_2abc...`).
2. Set env and run:
   - `E2E_USE_REAL_CLERK=1`
   - `E2E_CLERK_EMAIL` = that user’s email
   - `E2E_CLERK_PASSWORD` = that user’s password
   - `E2E_CLERK_ID` = that user’s Clerk ID (so the ensure-test-user API can create/link the player)
   - `NUXT_E2E_ENSURE_TEST_USER=1` (so the dev server allows the ensure-test-user API)
3. Run: `pnpm test:e2e:real-clerk` (or `pnpm test:e2e:real-clerk tests/e2e/sign-in.spec.ts` for just sign-in).

The script sets `E2E_USE_REAL_CLERK=1`; you must set `E2E_CLERK_EMAIL`, `E2E_CLERK_PASSWORD`, and `E2E_CLERK_ID` in the shell or in a `.env` that Playwright loads (e.g. via `dotenv` in `playwright.config.ts` if you add it).

## Deployment notes

- Set **server-only secrets** (`NUXT_CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`) in your host’s server environment variables.
- Set **public variables** (`NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NUXT_PUBLIC_APP_URL`) in the host’s public/runtime environment configuration as appropriate for Nuxt.

