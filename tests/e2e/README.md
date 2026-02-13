# E2E tests

- **Default:** Clerk is **mocked**; the “sign in with valid test user and redirect” test is skipped.
- **Real Clerk:** Set `E2E_USE_REAL_CLERK=1` and `E2E_CLERK_EMAIL`, `E2E_CLERK_PASSWORD`, `E2E_CLERK_ID`, then run `pnpm test:e2e:real-clerk`. See [CONFIGURATION.md](../../docs/CONFIGURATION.md#e2e-tests-with-real-clerk).

## Env (real Clerk)

| Variable | Required when | Description |
|----------|----------------|-------------|
| `E2E_USE_REAL_CLERK` | real Clerk | Set to `1` to disable the Clerk mock and run the redirect test. |
| `E2E_CLERK_EMAIL` | real Clerk | Test user email (must exist in Clerk). |
| `E2E_CLERK_PASSWORD` | real Clerk | Test user password. |
| `E2E_CLERK_ID` | real Clerk | Clerk user ID (from Dashboard); used by ensure-test-user API. |
| `NUXT_E2E_ENSURE_TEST_USER` | redirect test | Set to `1` so the dev server enables the ensure-test-user API. |

## Scripts

- `pnpm test:e2e` – all e2e (Clerk mocked)
- `pnpm test:e2e:desktop` – all e2e, Chromium only
- `pnpm test:e2e:real-clerk` – all e2e with real Clerk (set `E2E_CLERK_*` in env)
