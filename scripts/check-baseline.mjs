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
 * `agentGuardrails` has its own gate now — `check:guardrails`. It used to be
 * exempted here, on a rationale written in this comment: that its rules fired
 * "on legitimate, intentional style (18 `throw new Error`, 270 by-design-similar
 * rule-wrapper bodies)".
 *
 * That rationale was self-sealing — it was the reason not to run the preset, so
 * nothing ever tested it — and it did not survive being tested. The 270 was 84,
 * most of those are true duplicates rather than by-design similarity, and all 17
 * bare `Error`s were a real finding: the caller the rule describes is
 * `rule-file-findings.ts`, in this package, which branches on error type and had
 * no way to tell a misconfigured rule from a crash. They are `ArchConfigError`
 * now, and that class exists because the preset asked for it.
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

// --format json/github — machine-readable on stdout, then exit. Mirrors
// check-corpus.mjs. Without it a caller (the non-vacuity harness) can only
// assert on the rendered rule *description*, which breaks on any rewording
// (bug 0110).
const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  reportViolations(violations, { format })
  process.exit(violations.length > 0 ? 1 : 0)
}

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
