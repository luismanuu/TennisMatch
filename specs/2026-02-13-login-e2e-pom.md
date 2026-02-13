---
mode: sequential
complexity: medium
type: feature
playwright: true
created: 2026-02-13T00:00:00.000Z
---

# Plan: Login E2E tests with Page Object Model and API-created test user

## Task Description

Implement end-to-end tests for the login flow using Playwright best practices: a single test user created/ensured via an E2E-only API (idempotent — if user exists, do not create again), Page Object Model for the sign-in page, and Clerk kept mocked. Use Playwright MCP where helpful to verify selectors and UI.

## Objective

When complete:

- A test user is defined in one place and ensured via API before login tests run (create player if missing; do nothing if already exists).
- Sign-in page is covered by a `SignInPage` page object with MCP-verified selectors and methods.
- All sign-in E2E tests use the page object; no raw `page.locator` in spec files. Existing coverage is preserved and a new "successful login and redirect" test is added.
- Tests are hardened (no `waitForTimeout`; use Playwright `expect` and built-in waiting).

## Problem Statement

Login E2E tests need a reliable, repeatable test user. The app uses Clerk for auth and a Supabase `players` table linked by `clerk_id`. Tests currently use a hardcoded mock user with no guarantee that a corresponding player row exists, and specs use inline selectors and ad-hoc waits, which are brittle and harder to maintain.

## Solution Approach

- **Test user:** Single fixture file exports email, password, and `clerk_id`. Clerk mock continues to mock Clerk; an E2E-only API ensures a player row exists for that `clerk_id` (idempotent).
- **E2E API:** `POST /api/e2e/ensure-test-user` (or equivalent), enabled only when `NUXT_E2E_ENSURE_TEST_USER=1`. Creates a player for the test `clerk_id` if none exists; otherwise returns success without creating. Uses default `city_id` and `category_id` from env or first row in DB. Does not call Clerk.
- **Page Object:** `SignInPage` with goto, locators (email `#identifier-field`, password `#password-field`, submit `button.cl-formButtonPrimary`, brand, title, subtitle, sign-up link, clerk wrapper, error area), and methods (e.g. `fillCredentials`, `submit`, `waitForFormReady`).
- **Specs:** `beforeAll` calls the ensure-test-user API; all tests use `SignInPage`. Add one test: successful login with fixture credentials → redirect to `/` or `/onboarding`.

## Relevant Files

- `tests/e2e/fixtures/test-user.ts` — New: single source of truth for test email, password, clerk_id.
- `tests/e2e/fixtures/clerk-mock.ts` — Update to import from test-user fixture.
- `server/api/e2e/ensure-test-user.post.ts` — New: idempotent ensure-player endpoint (env-gated).
- `tests/e2e/pages/sign-in.page.ts` — New: SignInPage page object.
- `tests/e2e/sign-in.spec.ts` — Refactor to use SignInPage and ensure-test-user; add successful-login test; remove waitForTimeout.
- `playwright.config.ts` — May need baseURL for request context in beforeAll (already present).
- `.env.example` or docs — Document `NUXT_E2E_ENSURE_TEST_USER`, `E2E_DEFAULT_CITY_ID`, `E2E_DEFAULT_CATEGORY_ID` if used.

## Implementation Phases

### Phase 1: Foundation

- Add test-user fixture and wire clerk-mock to it.
- Add E2E ensure-test-user API (env-gated, idempotent, default city/category).

### Phase 2: Core Implementation

- Add SignInPage page object with selectors and methods.
- Refactor sign-in.spec.ts to use SignInPage and call ensure-test-user in beforeAll; add successful-login test; harden waits.

### Phase 3: Integration & Polish

- Code review of all changed files; fix issues.
- Final validation: run e2e tests and typecheck.

## Step by Step Tasks

### 1. Add test-user fixture

- **Task ID**: fixture-test-user
- **Depends On**: none
- **Description**:
  - Create `tests/e2e/fixtures/test-user.ts`.
  - Export constants: `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD`, `E2E_TEST_CLERK_ID` (e.g. `user_mock_e2e_123`).
  - Export a single object `e2eTestUser` with `email`, `password`, `clerkId` for convenience.
- **Tests**: N/A (fixture only; covered by spec tests that use it).

### 2. Wire clerk-mock to test-user fixture

- **Task ID**: clerk-mock-fixture
- **Depends On**: fixture-test-user
- **Description**:
  - In `tests/e2e/fixtures/clerk-mock.ts`, import `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD`, `E2E_TEST_CLERK_ID` from `./test-user`.
  - Replace all hardcoded `test@example.com`, `SecurePassword123!`, and `user_mock_e2e_123` with these constants in the mock handler (sign_in and /me responses).
- **Tests**: Existing `tests/e2e/sign-in.spec.ts` continues to pass (no behavior change).

### 3. Add E2E ensure-test-user API

- **Task ID**: api-ensure-test-user
- **Depends On**: clerk-mock-fixture
- **Description**:
  - Create `server/api/e2e/ensure-test-user.post.ts`.
  - Run only when `process.env.NUXT_E2E_ENSURE_TEST_USER === '1'`; otherwise return 404 or do not register.
  - Accept body with `clerk_id` (or use test-user fixture value from env/constant). Validate with Zod.
  - Query `players` for existing row with that `clerk_id`. If exists, return 200 with `{ created: false }` (or equivalent). If not, insert one player with: `clerk_id`, `name` (e.g. "E2E Test User"), `city_id`, `category_id`, `status: 'active'`, and default `elo`/`mmr` (e.g. from category or 1000). Use `E2E_DEFAULT_CITY_ID` and `E2E_DEFAULT_CATEGORY_ID` from env, or select first row from `cities` and `categories` if unset.
  - Return 201 with `{ created: true }` (or 200 with body) on create. Do not call Clerk.
  - Add brief JSDoc that the route is E2E-only and idempotent.
