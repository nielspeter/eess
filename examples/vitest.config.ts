import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The cross-dialect family, plus the published-surface fixture.
    //
    // `public-surface.test.ts` earns its place for a reason the others do not:
    // its real assertion is that it COMPILES — `tsc -p examples/tsconfig.json`
    // reds if any type it names stops being reachable from a published entry
    // point, which is the one thing no runtime test can check, because
    // TypeScript erases types. Its runtime half additionally proves the value
    // exports resolve from the published specifier rather than from source.
    //
    // The other example files remain unrun on purpose — see bug 0222 for the
    // scope question, which this does not settle.
    include: ['cross-dialect.*.test.ts', 'public-surface.test.ts'],
  },
})
