/**
 * Adopter 3's three rules for its closed folders (proposal 017, "Adopter 3's section input"), from
 * public blocks: (a) an open box under acceptance is only done-otherwise or validation-owed; (b) no
 * box under open questions stays open; (c) done-otherwise hides no deferral, even one written on the
 * box's second line (bug 0507).
 *
 * Each section name and selecting pattern is bound once, to a const the rule and its guards read:
 * a typo reaches both, so the existence guard reds; one record's drifted heading is caught by the
 * per-document guard, which holds because every closed record carries both sections. A pattern used to exclude (`DISPOSED`) fails closed
 * when misspelt and needs no guard. `DEFERRAL` selects and has none: a clean corpus may hold no
 * deferral at all, so a guard on it would red on a clean corpus. A typo in it, or the adopter's
 * notation drifting from it (`deferred to record 3`), stays green.
 */
import {
  corpus,
  docs,
  haveTextMatching,
  inDocuments,
  inSections,
  not,
  resideInFolder,
  sectionsNamed,
  taskItems,
} from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'open-boxes-in-closed-records'
const load = (cwd: string) => corpus({ cwd, roots: ['records/**/*.md'] })

const IN_CLOSED = resideInFolder('records/closed/**')
const ACCEPTANCE = /^Acceptance/
const OPEN_QUESTIONS = /^Open questions$/i
const DISPOSED = /\b(done-otherwise|validation-owed)\b/
const DONE_OTHERWISE = /\bdone-otherwise\b/
const DEFERRAL = /deferred\s*(?:→|->|:)/

// (a) An open box under acceptance is only done-otherwise or validation-owed.
const undisposed = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .areOpen()
    .and()
    .satisfy(inDocuments(IN_CLOSED))
    .and()
    .satisfy(inSections(sectionsNamed(ACCEPTANCE)))
    .and()
    .satisfy(not(haveTextMatching(DISPOSED)))
    .should()
    .notExist()
const acceptanceGuard = (cwd: string) =>
  docs(load(cwd)).that().satisfy(IN_CLOSED).haveSection(ACCEPTANCE).should().haveSection(ACCEPTANCE)

// (b) No box under open questions stays open.
const openQuestion = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .areOpen()
    .and()
    .satisfy(inDocuments(IN_CLOSED))
    .and()
    .satisfy(inSections(sectionsNamed(OPEN_QUESTIONS)))
    .should()
    .notExist()
const questionsGuard = (cwd: string) =>
  docs(load(cwd))
    .that()
    .satisfy(IN_CLOSED)
    .haveSection(OPEN_QUESTIONS)
    .should()
    .haveSection(OPEN_QUESTIONS)

// The per-document guards: every closed record has both sections. Where the convention holds, they
// catch one record whose heading drifted while the others are spelled right; the guards above only
// catch a section no closed record has.
const everyRecordHas = (cwd: string, section: RegExp) =>
  docs(load(cwd)).that().satisfy(IN_CLOSED).should().haveSection(section)

// (c) done-otherwise hides no deferral.
const hiddenDeferral = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .satisfy(inDocuments(IN_CLOSED))
    .and()
    .haveTextMatching(DONE_OTHERWISE)
    .and()
    .haveTextMatching(DEFERRAL)
    .should()
    .notExist()
// Its guard: some closed box carries done-otherwise. docs() cannot say "a box with this text
// exists", so the guard is a taskItems() rule of the same tautology shape.
const doneOtherwiseGuard = (cwd: string) =>
  taskItems(load(cwd))
    .that()
    .satisfy(inDocuments(IN_CLOSED))
    .haveTextMatching(DONE_OTHERWISE)
    .should()
    .haveTextMatching(DONE_OTHERWISE)

const all = (cwd: string) => [
  undisposed(cwd).violations(),
  acceptanceGuard(cwd).violations(),
  openQuestion(cwd).violations(),
  questionsGuard(cwd).violations(),
  hiddenDeferral(cwd).violations(),
  doneOtherwiseGuard(cwd).violations(),
  everyRecordHas(cwd, ACCEPTANCE).violations(),
  everyRecordHas(cwd, OPEN_QUESTIONS).violations(),
]

describe('open boxes in closed records', () => {
  it('clean: every rule and every guard holds; the open record is out of scope', () => {
    const results = all(fixture(NAME, 'clean'))
    expect(results.map((v) => v.length)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    // The existence guards examined something: both closed records have both sections, and one
    // has a done-otherwise box.
    expect([1, 3, 5].map((i) => results[i]?.examined)).toEqual([2, 2, 1])
  })

  it('violating-undisposed-acceptance-box: (a) names the box and its section', () => {
    const v = undisposed(fixture(NAME, 'violating-undisposed-acceptance-box')).violations()
    expect(v.map((x) => x.message)).toEqual([
      'records/closed/0001-import.md:5 should not exist (under "Acceptance", line 3)',
    ])
  })

  it('violating-open-question: (b) names the open question', () => {
    const v = openQuestion(fixture(NAME, 'violating-open-question')).violations()
    expect(v.map((x) => x.message)).toEqual([
      'records/closed/0001-import.md:11 should not exist (under "Open questions", line 9)',
    ])
  })

  it('violating-done-otherwise-hides-a-deferral: (c) reads the deferral on the box’s second line', () => {
    const v = hiddenDeferral(
      fixture(NAME, 'violating-done-otherwise-hides-a-deferral'),
    ).violations()
    expect(v.map((x) => x.element)).toEqual(['records/closed/0001-import.md:6'])
  })

  it('violating-misspelt-pattern: notation drifted from DONE_OTHERWISE; (c) is green and its guard reds', () => {
    const cwd = fixture(NAME, 'violating-misspelt-pattern')
    expect(hiddenDeferral(cwd).violations()).toHaveLength(0)
    const v = doneOtherwiseGuard(cwd).violations()
    expect(v.examined).toBe(0)
    expect(v[0]?.message).toMatch(/^this rule examined zero units/)
  })

  it('violating-section-drift: one closed record writes "Open questoins"; (b) and its existence guard stay green, the per-document guard reds', () => {
    const cwd = fixture(NAME, 'violating-section-drift')
    // Its open question is never judged.
    expect(openQuestion(cwd).violations()).toHaveLength(0)
    expect(questionsGuard(cwd).violations()).toHaveLength(0)
    const v = everyRecordHas(cwd, OPEN_QUESTIONS).violations()
    expect(v.map((x) => `${x.element}: ${x.message}`)).toEqual([
      'records/closed/0001-import.md: missing section "/^Open questions$/i"',
    ])
  })
})
