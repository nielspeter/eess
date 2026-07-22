#!/usr/bin/env node
/**
 * Dogfood: run eess-ts's own shipped `recommended` preset against this repo's
 * source — the universal safety floor every consumer gets, applied to us.
 *
 * Why a script (not a `*.rules.ts` file): presets return `ArchViolation[]` and
 * throw `ArchRuleError` — the eess-ts CLI loader only accepts `.check()`-able
 * builders. Same wiring note as check-crossval.mjs / check-corpus.mjs.
 *
 * Role, not coverage: `arch.internal.rules.ts` is the stricter *house ceiling*
 * (it keeps silent-catch / empty-bodies as hard errors, adds complexity/line
 * caps, ADR-005, hygiene). This gate is the *baseline floor* underneath it —
 * eval, the Function constructor, silent catch, empty bodies — a guaranteed
 * minimum that survives refactors of the bespoke layer. The one overlap
 * (no-eval, both green) is belt-and-suspenders on purpose.
 *
 * `agentGuardrails` is deliberately NOT wired here: on this repo its rules fire
 * on legitimate, intentional style (18 `throw new Error`, 270 by-design-similar
 * rule-wrapper bodies) — a hard gate would be red-on-legitimate-style, and its
 * only green config is vacuous. Its coverage is its fixture unit tests. See
 * work/dogfood-coverage.md.
 *
 * Always reports the files it scanned so a green is provably non-vacuous.
 * Exits non-zero on any error-severity violation. Run: `npm run check:baseline`.
 */
import picomatch from 'picomatch'
import { workspace } from '@nielspeter/eess-ts'
import { recommended } from '@nielspeter/eess-ts/presets'
import { reportViolations } from '@nielspeter/eess'

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const INCLUDE = '**/packages/*/src/**'
const p = workspace([
  'packages/core/tsconfig.build.json',
  'packages/ts/tsconfig.build.json',
  'packages/mermaid/tsconfig.build.json',
  'packages/md/tsconfig.build.json',
  'packages/gherkin/tsconfig.build.json',
  'packages/crossvalidate/tsconfig.build.json',
])

// Denominator: the source files `recommended` actually scanned (same include +
// picomatch it uses internally, over each file's absolute path).
const matches = picomatch(INCLUDE)
const filesScanned = p.getSourceFiles().filter((sf) => matches(sf.getFilePath())).length

// report:'return' so this script owns emission and the exit code / summary.
const violations = recommended(p, { include: INCLUDE, report: 'return' })

console.error('')
if (violations.length > 0) {
  reportViolations(violations)
  console.error(
    `  ✗ baseline (recommended) — ${violations.length} violation(s) across ${filesScanned} source files (${elapsed()})`,
  )
  console.error('')
  process.exit(1)
}

console.error(
  `  ✓ baseline (recommended) — 4 floor rules across ${filesScanned} source files · 0 violations (${elapsed()})`,
)
console.error('')
