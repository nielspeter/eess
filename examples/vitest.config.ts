import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['cross-dialect.*.test.ts'], // the checked family, and nothing else
  },
})
