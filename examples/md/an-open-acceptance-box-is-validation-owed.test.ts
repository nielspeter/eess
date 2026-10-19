/**
 * Adopter 1's rule (proposal 017, blocks 11, 12 and 18 composed): in a closed record, an open box
 * under the acceptance criteria may carry only `validation-owed`. `inDocuments` limits the boxes to
 * closed records, `inSections` to the acceptance criteria and every section inside them, and
 * `haveTextMatching` reads what each box says, in the adopter's own words.
 *
 * The ratchet is an absence rule, and an absence rule whose section scope matches nothing is green
 * (ADR-010 §3). Two guards stand beside it, each reading the section name from the ratchet's const:
 * one reds when no closed record has the section (a typo in the const), the other when any closed
 * record lacks it (one record's heading drifted), which holds here because every closed record
 * carries the section.
 */
import {
  corpus,
  docs,
  haveTextMatching,
  inDocuments,
  inSections,
  not,
  predicateHaveField,
  sectionsNamed,
  taskItems,
} from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'an-open-acceptance-box-is-validation-owed'
const load = (cwd: string) => corpus({ cwd, roots: ['plans/**/*.md'] })

const CLOSED = predicateHaveField({ label: 'Status', forms: ['bold'], oneOf: /^(done|closed)$/i })
const ACCEPTANCE = /^Acceptance criteria$/i
const VALIDATION_OWED = /\bvalidation-owed\b/

const ratchet = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .areOpen()
    .and()
    .satisfy(inDocuments(CLOSED))
    .and()
    .satisfy(inSections(sectionsNamed(ACCEPTANCE)))
    .and()
    .satisfy(not(haveTextMatching(VALIDATION_OWED)))
    .should()
    .notExist()
    .because('a closed record leaves acceptance work open only when its validation is owed')

// The guard: some closed record has the section. The condition repeats the selection on purpose: it
// fails only when nothing is selected.
const guard = (cwd: string) =>
  docs(load(cwd))
    .that()
    .satisfy(CLOSED)
    .haveSection(ACCEPTANCE)
    .should()
    .haveSection(ACCEPTANCE)
    .rule({ id: 'acceptance/guard' })

// The per-document guard: every closed record has the section. Where the convention holds, this is
// what catches one record whose heading drifted while others are spelled right; the guard above
// only catches a section no closed record has.
const everyClosedRecord = (cwd: string) =>
  docs(load(cwd))
    .that()
    .satisfy(CLOSED)
    .should()
    .haveSection(ACCEPTANCE)
    .rule({ id: 'acceptance/every-closed-record' })

describe('an open acceptance box in a closed record is validation-owed', () => {
  it('clean: the open acceptance box says validation-owed; the Notes box and the open plan are out of scope', () => {
    const cwd = fixture(NAME, 'clean')
    expect(ratchet(cwd).violations()).toHaveLength(0)
    const guarded = guard(cwd).violations()
    expect(guarded).toHaveLength(0)
    expect(guarded.examined).toBe(2)
    expect(everyClosedRecord(cwd).violations()).toHaveLength(0)
  })

  it('violating-open-acceptance-box: an open box under a subsection of the criteria is reported, naming the section', () => {
    const cwd = fixture(NAME, 'violating-open-acceptance-box')
    const v = ratchet(cwd).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('plans/0001-login.md:12')
    expect(finding?.file).toContain('violating-open-acceptance-box')
    expect(finding?.message).toBe(
      'plans/0001-login.md:12 should not exist (under "Acceptance criteria", line 5)',
    )
    expect(guard(cwd).violations()).toHaveLength(0)
    expect(everyClosedRecord(cwd).violations()).toHaveLength(0)
  })

  it('violating-misspelt-section: one closed record’s heading drifted; the ratchet and the existence guard stay green, the per-document guard reds', () => {
    const cwd = fixture(NAME, 'violating-misspelt-section')
    // The drifted record holds an open box without the token, and nothing judges it.
    expect(ratchet(cwd).violations()).toHaveLength(0)
    // Another closed record has the section, so the existence guard holds.
    expect(guard(cwd).violations()).toHaveLength(0)
    const v = everyClosedRecord(cwd).violations()
    expect(v.map((x) => `${x.element}: ${x.message}`)).toEqual([
      'plans/0001-login.md: missing section "/^Acceptance criteria$/i"',
    ])
  })
})
