#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `scripts/lib/proposal-ruling.mjs`'s own exports,
 * tested directly against constructed inputs (the `corpus-link-routing.mjs`/
 * `lane-coverage.mjs` shape). The three end-to-end `gateCorpusProbe` rows in
 * `check-nonvacuity.mjs` prove the module is wired to the production script;
 * this fixture proves the module's own behavior on shapes those three probes
 * don't individually exercise — found missing by a branch review's own
 * mutation matrix (2026-08-14): last-Ruling-wins scoping, the markdown-link
 * `**Implements:**` form, fence-blindness, and the multi-`**Implements:**`
 * fix, each of which survived being mutated away with every other fixture
 * still green.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every direction below holds — OK
 *   0 = at least one direction failed — the module regressed
 *   2 = unexpected error, or the fixture's own premise broke
 */
import {
  operativeRuling,
  hasUnparseableRuling,
  declaredImplements,
  hasUnparseableImplements,
  proposalNumberFromPath,
} from '../lib/proposal-ruling.mjs'

let failures = []
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
  }
}

// Direction 1 — multi-round scoping: the LAST Ruling line wins, not the
// first. A proposal reviewed twice (005's real shape) must read its most
// recent verdict.
check(
  'last-Ruling-wins',
  operativeRuling(
    '## Review — r1\n\n**Ruling: Reject**\n\ntext\n\n## Review — r2\n\n**Ruling: Ship as-is**\n',
  ),
  'Ship as-is',
)

// Direction 2 — the markdown-link `**Implements:**` form (this repo's own
// house style for every other cross-lane reference) must parse.
check(
  'markdown-link Implements',
  declaredImplements('- **Implements:** [proposal 004](../proposals/004-x.md)\n'),
  '4',
)

// Direction 3 — fence-blindness: an illustrative Ruling/Implements line
// inside a fenced code block must never be read as a live declaration. Both
// proposals filed to date (001, 005) preserve their submission body below
// the operative review, so an unfenced example would silently misclassify.
const fencedRuling = '```markdown\n**Ruling: Ship as-is**\n```\n\nNo real review here.\n'
check('fenced Ruling ignored', operativeRuling(fencedRuling), null)
check('fenced Ruling not flagged unparseable', hasUnparseableRuling(fencedRuling), false)
const fencedImplements = '```markdown\n**Implements:** proposal 4\n```\n\nNo real line here.\n'
check('fenced Implements ignored', declaredImplements(fencedImplements), null)

// Direction 4 — a plan declaring two `**Implements:**` lines resolves to
// neither (a plan is a single-key join input), and IS flagged — not a
// silent pick-the-first (branch review: product, customer, testing).
const twoImplements = '- **Implements:** proposal 002\n- **Implements:** proposal 005\n'
check('two Implements lines → null', declaredImplements(twoImplements), null)
check('two Implements lines → flagged', hasUnparseableImplements(twoImplements), true)

// Direction 5 — a garbled Ruling/Implements line is a finding, never
// reviewed at all is not.
check('garbled Ruling flagged', hasUnparseableRuling('**Ruling: ship as-is — old style**\n'), true)
check('no Ruling at all, not flagged', hasUnparseableRuling('## Problem\n\ntext\n'), false)
check(
  'garbled Implements flagged',
  hasUnparseableImplements('- **Implements:** prop 004\n'),
  true,
)
check('no Implements at all, not flagged', hasUnparseableImplements('plain text\n'), false)

// Direction 6 — bulleted/blockquoted/indented labels parse on both sides
// (branch review's second round: architect, customer both independently).
check('bulleted Ruling', operativeRuling('- **Ruling: Ship as-is**\n'), 'Ship as-is')
check('blockquoted Ruling', operativeRuling('> **Ruling: Ship as-is**\n'), 'Ship as-is')
check('indented Ruling', operativeRuling('  **Ruling: Ship as-is**\n'), 'Ship as-is')

// Direction 7 — proposal number extraction, zero-padding normalized.
check('proposalNumberFromPath', proposalNumberFromPath('work/proposals/002-x.md'), '2')
check('proposalNumberFromPath no digits', proposalNumberFromPath('work/proposals/PROPOSALS.md'), null)

if (failures.length > 0) {
  console.error(`bad-proposal-ruling: ${failures.length} check(s) failed:`)
  for (const f of failures) console.error(`  x ${f}`)
  process.exit(0)
}

console.error(
  'bad-proposal-ruling: proposal-ruling/module-behavior — last-Ruling-wins, markdown-link ' +
    'Implements, fence-blindness, multi-Implements rejection, garbled-vs-absent, and label ' +
    'prefix tolerance all hold',
)
process.exit(1)
