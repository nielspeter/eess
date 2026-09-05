#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the two `applyFilters` copies must answer alike.
 *
 * `packages/core/src/execute-rule.ts` and `packages/ts/src/core/execute-rule.ts`
 * are independent implementations of the same function (plan 0188 lists
 * `execute-rule` among 27 duplicated modules). Bug 0255 is the fourth recorded
 * incident of a fix landing on one copy while nothing noticed — and the review
 * of its own fix found the SAME defect twice more: the ts copy missed both
 * diagnostics entirely, and then, once hand-ported, its "suppressed nothing"
 * wording had silently diverged from the kernel's.
 *
 * Per-bug porting has now failed three times on one bug. This is the mechanism
 * instead: run identical scenarios through both copies and compare what they
 * print. It does not unify them — that is plan 0188's job — it makes a
 * divergence fail the build instead of waiting for a reviewer to read both
 * files side by side.
 *
 * **What it does and does not prove.** It compares stderr for the scenarios
 * below. Two copies could still differ in behaviour this fixture does not
 * exercise; every scenario added here narrows that. It is a floor, and a floor
 * that did not exist.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the copies agree on every scenario — OK
 *   0 = they diverge, or one of them says nothing at all — the gate is vacuous
 *   2 = the fixture's own premise broke, not the gate proven
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyFilters as kernelApplyFilters } from '../../packages/core/dist/internal.js'
import { applyFilters as tsApplyFilters } from '../../packages/ts/dist/core/execute-rule.js'

const SENTINEL = 'bad-applyfilters-parity:'
const dir = mkdtempSync(join(tmpdir(), 'eess-parity-'))

/** Run one scenario through one copy and capture what it writes to stderr. */
const capture = (fn, violations, ctx) => {
  const real = process.stderr.write.bind(process.stderr)
  let out = ''
  process.stderr.write = (chunk) => {
    out += String(chunk)
    return true
  }
  try {
    fn(violations, ctx)
  } finally {
    process.stderr.write = real
  }
  // Absolute paths differ per run; the message shape is what must agree.
  return out.split(dir).join('<dir>')
}

/**
 * Each scenario is [name, file contents, violation lines, ctx].
 *
 * Chosen to cover both diagnostics and the cases review found divergent or
 * untested: a working directive (must print nothing), a stale one, a
 * directive for another rule, and the id-less shapes.
 */
const SCENARIOS = [
  ['working directive prints nothing', ['<!-- eess-exclude demo/rule: works -->', 'x'], [2], { metadata: { id: 'demo/rule' } }],
  ['out-of-reach directive is reported', ['<!-- eess-exclude demo/rule: too far -->', 'gap', 'x'], [3], { metadata: { id: 'demo/rule' } }],
  ["another rule's directive is not this rule's problem", ['<!-- eess-exclude other/rule: theirs -->', 'x'], [2], { metadata: { id: 'demo/rule' } }],
  ['no rule id at all', ['<!-- eess-exclude demo/rule: reason -->', 'x'], [2], {}],
  ['no rule id, several directives in one file', ['<!-- eess-exclude a/one: r -->', 'y', '<!-- eess-exclude b/two: r -->', 'x'], [4], {}],
  ['no rule id, reason-free directive', ['<!-- eess-exclude demo/rule -->', 'x'], [2], {}],
  // Bug 0258: the reason names an otherwise-anonymous rule. A new branch needs a
  // new scenario or this gate does not reach it — the SCENARIOS list is the
  // whole of what parity compares.
  ['no rule id, but a .because() reason', ['<!-- eess-exclude a/one: r -->', 'x'], [2], { reason: 'no eval in handlers' }],
  ['no rule id, a reason that wraps', ['<!-- eess-exclude a/one: r -->', 'x'], [2], { reason: 'no eval\n   in handlers' }],
]

let divergences = []
let sawOutput = false
try {
  for (const [name, lines, violationLines, ctx] of SCENARIOS) {
    const file = join(dir, `${name.replace(/[^a-z0-9]+/gi, '-')}.md`)
    writeFileSync(file, lines.join('\n'))
    const violations = () =>
      violationLines.map((line) => ({ rule: 'r', element: 'e', file, line, message: 'a finding' }))
    const fromKernel = capture(kernelApplyFilters, violations(), ctx)
    const fromTs = capture(tsApplyFilters, violations(), ctx)
    if (fromKernel !== '' || fromTs !== '') sawOutput = true
    if (fromKernel !== fromTs) {
      divergences.push(`  ${name}\n    kernel: ${JSON.stringify(fromKernel)}\n    ts    : ${JSON.stringify(fromTs)}`)
    }
  }
} catch (err) {
  console.log(`${SENTINEL} unexpected error — ${String(err)}`)
  process.exit(2)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// A run where NEITHER copy ever printed would "agree" vacuously — that is the
// shape this harness exists to refuse, so it is a failure, not a pass.
if (!sawOutput) {
  console.log(`${SENTINEL} neither copy printed anything for any scenario — the comparison is vacuous`)
  process.exit(0)
}
if (divergences.length > 0) {
  console.log(`${SENTINEL} the two applyFilters copies diverge:\n${divergences.join('\n')}`)
  process.exit(0)
}
console.log(
  `${SENTINEL} engine/applyfilters-parity — ${String(SCENARIOS.length)} scenarios, both copies identical`,
)
process.exit(1)
