#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the "no rule id" half of bug 0255.
 *
 * `corpus/exclusion-inert` drives the production `check-corpus.mjs` and proves
 * the OUT-OF-REACH cause. It cannot prove this one: every rule in this repo's
 * gates calls `.rule({ id })`, so there is no production caller without an id
 * to plant a probe against. Enforcement review measured the consequence —
 * deleting the entire no-id block left that row green, on the cause bug 0255
 * itself calls the worse of the two.
 *
 * So this is a module-level fixture, and the limitation is the reason rather
 * than an oversight: it exercises the kernel's real `applyFilters`, not a
 * re-creation of it, but it is the caller that is synthetic. Bug 0127's rule
 * ("a fixture rebuilding the rule proves only the condition") is satisfied on
 * the mechanism and unsatisfiable on the caller.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the diagnostic fired and named no borrowed id — OK
 *   0 = silent, or it prescribed another rule's id — the gate is vacuous or harmful
 *   2 = the fixture's own premise broke, not the gate proven
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyFilters } from '../../packages/core/dist/internal.js'

const SENTINEL = 'bad-inert-exclusion-no-id:'
const dir = mkdtempSync(join(tmpdir(), 'eess-0255-nv-'))
const file = join(dir, 'doc.md')

let printed = ''
const realWrite = process.stderr.write.bind(process.stderr)
try {
  writeFileSync(
    file,
    ['<!-- eess-exclude other/rule: belongs to a different, working rule -->', 'a violation'].join(
      '\n',
    ),
  )
  process.stderr.write = (chunk) => {
    printed += String(chunk)
    return true
  }
  applyFilters(
    [{ rule: 'r', element: 'e', file, line: 2, message: 'a real finding' }],
    {}, // no metadata.id — the whole point
  )
} catch (err) {
  process.stderr.write = realWrite
  console.log(`${SENTINEL} unexpected error — ${String(err)}`)
  process.exit(2)
} finally {
  process.stderr.write = realWrite
  rmSync(dir, { recursive: true, force: true })
}

if (!printed.includes('declares no id')) {
  console.log(`${SENTINEL} silent on a directive that can never apply — the gate is vacuous`)
  process.exit(0)
}
// The harm review reproduced: prescribing an id that already belongs to another
// rule. Reporting is only correct if it does NOT hand the author that id.
if (printed.includes("id: 'other/rule'")) {
  console.log(`${SENTINEL} reported, but prescribed another rule's id — harmful advice`)
  process.exit(0)
}
console.log(
  `${SENTINEL} exclusion/no-rule-id-is-reported — named the inert directive and prescribed no borrowed id`,
)
process.exit(1)