- **Tests**: N/A (API is exercised by e2e spec’s beforeAll; optional manual curl or integration test can be added later).

### 4. Add SignInPage page object

- **Task ID**: pom-sign-in
- **Depends On**: api-ensure-test-user
- **Description**:
  - Create `tests/e2e/pages/sign-in.page.ts`.
  - Constructor or factory accepts `page: Page` (Playwright).
  - Locators (use MCP-verified selectors): email `#identifier-field` or `input[name="identifier"]`, password `#password-field` or `input[name="password"]`, submit `button.cl-formButtonPrimary`, brand `.brand-name`, title `.auth-title`, subtitle `.auth-subtitle`, sign-up link `a[href="/sign-up"]`, clerk wrapper `.clerk-wrapper`, form errors `[role="alert"]` or Clerk error container.
  - Methods: `goto()` — `page.goto('/sign-in')`; `waitForFormReady()` — wait for `.clerk-wrapper` and email input visible; `fillCredentials(email, password)`; `submit()` — click submit button; getters for assertions (e.g. brand, title, subtitle, signUpLink) as needed by specs.
  - Use Playwright best practices: return locators or use methods that return promises where appropriate.
- **Tests**: Covered by refactored sign-in.spec.ts that uses this page object.

### 5. Refactor sign-in spec and add successful-login test

- **Task ID**: spec-refactor-and-success-login
- **Depends On**: clerk-mock-fixture, api-ensure-test-user, pom-sign-in
- **Description**:
  - In `tests/e2e/sign-in.spec.ts`: Import `SignInPage` and test-user fixture. Add `beforeAll`: use `request` (or fetch) to call `POST /api/e2e/ensure-test-user` with body `{ clerk_id: e2eTestUser.clerkId }`; only run if env `NUXT_E2E_ENSURE_TEST_USER=1` or always call and accept 404 (skip successful-login test if 404). Alternatively run ensure in global setup and pass baseURL.
  - Refactor every test to use `SignInPage`: create page object in beforeEach/beforeAll from `page`, then call `signInPage.goto()`, `signInPage.waitForFormReady()`, `signInPage.fillCredentials(...)`, etc. Remove all raw `page.locator` and `page.waitForSelector` / `page.waitForTimeout`; use `expect(locator).toBeVisible()` and page object methods.
  - Add new test: "should sign in with valid test user and redirect" — fill credentials from fixture, submit, assert URL is not `/sign-in` and is `/` or `/onboarding` (with timeout). Skip this test if ensure-test-user returned 404 (optional).
  - Ensure existing tests still pass: display sign-in page, navigate to sign-up, Clerk form visible, validation errors on empty submit, invalid credentials handled, form state on navigation, mobile responsive.
- **Tests**: `tests/e2e/sign-in.spec.ts` — all existing cases plus "should sign in with valid test user and redirect".

### 6. Code Review

- **Task ID**: review-all
- **Depends On**: fixture-test-user, clerk-mock-fixture, api-ensure-test-user, pom-sign-in, spec-refactor-and-success-login
- **Description**: Review all code changes for correctness, style, edge cases, and security. Re-read every file you changed; check for bugs, missing edge cases (e.g. empty cities/categories), security (e2e route only when env set), and style. Fix any issues before proceeding to validation.
- **Tests**: N/A

### 7. Final Validation

- **Task ID**: validate-all
- **Depends On**: review-all
- **Description**: Run typecheck and e2e tests. Ensure `NUXT_E2E_ENSURE_TEST_USER=1` and default city/category are set (or DB has seed data) so ensure-test-user succeeds. Verify all acceptance criteria.
- **Tests**: N/A

## Documentation Requirements

- JSDoc on `server/api/e2e/ensure-test-user.post.ts` stating the route is E2E-only and idempotent.
- Document in `.env.example` or `docs/CONFIGURATION.md`: `NUXT_E2E_ENSURE_TEST_USER`, `E2E_DEFAULT_CITY_ID`, `E2E_DEFAULT_CATEGORY_ID` (if used).

## Acceptance Criteria

- Test user is defined in one fixture file and used by both clerk-mock and the ensure-test-user API.
- POST ensure-test-user is idempotent: creates player only when missing; returns success without creating when player exists. Route is active only when `NUXT_E2E_ENSURE_TEST_USER=1`.
- SignInPage page object exists with goto, waitForFormReady, fillCredentials, submit, and selectors for brand, title, subtitle, sign-up link, and error area.
- All sign-in e2e tests use SignInPage; no raw `page.locator` in the spec file for sign-in page elements. No `waitForTimeout`; use Playwright expect and built-in waiting.
- New test "should sign in with valid test user and redirect" passes when ensure-test-user has run and player exists.
- `pnpm typecheck` and `pnpm test:e2e` (with env set) pass.

## Validation Commands

- `pnpm typecheck`
- `NUXT_E2E_ENSURE_TEST_USER=1 pnpm test:e2e` (or set env in `.env.test` / shell so ensure-test-user is active; ensure DB has at least one city and category or set E2E_DEFAULT_CITY_ID and E2E_DEFAULT_CATEGORY_ID)

## Notes

- Default city/category: If DB is empty, ensure-test-user may need seeded data or env vars. Document for local and CI.
- Parallel workers: beforeAll runs per worker; idempotent ensure avoids duplicate inserts.
- Playwright MCP: Use during implementation to confirm selectors on `/sign-in` (e.g. `#identifier-field`, `#password-field`, `button.cl-formButtonPrimary`) if Clerk markup changes.
