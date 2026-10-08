#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — plan 0405's declaration findings. A rule built with
 * `links().that().areLabelled()` / `.areInSection()` must report a declaration
 * it cannot read, on that declaration's own file and with its own message:
 *
 *   label-near-miss       bad-declared-block/label.md writes `**Related To:**`
 *                         beside a declared "Related to" → "the label … is not
 *                         the declared …".
 *   section-near-miss     bad-declared-block/section.md has `## See Also` beside a
 *                         declared "See also" → "the heading … is not the
 *                         declared section …".
 *   unreadable-declaration bad-declared-block/unreadable.md holds a "Related to"
 *                         block of reference-style links → "… holds
 *                         reference-style links …".
 *   empty-declaration     bad-declared-block/empty.md declares "Related to" with
 *                         text and no link → "… names no record".
 *   mid-paragraph         bad-declared-block/mid-paragraph.md has `**Related To:**`
 *                         on a paragraph's second line → "… is inside a
 *                         paragraph, not at its start".
 *   nested-declaration    bad-declared-block/nested.md nests `**Related To:**`
 *                         under a list item whose line holds a colon, under a
 *                         `Metadata:` label — the shape whose parent once
 *                         swallowed the label unread (plan 0405's review) →
 *                         "the label … is not the declared …" on that file.
 *
 * Each document also carries a correctly declared, resolving link, so the rule
 * examines something and the zero-examined finding cannot stand in for the one
 * the scenario names. The finding is matched on message AND file, not on the
 * rule id: all three kinds share the rule's id, so an id match would let any
 * one of them answer for the other two (bug 0110's class).
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the named finding was reported on the named file — OK
 *   0 = not reported (the check is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or an unknown scenario — the harness treats this as fail
 */
import { corpus, links } from '@nielspeter/eess-md'

const ROOT = 'scripts/nonvacuity/bad-declared-block'
const SCENARIOS = {
  'label-near-miss': {
    file: `${ROOT}/label.md`,
    declare: (b) => b.areLabelled('Related to'),
    says: 'the label "Related To" is not the declared "Related to"',
  },
  'section-near-miss': {
    file: `${ROOT}/section.md`,
    declare: (b) => b.areInSection('See also'),
    says: 'the heading "See Also" is not the declared section "See also"',
  },
  'unreadable-declaration': {
    file: `${ROOT}/unreadable.md`,
    declare: (b) => b.areLabelled('Related to'),
    says: 'the "Related to" declaration holds reference-style links',
  },
  'empty-declaration': {
    file: `${ROOT}/empty.md`,
    declare: (b) => b.areLabelled('Related to'),
    says: 'the "Related to" declaration names no record',
  },
  'mid-paragraph': {
    file: `${ROOT}/mid-paragraph.md`,
    declare: (b) => b.areLabelled('Related to'),
    says: 'the label "Related To" is inside a paragraph, not at its start',
  },
  'nested-declaration': {
    file: `${ROOT}/nested.md`,
    declare: (b) => b.areLabelled('Related to'),
    says: 'the label "Related To" is not the declared "Related to"',
  },
}

const name = process.argv[2]
const scenario = SCENARIOS[name]
if (scenario === undefined) {
  console.error(`bad-declared-block: unknown scenario "${name}" — expected one of ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(2)
}

let violations
try {
  const c = corpus({ roots: [`${ROOT}/**`] })
  violations = scenario
    .declare(links(c).that())
    .should()
    .resolve()
    .rule({ id: 'nonvacuity/declared-block' })
    .violations()
} catch (err) {
  console.error(`bad-declared-block: unexpected error — ${String(err)}`)
  process.exit(2)
}

const hit = violations.filter(
  (v) => v.message.includes(scenario.says) && v.file.endsWith(scenario.file),
)
if (hit.length > 0) {
  console.error(`bad-declared-block: ${name}: reported on ${scenario.file} as expected`)
  for (const v of hit) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(1)
}

console.error(
  `bad-declared-block: ${name}: NOT reported on ${scenario.file} — the check is vacuous ` +
    `(${violations.length} other violation(s): ${violations.map((v) => `${v.file}: ${v.message.split('\n')[0]}`).join(' | ') || 'none'})`,
)
process.exit(0)
