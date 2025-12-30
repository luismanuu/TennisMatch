# Test Documentation

This directory contains E2E and integration tests for the Tennis Match application.

## Test Structure

```
tests/
├── e2e/              # End-to-end tests using Playwright
│   ├── fixtures/     # Test fixtures (API mocking)
│   │   └── clerk-mock.ts
│   ├── sign-in.spec.ts
│   └── sign-up.spec.ts
├── integration/      # Integration tests using Vitest
│   ├── auth.spec.ts  # Mocked API tests
│   ├── auth-api.spec.ts  # HTTP request tests with MSW
│   ├── clerk-real-api.spec.ts  # Real Clerk API tests (creates actual users)
│   ├── setup.ts
│   └── mocks/
│       ├── server.ts
│       ├── handlers.ts
│       └── browser.ts
└── utils/            # Test utilities and helpers
    └── test-helpers.ts
```

## Running Tests

### Integration Tests (Mocked)

Run integration tests with mocked API calls (fast, no real API calls):
```bash
npm run test:integration
```

Run integration tests in watch mode:
```bash
npm run test
```

Run integration tests with UI:
```bash
npm run test:integration:ui
```

### Integration Tests (Real Clerk API)

**⚠️ WARNING: These tests create REAL users in your Clerk instance!**

Run integration tests against real Clerk API (requires Clerk secret key):
```bash
# Set your Clerk secret key first
export NUXT_CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Or on Windows:
# set NUXT_CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Then run the real API tests
npm run test:integration:real-api
```

**Important Notes:**
- These tests will create and delete test users in your Clerk instance
- Only run these in test/staging environments, NOT production
- Users are automatically cleaned up after each test
- Tests will be skipped if the secret key is not provided

### E2E Tests

Run E2E tests (mocked API - no real users created):
```bash
npm run test:e2e
```

Run E2E tests with UI:
```bash
npm run test:e2e:ui
```

Run all tests:
```bash
npm run test:all
```

## Test Coverage

### E2E Tests (Mocked API)

E2E tests validate the complete user flow for authentication with **mocked Clerk API** (no real users created):

**Sign In Tests:**
- Page display and navigation
- Form validation
- Error handling
- Responsive design

**Sign Up Tests:**
- Page display and navigation
- Form validation (email, password strength)
- Optional field handling
- Error handling
- Responsive design

### Integration Tests (Mocked)

Integration tests validate API interactions with mocked Clerk endpoints:

**Authentication API Tests:**
- Successful sign-in with valid credentials
- Failed sign-in with invalid credentials
- Network error handling
- Successful user creation
- Validation errors (invalid email, weak password, duplicate email)
- Session management (token verification)

### Integration Tests (Real Clerk API)

Integration tests that use the **real Clerk API** to validate actual user creation:

**User Creation Tests:**
- Create new users in Clerk
- Reject invalid email addresses
- Reject weak passwords
- Handle duplicate email registration
- User authentication
- Session management

## API Mocking

### E2E Tests

E2E tests use Playwright's route interception to mock Clerk API calls:
- `tests/e2e/fixtures/clerk-mock.ts` - Intercepts and mocks all Clerk API requests
- Prevents real user creation during E2E testing
- Provides consistent test responses

### Integration Tests

Integration tests use MSW (Mock Service Worker) to mock Clerk API calls:

- `tests/integration/mocks/handlers.ts` - Defines mock API handlers
- `tests/integration/mocks/server.ts` - Sets up the mock server for Node.js
- `tests/integration/mocks/browser.ts` - Sets up the mock worker for browser tests

## Test Utilities

The `tests/utils/test-helpers.ts` file provides helper functions for:
- Filling Clerk forms
- Submitting forms
- Checking for error messages
- Waiting for Clerk components to load

## Configuration

### Playwright

Configuration: `playwright.config.ts`

- Tests run against `http://localhost:3000` by default
- Automatically starts dev server before tests
- Supports Chromium, Firefox, and WebKit browsers (Chromium by default)
- All Clerk API calls are mocked via route interception

### Vitest

Configuration: `vitest.config.ts`

- Uses `happy-dom` as the test environment
- Automatically sets up MSW mocks
- Includes TypeScript support
- Real API tests are excluded by default (run separately)

## Environment Variables

### E2E Tests
- `PLAYWRIGHT_TEST_BASE_URL` - Override the base URL (default: `http://localhost:3000`)
- No Clerk keys needed (API is mocked)

### Integration Tests (Mocked)
- No environment variables needed (API is mocked)

### Integration Tests (Real API)
- `NUXT_CLERK_SECRET_KEY` or `CLERK_SECRET_KEY` - Required to run real API tests
- Only use in test/staging environments

## Notes

- **E2E tests** interact with mocked Clerk components (no real users created)
- **Integration tests (mocked)** use mocked API calls for fast execution
- **Integration tests (real API)** create actual users in Clerk (use with caution)
- All test suites should be run before deploying changes
- Real API tests automatically clean up created users after each test
