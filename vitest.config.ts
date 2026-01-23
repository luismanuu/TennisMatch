import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Default to happy-dom for mocked tests, but real API tests use node environment
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/integration/setup.ts'],
    // Include all integration tests and UTR rating system tests
    include: ['tests/integration/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: [
      // Only exclude real API tests when running default integration tests
      // They can still be run explicitly via: npm run test:integration:real-api
      ...(process.env.VITEST_RUN_REAL_API !== 'true' 
        ? ['tests/integration/clerk-real-api.spec.ts'] 
        : []),
      'node_modules',
      'dist',
    ],
    // Configure environment per test file
    environmentMatchGlobs: [
      ['tests/integration/clerk-real-api.spec.ts', 'node'],
    ],
  },
})

