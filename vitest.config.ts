import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '~~': root, '~': root },
  },
  test: {
    // DOM-free tests declare `// @vitest-environment node` at the top of the file.
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
  },
})
