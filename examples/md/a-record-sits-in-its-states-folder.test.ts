/**
 * A record's state and the folder it sits in say the same thing (proposal 017, block 5): three
 * shapes, one per adopter. Each reads the Status in the record's header only (`region: 'header'`),
 * because each adopter's records carry other status lines further down: a register of feedback
 * items, per-phase status lines. The values are a closed set within the bound folders: a value no group
 * names, in a folder a group binds, is reported as a misspelling.
 *
 * - **One direction** (`issues/`): a closed folder must not hold a live value. The rule selects the
 *   closed folder and reads folder → value; a closed issue left in `issues/` is not this rule's.
 * - **Both directions** (`bugs/`): a fixed bug sits in `bugs/fixed/`, and nothing else does.
 * - **Adopter 3** (`records/`): a live record must not say Done. The rule selects the live folder and
 *   reads value → folder, so the frozen records under `records/done/`, whatever they say, are not
 *   read.
 */
import { corpus, docs, type DocsRuleBuilder } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture, type FixtureKind } from './fixture.js'

const NAME = 'a-record-sits-in-its-states-folder'

const issues = (cwd: string): DocsRuleBuilder =>
  docs(corpus({ cwd, roots: ['issues/**'] }))
    .that()
    .resideInFolder('issues/closed/**')
    .should()
    .agreeWithFolder({
      field: { label: 'Status', forms: ['bold'], region: 'header' },
      groups: [
        { values: ['open', 'in progress'], folders: 'rest' },
        { values: ['closed', "won't fix"], folders: ['issues/closed/**'] },
      ],
      direction: 'right-to-left', // folder → value
    })
    .because('a closed issue that says open reads as finished work')

const bugs = (cwd: string): DocsRuleBuilder =>
  docs(corpus({ cwd, roots: ['bugs/**'] }))
    .that()
    .resideInFolder('bugs/**')
    .should()
    .agreeWithFolder({
      field: { label: 'Status', forms: ['bold'], region: 'header' },
      groups: [
        { values: ['open', 'in progress'], folders: 'rest' },
        { values: ['fixed'], folders: ['bugs/fixed/**'] },
      ],
      direction: 'both', // value → folder and folder → value
    })
    .because('a bug is fixed exactly when it sits in bugs/fixed/')

const records = (cwd: string): DocsRuleBuilder =>
  docs(corpus({ cwd, roots: ['records/**'] }))
    .that()
    .resideInFolder('records/*.md')
    .should()
    .agreeWithFolder({
      field: { label: 'Status', forms: ['heading', 'bold'], region: 'header' },
      groups: [
        { values: ['Open', 'In progress'], folders: 'rest' },
        { values: ['Done'], folders: ['records/done/**'] },
      ],
      direction: 'left-to-right', // value → folder
    })
    .because('a done record is moved to records/done/')

const said = (rule: DocsRuleBuilder): string[] =>
  rule.violations().map((v) => `${v.element}: ${v.message}`)
const at = (kind: FixtureKind): string => fixture(NAME, kind)

describe('a record sits in its state’s folder', () => {
  it('clean: one direction, a closed folder holds closed issues; its register is not read', () => {
    const v = issues(at('clean')).violations()
    expect(v).toHaveLength(0)
    // The two issues in issues/closed/, each judged; the closed issue in issues/ is not selected.
    expect(v.examined).toBe(2)
  })

  it('clean: both directions, fixed bugs in bugs/fixed/ and open ones outside it', () => {
    const v = bugs(at('clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(3)
  })

  it('clean: adopter 3, live records say Open or In progress, frozen spellings unread', () => {
    const v = records(at('clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(2)
  })

  it('violating-open-in-closed: an open issue in the closed folder belongs outside it', () => {
    expect(said(issues(at('violating-open-in-closed')))).toEqual([
      "issues/closed/12.md:3: wrong folder: `open` (Status, line 3) belongs outside issues/closed/**; issues/closed/12.md is in closed's folders. Move it or change the value.",
    ])
  })

  it('violating-no-status: an issue in the closed folder with no Status is reported', () => {
    expect(said(issues(at('violating-no-status')))).toEqual([
      "issues/closed/14.md: issues/closed/14.md is in closed's folders and has no Status field (read as bold); its labels: Owner",
    ])
  })

  it('violating-misplaced-both-ways: a fixed bug left live and an open one filed fixed', () => {
    expect(said(bugs(at('violating-misplaced-both-ways')))).toEqual([
      "bugs/8.md:3: wrong folder: `fixed` (Status, line 3) belongs in bugs/fixed/**; bugs/8.md is in open's folders ('rest'). Move it or change the value.",
      "bugs/fixed/5.md:3: wrong folder: `open` (Status, line 3) belongs outside bugs/fixed/**; bugs/fixed/5.md is in fixed's folders. Move it or change the value.",
    ])
  })

  it('violating-live-done: a live record that says Done belongs in records/done/', () => {
    expect(said(records(at('violating-live-done')))).toEqual([
      "records/r2.md:3: wrong folder: `Done` (Status, line 3) belongs in records/done/**; records/r2.md is in Open's folders ('rest'). Move it or change the value.",
    ])
  })

  it('violating-misspelt-live: a live record with a value no group names is a misspelling', () => {
    expect(said(records(at('violating-misspelt-live')))).toEqual([
      'records/r2.md:3: `Opne` at line 3 is none of the declared values (Open, In progress, Done); fix the spelling, or add it to a group',
    ])
  })
})
