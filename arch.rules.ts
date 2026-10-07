/**
 * Architecture rules for the eess monorepo — the framework validating itself.
 *
 * Run with the eess-ts CLI: `npx eess-ts check arch.rules.ts` (or
 * `npm run check:arch`). Complements `scripts/check-workspace-integrity.mjs`
 * (package.json declarations); this checks the actual import graph via the AST.
 *
 *  - Kernel purity: @nielspeter/eess imports no ts-morph / picomatch / dialect.
 *  - Dialect isolation: eess-ts / eess-mermaid / eess-md / eess-gherkin never
 *    import each other (siblings on the kernel; only eess-crossvalidate bridges
 *    them).
 */
import { workspace, modules } from '@nielspeter/eess-ts'

const p = workspace([
  'packages/core/tsconfig.build.json',
  'packages/ts/tsconfig.build.json',
  'packages/mermaid/tsconfig.build.json',
  'packages/md/tsconfig.build.json',
  'packages/gherkin/tsconfig.build.json',
  'packages/crossvalidate/tsconfig.build.json',
])

const only = (pkg: string): string => `**/packages/${pkg}/src/**`
const inPkg = (pkg: string): string => `**/packages/${pkg}/**`

export default [
  // Kernel purity — @nielspeter/eess depends on nothing dialect-specific.
  modules(p)
    .that()
    .resideInFolder(only('core'))
    .should()
    .notImportFrom('**/ts-morph/**', '**/picomatch/**')
    .rule({
      id: 'eess/kernel-no-engine-deps',
      because: 'the kernel must stay dialect-independent',
    }),

  // ADR-002 — all AST work goes through ts-morph; never the raw compiler API.
  modules(p)
    .that()
    .resideInFolder('**/packages/*/src/**')
    .should()
    .notImportFrom('**/node_modules/typescript/**')
    .rule({
      id: 'eess/adr002-no-raw-typescript',
      because: 'ADR-002: ts-morph is the sole AST engine; the raw typescript API is banned',
    }),
  modules(p)
    .that()
    .resideInFolder(only('core'))
    .should()
    .notImportFrom(
      inPkg('ts'),
      inPkg('mermaid'),
      inPkg('md'),
      inPkg('gherkin'),
      inPkg('crossvalidate'),
    )
    .rule({ id: 'eess/kernel-no-dialects', because: 'the kernel must not depend on any dialect' }),

  // Dialect isolation — siblings never import each other.
  modules(p)
    .that()
    .resideInFolder(only('ts'))
    .should()
    .notImportFrom(inPkg('mermaid'), inPkg('md'), inPkg('gherkin'))
    .rule({ id: 'eess/ts-isolated', because: 'dialects are siblings, not cross-dependent' }),
  modules(p)
    .that()
    .resideInFolder(only('mermaid'))
    .should()
    .notImportFrom(inPkg('ts'), inPkg('md'), inPkg('gherkin'))
    .rule({ id: 'eess/mermaid-isolated', because: 'dialects are siblings, not cross-dependent' }),
  modules(p)
    .that()
    .resideInFolder(only('md'))
    .should()
    .notImportFrom(inPkg('ts'), inPkg('mermaid'), inPkg('gherkin'))
    .rule({ id: 'eess/md-isolated', because: 'dialects are siblings, not cross-dependent' }),
  modules(p)
    .that()
    .resideInFolder(only('gherkin'))
    .should()
    .notImportFrom(inPkg('ts'), inPkg('mermaid'), inPkg('md'))
    .rule({ id: 'eess/gherkin-isolated', because: 'dialects are siblings, not cross-dependent' }),

  // Plan 0404 — eess-md resolves a link in one place. A file that resolves
  // links selects itself by importing from `model/resolve-link.ts`; one that
  // stops doing so drops out of the selection, and the emptied selection fails
  // with the zero-examined finding (measured). One that imports it and also
  // reaches for `node:path` is doing path arithmetic of its own — a second
  // resolver. Named residuals: a type re-export from resolve-link.ts keeps a
  // file selected, so a file that keeps one but stops calling resolveLink is
  // guarded only by the `node:path` ban; and a copy written with string
  // operations instead of `node:path` passes.
  modules(p)
    .that()
    .resideInFile('**/packages/md/src/conditions/resolve.ts')
    .and()
    .importFrom('**/packages/md/src/model/resolve-link.ts')
    .should()
    .notImportFrom('node:path')
    .rule({
      id: 'eess/md-one-link-resolver',
      because:
        'two link resolvers disagree about where a link points, and a custom rule cannot tell which one is right',
      suggestion:
        'resolve the link with resolveLink() from model/resolve-link.ts, and keep path arithmetic there',
    }),
]
