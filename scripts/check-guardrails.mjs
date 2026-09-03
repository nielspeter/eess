#!/usr/bin/env node
/**
 * Dogfood: run eess-ts's own shipped `agentGuardrails` preset against this
 * repo's source.
 *
 * **Why this exists at all.** eess ships two presets and used to dogfood one.
 * The one it exempted itself from is the one written for "the mistakes AI coding
 * agents make most often" — in a repo written by AI coding agents. The exemption
 * lived as a prose comment in `check-baseline.mjs` claiming the rules "fire on
 * legitimate, intentional style (18 `throw new Error`, 270 by-design-similar
 * rule-wrapper bodies)".
 *
 * That claim was self-sealing: it was the reason not to run the preset, so
 * nothing ever tested it. Measured when it finally was: 84 copy-paste findings
 * rather than 270, and most of them true duplicates rather than by-design
 * similarity. A rationale that cannot be checked is not a rationale.
 *
 * A tool whose premise is "drift fails the build" cannot exempt itself from what
 * it sells. If a rule here is wrong, the rule gets fixed — not the exemption.
 *
 * `src` (not `include`) is the option that builds the rules. Passing the wrong
 * one constructs ZERO rules, and the preset says so rather than reporting green:
 * `preset/agent/constructs-nothing` — "this call enforces nothing while every
 * gate reports it as healthy". That finding is unsuppressable and it caught the
 * first draft of this script.
 *
 * Always reports the files it scanned so a green is provably non-vacuous.
 * Exits non-zero on any error-severity violation. Run: `npm run check:guardrails`.
 */
import picomatch from 'picomatch'
import { workspace } from '@nielspeter/eess-ts'
import { agentGuardrails } from '@nielspeter/eess-ts/presets'
import { reportViolations } from '@nielspeter/eess'

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const SRC = '**/packages/*/src/**'
const p = workspace([
  'packages/core/tsconfig.build.json',
  'packages/ts/tsconfig.build.json',
  'packages/mermaid/tsconfig.build.json',
  'packages/md/tsconfig.build.json',
  'packages/gherkin/tsconfig.build.json',
  'packages/crossvalidate/tsconfig.build.json',
])

const matches = picomatch(SRC)
const filesScanned = p.getSourceFiles().filter((sf) => matches(sf.getFilePath())).length

// Every flag on. A preset dogfooded with half its rules off is the same
// exemption in a smaller font.
const violations = agentGuardrails(p, {
  src: SRC,
  noGenericErrors: true,
  noStubs: true,
  noEmptyBodies: true,
  noCopyPaste: true,
  report: 'return',
})

const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  reportViolations(violations, { format })
  process.exit(violations.length > 0 ? 1 : 0)
}

const byRule = new Map()
for (const v of violations) {
  const key = v.ruleId ?? String(v.rule)
  byRule.set(key, (byRule.get(key) ?? 0) + 1)
}

console.error('')
console.error('check:guardrails · eess-ts agentGuardrails, run against this repo')
console.error(`  scanned   ${String(filesScanned)} source files matching ${SRC}`)
for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
  console.error(`  ${String(count).padStart(5)}  ${rule}`)
}

// Block on what the PRESET declares blocking, not on everything it says.
//
// `no-copy-paste` ships as `.warn()` deliberately — bug 0169 settled that the
// detector's weight is advisory, and re-deciding that here would be this script
// overriding the preset it exists to dogfood. Everything is reported either way;
// only the exit code reads severity.
//
// The honest limit, stated because an unstated one reads as coverage: a warning
// nobody acts on is barely dogfooding. The 84 copy-paste warnings below are real
// duplication (measured — most are true positives, not by-design similarity), so
// they are debt this repo carries in the open rather than a clean bill.
const errors = violations.filter((v) => (v.severity ?? 'error') === 'error')
const warnings = violations.length - errors.length

if (violations.length > 0) reportViolations(violations)

if (errors.length > 0) {
  console.error(
    `  ✗ guardrails (agentGuardrails) — ${String(errors.length)} error(s), ${String(warnings)} warning(s) across ${String(filesScanned)} source files (${elapsed()})`,
  )
  console.error('')
  process.exit(1)
}

console.error(
  `  ✓ guardrails (agentGuardrails) — 5 rules across ${String(filesScanned)} source files · 0 errors, ${String(warnings)} warning(s) (${elapsed()})`,
)
console.error('')
