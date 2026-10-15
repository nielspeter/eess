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
import { workspace, modules, type ExpressionMatcher } from '@nielspeter/eess-ts'

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

/**
 * ADR-019: a fence's language tag is compared in one place, eess-md's `tagIsLanguage`. This matches
 * a comparison made anywhere else: `x.lang` (or a method called on it) on one side of `===`, `!==`,
 * `==` or `!=`, a method called on `x.lang` (`.toLowerCase()`, `.startsWith(…)`), and
 * `switch (x.lang)`. Asking whether there is a tag at all (`x.lang === null`) is not a comparison of
 * one, so it passes. It reads node kinds by name because the root does not depend on ts-morph.
 */
const LANG = /\.lang\b/
const NO_TAG = new Set(['null', 'undefined'])
const EQUALITY = new Set(['===', '!==', '==', '!='])
const langTagComparison: ExpressionMatcher = {
  description: 'a comparison of a code block tag (`.lang`) outside tagIsLanguage',
  matches(node) {
    const kind = node.getKindName()
    const parts = node.getChildren().map((c) => c.getText())
    if (kind === 'BinaryExpression') {
      const [left = '', op = '', right = ''] = parts
      if (!EQUALITY.has(op)) return false
      return (LANG.test(left) && !NO_TAG.has(right)) || (LANG.test(right) && !NO_TAG.has(left))
    }
    if (kind === 'CallExpression') return /\.lang\??\.\w+$/.test(parts[0] ?? '')
    if (kind === 'SwitchStatement') return LANG.test(parts[2] ?? '')
    return false
  },
}

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

  // Plan 0404 — eess-md's link conditions and predicates resolve links through
  // resolveLink, not with path arithmetic of their own. A condition or predicate
  // module that imports from `model/resolve-link.ts` is selected, and must not
  // also import a `path` module, under any of its spellings. Plan 0406 widened
  // it to predicates/: the importers today are conditions/resolve.ts,
  // conditions/linked-back.ts and predicates/live-target.ts. Only if all three
  // stop importing it does the selection empty, and the rule fail with the
  // zero-examined finding.
  //
  // What it cannot see, stated rather than implied (ADR-016 rule 7):
  //  - a module that re-implements resolution and never imports resolve-link.ts
  //    is not selected at all — the case proposal 013's survey found in a
  //    consumer's custom rule; nothing structural catches that;
  //  - a type re-export from resolve-link.ts keeps a file selected even if it
  //    stops calling resolveLink, so such a file is guarded only by the ban;
  //  - a copy written with string operations instead of a `path` module passes.
  // It is a Tier-1 check on the conditions' imports, not proof that only one
  // resolver exists.
  modules(p)
    .that()
    .resideInFile('**/packages/md/src/{conditions,predicates}/*.ts')
    .and()
    .importFrom('**/packages/md/src/model/resolve-link.ts')
    .should()
    .notImportFrom('node:path', 'path', 'node:path/posix', 'path/posix')
    .rule({
      id: 'eess/md-one-link-resolver',
      because:
        'a link condition doing its own path arithmetic is a second resolver, and two resolvers disagree about where a link points',
      suggestion:
        'resolve the link with resolveLink() from model/resolve-link.ts, and keep path arithmetic there',
    }),

  // ADR-019 C3 — one owner of the tag comparison. What it cannot see, stated rather than implied
  // (ADR-016 rule 7): the tag read into a variable first (`const { lang } = b`, `const t = b.lang`)
  // and compared there; a lookup keyed on it (`map.get(b.lang)`, `tags.includes(b.lang)`); and
  // `b['lang']`. A Tier-1 check on the spelled comparison, not proof that only one exists.
  modules(p)
    .that()
    .resideInFolder('**/packages/*/src/**')
    .should()
    .notContain(langTagComparison)
    .rule({
      id: 'eess/one-code-block-tag-comparison',
      because:
        'ADR-019: a language tag is compared in any letter case and nothing else, in one place, so two readers never answer "is this mermaid?" differently',
      suggestion:
        'call tagIsLanguage(block.lang, language) from @nielspeter/eess-md/internal (inside eess-md, from model/code-block-tag.js)',
    }),
]
