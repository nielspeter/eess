/**
 * Bug 0525: a box mark could be declared only `'open'` or `'done'`. A corpus whose `[?]` boxes mean
 * "neither, on purpose" had no honest declaration: `'open'` made each one a silent open box, and
 * `'done'` claimed a verification that never happened. A mark declared `'unjudged'` is a box no close
 * rule judges, still an element a rule can select by its mark or its state.
 */
import { describe, it, expect } from 'vitest'
import {
  collectTaskItems,
  corpus,
  isArchConfigError,
  taskItems,
  UNDECLARED_BOX_MARK,
  type ArchViolation,
} from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'
import { tree } from '../helpers/tree.js'

const DONE = (body: readonly string[]): string =>
  ['# Bug 1', '', '- **State:** Done', '', ...body, ''].join('\n')
/** Line of the first body line in a {@link DONE} record. */
const L = 5

const pairs = (found: readonly ArchViolation[]): string[] =>
  found.map((v) => `${v.ruleId ?? v.rule} @ ${String(v.line)}`).sort()

const at = (files: Readonly<Record<string, string>>) =>
  corpus({ cwd: tree(files), roots: ['**/*.md'] })
const page = (body: readonly string[]) =>
  at({ 'docs/page.md': ['# Page', '', ...body, ''].join('\n') })
/** Line of the first body line in a {@link page}. */
const P = 3

const UNJUDGED = { '?': 'unjudged' } as const

describe('a mark declared unjudged (bug 0525)', () => {
  it('in a done record it is neither a silent open box nor an undeclared mark', () => {
    const c = at({ 'completed/b.md': DONE(['- [?] asked, not verified', '- [ ] c']) })
    expect(pairs(honestyAtClose(c, { marks: UNJUDGED, report: 'return' }))).toEqual([
      `ledger/silent-open-box @ ${String(L + 1)}`,
    ])
  })

  it('a done record whose boxes are all unjudged is green through honestyAtClose', () => {
    const c = at({ 'completed/b.md': DONE(['- [?] a', '- [?] b']) })
    expect([...honestyAtClose(c, { marks: UNJUDGED, report: 'return' })]).toEqual([])
  })

  it('an unjudged box carrying a deferral is not a deferral', () => {
    const c = at({ 'completed/b.md': DONE(['- [?] a deferred→0001', '', 'Deferred: none']) })
    expect([...honestyAtClose(c, { marks: UNJUDGED, report: 'return' })]).toEqual([])
  })

  it('areOpen() and areChecked() do not select an unjudged box', () => {
    const c = page(['- [?] a', '- [ ] b', '- [x] c'])
    const lines = (b: ReturnType<typeof taskItems>): number[] =>
      b
        .select({ label: 'box', identify: (t) => ({ name: String(t.line) }) })
        .elements.map((t) => t.line)
    expect(lines(taskItems(c, { marks: UNJUDGED }).that().areOpen())).toEqual([P + 1])
    expect(lines(taskItems(c, { marks: UNJUDGED }).that().areChecked())).toEqual([P + 2])
  })

  it('an unjudged box is still an element, selected by its state or by its mark', () => {
    const c = page(['- [?] a', '- [ ] b'])
    const byState = taskItems(c, { marks: UNJUDGED })
      .that()
      .satisfy({ description: 'unjudged', test: (t) => t.state === 'unjudged' })
      .should()
      .notExist()
      .violations()
    expect(byState.map((v) => `${v.element} @ ${String(v.line)}`)).toEqual([
      `docs/page.md:${String(P)} @ ${String(P)}`,
    ])
    const byMark = taskItems(c, { marks: UNJUDGED })
      .that()
      .satisfy({ description: 'marked ?', test: (t) => t.mark === '?' })
      .should()
      .notExist()
      .violations()
    expect(byMark.map((v) => v.line)).toEqual([P])
    expect(byMark.map((v) => v.ruleId)).not.toContain(UNDECLARED_BOX_MARK)
  })

  it('collectTaskItems yields it with state unjudged and checked false', () => {
    const doc = page(['- [?] a']).documents()[0]
    expect(doc).toBeDefined()
    if (doc === undefined) return
    const items = collectTaskItems(doc.root, { marks: UNJUDGED, source: doc.text })
    expect(items.map((t) => `${t.mark}:${t.state}:${String(t.checked)}`)).toEqual([
      '?:unjudged:false',
    ])
  })
})

describe('unjudged is declared, never a default (bug 0525, ADR-009)', () => {
  it('collectTaskItems reads only own marks, so an inherited state cannot be forged', () => {
    const doc = page(['- [~] a']).documents()[0]
    expect(doc).toBeDefined()
    if (doc === undefined) return
    // An untyped caller's marks with the state on the prototype: validation sees no own key.
    const forged: Record<string, unknown> = {}
    Reflect.setPrototypeOf(forged, { '~': 'bogus' })
    // @ts-expect-error a forged state is what this row refuses
    const items = collectTaskItems(doc.root, { marks: forged, source: doc.text })
    expect(items.map((t) => `${t.mark}:${t.state}`)).toEqual(['~:undeclared'])
  })

  it('an undeclared [?] beside a mark declared unjudged is still a finding', () => {
    const c = at({ 'completed/b.md': DONE(['- [~] a', '- [?] b']) })
    expect(pairs(honestyAtClose(c, { marks: { '~': 'unjudged' }, report: 'return' }))).toEqual([
      `${UNDECLARED_BOX_MARK} @ ${String(L + 1)}`,
    ])
  })

  it('a predicate selecting the unjudged state reaches an undeclared box', () => {
    const found = taskItems(page(['- [?] a']))
      .that()
      .satisfy({ description: 'unjudged', test: (t) => t.state === 'unjudged' })
      .should()
      .notExist()
      .violations()
    expect(pairs(found)).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(P)}`])
  })

  it("the undeclared mark's remedy names unjudged beside open and done", () => {
    const found = taskItems(page(['- [?] a']))
      .should()
      .notExist()
      .violations()
    const mark = found.find((v) => v.ruleId === UNDECLARED_BOX_MARK)
    expect(mark?.suggestion).toContain("'unjudged'")
    // The remedy states the cost in the sentence that offers it (release review, enforcement I3).
    expect(mark?.suggestion).toMatch(/'unjudged' only if it never blocks a close in any record/)
  })

  const refused: [string, Record<string, unknown>][] = [
    ['an undefined state', { '?': undefined }],
    ['a state in another letter case', { '?': 'Unjudged' }],
    ['a boolean', { '?': false }],
    ['null', { '?': null }],
  ]
  for (const [what, marks] of refused) {
    it(`a declaration with ${what} is refused, naming the three states`, () => {
      for (const call of [
        // @ts-expect-error a wrong state is what this row refuses
        () => taskItems(page(['- [?] a']), { marks }),
        // @ts-expect-error a wrong state is what this row refuses
        () => honestyAtClose(page(['- [?] a']), { marks, report: 'return' }),
        () => {
          const doc = page(['- [?] a']).documents()[0]
          // @ts-expect-error a wrong state is what this row refuses
          if (doc !== undefined) collectTaskItems(doc.root, { marks, source: doc.text })
        },
      ]) {
        let thrown: unknown
        try {
          call()
        } catch (e) {
          thrown = e
        }
        expect(isArchConfigError(thrown)).toBe(true)
        expect(String(thrown)).toMatch(/declare it 'open', 'done' or 'unjudged'/)
      }
    })
  }
})
