import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

// Ensure .nuxt directory exists for module resolution
const nuxtBuildPath = resolve(__dirname, '.nuxt')
if (!existsSync(nuxtBuildPath)) {
  mkdirSync(nuxtBuildPath, { recursive: true })
  // Create a minimal route-rules.mjs file to satisfy module resolution
  writeFileSync(
    resolve(nuxtBuildPath, 'route-rules.mjs'),
    'export default {};\n'
  )
}

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
  resolve: {
    alias: {
      // Resolve Nuxt's #build alias to the .nuxt directory
      '#build': nuxtBuildPath,
      // Ensure absolute paths are used (Vitest requirement)
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
    },
  },
  // Optimize dependencies to exclude Nuxt from pre-bundling
  optimizeDeps: {
    exclude: ['nuxt', '@nuxt/kit'],
  },
})

