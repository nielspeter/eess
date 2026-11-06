import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    // ADR-024's source-text registry lives on `globalThis` and has no release, so each test file
    // gets its own realm state only while files are isolated.
    isolate: true,
  },
})
