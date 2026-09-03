#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — bug 0238. A reason-free exclusion must not buy silence.
 *
 * ADR-012 changed a reason-free waiver from REFUSED to applied-then-promoted:
 * the exemption takes effect, and the kernel's `applyFilters` puts an
 * unsuppressable configuration finding in the suppressed violation's place.
 * That promotion is the ONLY thing keeping the change fail-closed.
 *
 * This fixture drives it through `eess-md`, deliberately. `eess-ts` forks
 * `applyFilters` and has its own copy of the behaviour; `eess-md`, `-mermaid`,
 * `-gherkin` and `-crossvalidate` do not fork it and reach the kernel's. Those
 * four are the dialects ADR-012 exists to give this behaviour to, and until this
 * fixture nothing exercised the kernel's copy end to end — the whole kernel
 * suite stayed green with the promotion deleted (measured, bug 0238).
 *
 * Asserts the promoted finding's IDENTITY, not merely that something fired: the
 * promotion carries the waived rule's own `ruleId`, so what distinguishes it is
 * `bypassFilters` plus its message. Asserting "one violation" alone would be
 * satisfied by the ORIGINAL broken-link finding — i.e. by the waiver failing to
 * apply at all, which is a different behaviour and a different bug.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the promotion fired (fail-closed preserved) — OK
 *   0 = no promotion (the waiver bought silence — the harness treats this as fail)
 *   2 = unexpected error
 */
import { corpus, links } from '@nielspeter/eess-md'

const RULE_ID = 'probe/links-resolve'

let violations
try {
  const c = corpus({ roots: ['scripts/nonvacuity/bad-undocumented-waiver/**'] })
  violations = links(c)
    .that()
    .areInternal()
    .should()
    .resolve()
    .rule({ id: RULE_ID })
    .violations()
} catch (err) {
  console.error(`bad-undocumented-waiver: unexpected error — ${err.message}`)
  process.exit(2)
}

const promoted = violations.filter(
  (v) => v.bypassFilters === true && /states no reason/.test(v.message),
)
const plain = violations.filter((v) => v.bypassFilters !== true)

if (promoted.length === 0) {
  console.error(
    'bad-undocumented-waiver: FAIL — a reason-free waiver suppressed the finding and ' +
      'produced no configuration finding in its place. The kernel promotion is gone, and ' +
      `four dialects now accept an unjustified waiver silently. Saw ${String(violations.length)} ` +
      `violation(s), none of them the promotion.`,
  )
  process.exit(0)
}

if (plain.length > 0) {
  console.error(
    `bad-undocumented-waiver: FAIL — the waiver did not apply: ${String(plain.length)} plain ` +
      'finding(s) survived. The fixture is meant to exercise the suppress-then-promote path, ' +
      'and a directive that covers nothing tests only half of it. Check that the directive ' +
      'sits immediately above the offending line.',
  )
  process.exit(0)
}

if (promoted[0].severity !== 'error') {
  console.error(
    `bad-undocumented-waiver: FAIL — the promotion fired at severity ` +
      `"${String(promoted[0].severity)}", so it does not fail a build. ADR-009 rule 1.`,
  )
  process.exit(0)
}

// The harness keys on this phrase (`mustSay`), so it names WHAT fired, not merely
// that something did: the promotion is identified by the kernel's own message,
// which no other finding in this fixture's corpus produces.
console.error(
  'bad-undocumented-waiver: OK — promoted[states no reason] — the waiver applied (the ' +
    `broken-link finding is gone) and the kernel replaced it with ${String(promoted.length)} ` +
    'unsuppressable configuration finding(s) at severity error.',
)
process.exit(1)
