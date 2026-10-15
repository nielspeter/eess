#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — plan 0214 / bug 0210. Fixture tier (bug 0127): `tableErAgree` has no
 * production consumer in this repository (`scripts/check-crossval.mjs` imports md-mermaid only),
 * which is why bug 0210 went unnoticed. So the fixture is the gate.
 *
 *   bad-md-mermaid-er/themed-er.md holds an `erDiagram` behind a `%%{init}%%` directive, with an
 *   attribute (`themedGhost`) its property table lacks. The ER selector must see past the directive
 *   (it tests the declared kind, not the raw fence body) and report the attribute.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the attribute was reported — OK
 *   0 = not reported (the selector skipped the fence: vacuous) — the harness treats this as fail
 *   2 = unexpected error — the harness treats this as fail
 */
import { corpus } from '@nielspeter/eess-md'
import { tableErAgree } from '@nielspeter/eess-crossvalidate/md-mermaid-er'

const RULE = 'crossval/table-er-agree'
let violations
try {
  violations = tableErAgree(corpus({ roots: ['scripts/nonvacuity/bad-md-mermaid-er/**'] }), {
    table: { section: /Properties/, name: /^Property$/, type: /^Type$/ },
    entity: (doc) => /^# Entity: (.+)$/m.exec(doc.text)?.[1]?.replace(/\s+/g, ''),
    report: 'return',
  })
} catch (err) {
  console.error(`bad-md-mermaid-er: unexpected error — ${String(err)}`)
  process.exit(2)
}

const hit = violations.filter((v) => v.ruleId === RULE && v.message.includes("'themedGhost'"))
if (hit.length > 0) {
  console.error(`bad-md-mermaid-er: ${RULE}: the themed diagram's drift was reported as expected`)
  process.exit(1)
}
console.error(
  `bad-md-mermaid-er: ${RULE}: NOT reported — the themed fence was skipped (vacuous). ` +
    `${String(violations.length)} finding(s): ${violations.map((v) => v.message.split('\n')[0]).join(' | ')}`,
)
process.exit(0)
