#!/usr/bin/env node
/**
 * ADR-011 clause 1 — every symbol on the KERNEL ROOT is documented somewhere a
 * reader would look.
 *
 * Two things about the scope, both decided in review rather than by this script:
 *
 * **It blocks on the kernel root only.** ADR-011's clause 1 governs
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
 */
import { undocumentedExports, exportsOf } from './lib/public-surface.mjs'

const t0 = Date.now()
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`

const { missing, public: publicExports } = undocumentedExports(process.cwd())
const kernel = missing.filter((e) => e.pkg === 'core')
const dialects = missing.filter((e) => e.pkg !== 'core')
const kernelTotal = exportsOf(process.cwd(), 'core').length

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
  }
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

console.error(
  `  ✓ kernel public surface — ${kernelTotal} root exports all documented · ` +
    `${publicExports.length} family exports scanned, ${dialects.length} dialect-side undocumented ` +
    `(reported) (${elapsed()})`,
)
