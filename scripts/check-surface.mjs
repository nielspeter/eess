#!/usr/bin/env node
/**
 * ADR-011 clause 1 — every symbol on the KERNEL ROOT is documented somewhere a
 * reader would look.
 *
 * Two things about the scope, both decided in review rather than by this script:
 *
 * **For ADR-011, it blocks on the kernel root only** (ADR-023's check below blocks on every
 * package). ADR-011's clause 1 governs
 * `@nielspeter/eess`'s root entry point; that is the surface the ADR classified
 * and the population it authorises a gate over. The dialects' undocumented
 * exports are real debt, but no ADR clause, plan or bug ruling covers them, and a
 * gate that blocks a release on a population five times its own clause is the
 * shape that gets waived rather than fixed — which ADR-011's own "Do nothing"
 * alternative names. They are reported below as a census, with counts, and they
 * do not fail the build.
 *
 * **It runs LAST.** The first version of this check sat mid-chain in `validate`,
 * which is one `&&` sequence — so while it was red, `lint`, `format:check` and
 * the entire test suite never ran, in `validate` or in CI. That silently disabled
 * the mechanism ADR-011's own Enforcement row 2 calls `gated`
 * (`packages/ts/tests/standalone-surface.test.ts`, which runs only under
 * `npm run test`). A gate that hides other gates is worse than the drift it
 * catches, so this one is deliberately the last step.
 *
 * **ADR-023 clause 2 rides along, on every package.** A twin of the other kind, whether of a free
 * export or of a builder method of the same word, takes the prefix `predicate` or `condition`
 * (`conditionResideInFile`, `predicateHaveField`), never a suffix. So every value export on a public
 * entry point (not `/internal`) whose name ends in `Predicate` or `Condition` is a finding unless it
 * is on `NOT_A_TWIN` below, a list a reviewer extends with a reason. Inferring twins from the
 * package's other exports instead missed a twin of a builder method (`haveFieldPredicate`, where the
 * plain word is `docs().haveField()`) and any suffix name whose base is not an export (PR #248's
 * enforcement review measured both green).
 */
import { undocumentedExports, exportsOf, PACKAGES } from './lib/public-surface.mjs'

/** Value exports that end in a kind's name and are not twins, each with the reason. */
const NOT_A_TWIN = new Map([
  ['definePredicate', 'constructs a predicate from a description and a test; no word is shared'],
  [
    'defineCondition',
    'constructs a condition from a description and an evaluate; no word is shared',
  ],
  ['satisfyPairCondition', "eess-ts's condition over a `PairCondition`; the type names it"],
])

const t0 = Date.now()
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`

const { missing, public: publicExports } = undocumentedExports(process.cwd())
const kernel = missing.filter((e) => e.pkg === 'core')
const dialects = missing.filter((e) => e.pkg !== 'core')
const kernelTotal = exportsOf(process.cwd(), 'core').length

// ADR-023 clause 2: a name ending in a kind is a twin unless a reviewer listed it, in any package,
// kernel included, from the census's one package list.
let suffixNamed = 0
const suffixTwins = PACKAGES.flatMap((pkg) =>
  exportsOf(process.cwd(), pkg)
    .filter((e) => !e.typeOnly)
    .flatMap((e) => {
      const m = /^(.+)(Predicate|Condition)$/.exec(e.name)
      if (m === null) return []
      suffixNamed += 1
      if (NOT_A_TWIN.has(e.name)) return []
      const prefixed = `${m[2] === 'Predicate' ? 'predicate' : 'condition'}${m[1][0].toUpperCase()}${m[1].slice(1)}`
      return [{ pkg, name: e.name, prefixed }]
    }),
)

// The census is printed whether or not the gate reds: a number nobody can see is
// a number nobody pays down.
if (dialects.length > 0) {
  const byPkg = new Map()
  for (const m of dialects) byPkg.set(m.pkg, [...(byPkg.get(m.pkg) ?? []), m.name])
  console.error('')
  console.error(
    `  ℹ dialect surfaces — ${dialects.length} undocumented export(s), reported not gated ` +
      '(ADR-011 clause 1 covers the kernel root; these have no ruling yet — bug 0220):',
  )
  for (const [pkg, names] of [...byPkg].sort()) {
    console.error(`      @nielspeter/eess-${pkg}  (${names.length})`)
    // Names, not just a count. The comment above says "a number nobody can see is
    // a number nobody pays down" and then printed only counts, which is the same
    // failure one level down: a census you cannot act on is a census nobody acts
    // on. Review caught the contradiction between the comment and the code.
    console.error(`        ${[...names].sort().join(', ')}`)
  }
}

if (suffixTwins.length > 0) {
  console.error('')
  console.error(
    `  ✗ ADR-023 — ${suffixTwins.length} export(s) name the twin of a published name by suffix:`,
  )
  for (const t of suffixTwins) {
    console.error(
      `      @nielspeter/${t.pkg === 'core' ? 'eess' : `eess-${t.pkg}`}: ${t.name} → ${t.prefixed}`,
    )
  }
  console.error('')
  console.error(
    '      Fix: the twin takes the prefix `predicate` or `condition` (ADR-023 clause 2). A name' +
      ' that is not a twin goes on NOT_A_TWIN in scripts/check-surface.mjs, with its reason, in review.',
  )
  console.error('')
}

if (kernel.length > 0) {
  console.error('')
  console.error(
    `  ✗ kernel public surface — ${kernel.length} of ${kernelTotal} symbols exported from ` +
      '@nielspeter/eess appear in no docs/ page, package README or ADR:',
  )
  console.error(
    `        ${kernel
      .map((e) => e.name)
      .sort()
      .join(', ')}`,
  )
  console.error('')
  console.error('      Fix: document it where a reader would look, or move it behind')
  console.error(
    '      @nielspeter/eess/internal. A symbol on the kernel root that no page mentions is',
  )
  console.error(
    "      either undocumented API or a misclassification — which one is the author's call,",
  )
  console.error("      not this gate's (ADR-011).")
  console.error('')
  process.exit(1)
}
if (suffixTwins.length > 0) process.exit(1)

console.error(
  `  ✓ public surface — ${kernelTotal} kernel root exports all documented · ` +
    `${publicExports.length} family exports scanned, ${dialects.length} dialect-side undocumented ` +
    `(reported) · ${suffixNamed} suffix-named value exports examined, ${NOT_A_TWIN.size} names listed ` +
    `as not twins, 0 twins (ADR-023) (${elapsed()})`,
)
