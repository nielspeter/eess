/**
 * Plan 0454: box marks are the caller's. Proposal 017's block 17 acceptance rows and bug 0445's,
 * each through `taskItems()` or `honestyAtClose()`, asserting finding ids and lines.
 */
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { isArchRuleError } from '@nielspeter/eess'
import { dedupeConfigFindings } from '@nielspeter/eess/internal'
import {
  collectTaskItems,
  corpus,
  isArchConfigError,
  taskItems,
  MALFORMED_BOX,
  UNDECLARED_BOX_MARK,
  type ArchViolation,
  type MdTaskItem,
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

const boxes = (c: ReturnType<typeof corpus>, marks?: Record<string, 'open' | 'done'>) =>
  taskItems(c, { marks })
    .select({ label: 'box', identify: (t) => ({ name: `${t.mark}@${String(t.line)}` }) })
    .elements.map((t) => `${t.mark}:${t.state}@${String(t.line)}`)

const rule = (c: ReturnType<typeof corpus>, marks?: Record<string, 'open' | 'done'>) =>
  taskItems(c, { marks }).that().areOpen().should().notExist()

describe('proposal 017 block 17: acceptance rows', () => {
  it('a done document holding an undeclared [~] reds at its line', () => {
    const found = honestyAtClose(at({ 'completed/b.md': DONE(['- [~] half']) }), {
      report: 'return',
    })
    expect(pairs(found)).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(L)}`])
  })

  it('[WIP], [1], a link and a defined reference stay green and yield no element', () => {
    const c = page([
      '- [WIP] x',
      '- [1] x',
      '- [link](u)',
      '- [ref] x',
      '',
      '[ref]: https://example.com',
    ])
    expect(boxes(c)).toEqual([])
    expect([...rule(c).violations()]).toEqual([])
  })

  it('declaring a mark clears its finding', () => {
    const files = { 'completed/b.md': DONE(['- [~] half done-otherwise: shipped differently']) }
    expect(pairs(honestyAtClose(at(files), { report: 'return' }))).toEqual([
      `${UNDECLARED_BOX_MARK} @ ${String(L)}`,
    ])
    expect([...honestyAtClose(at(files), { marks: { '~': 'open' }, report: 'return' })]).toEqual([])
  })

  // Reads this repository's live records: an edit above line 160 of bug 0249 or line 130 of bug 0256
  // moves these lines. Update the lines; do not delete the row.
  it('this repository reads its four [~] boxes once declared', () => {
    const repo = path.resolve(import.meta.dirname, '../../../..')
    const c = corpus({ cwd: repo, roots: ['work/bugs/**'] })
    const tilde = taskItems(c, { marks: { '~': 'open' } })
      .that()
      .areOpen()
      .select({ label: 'box', identify: (t) => ({ name: `${t.doc.relPath}:${String(t.line)}` }) })
      .elements.filter((t) => t.mark === '~')
      .map(
        (t) => `${t.doc.relPath.replace(/^work\/bugs\/fixed\/(\d{4}).*$/, '$1')}:${String(t.line)}`,
      )
    expect(tilde).toEqual(['0249:160', '0249:167', '0249:201', '0256:130'])
    // It walks the repository and parses every bug record: 7 s on a CI runner, past vitest's 5 s.
  }, 30_000)
})

describe('bug 0445', () => {
  it('an undeclared box is not also a silent open box', () => {
    const found = honestyAtClose(at({ 'completed/b.md': DONE(['- [~] a', '- [?] b']) }), {
      report: 'return',
    })
    expect(pairs(found)).toEqual([
      `${UNDECLARED_BOX_MARK} @ ${String(L)}`,
      `${UNDECLARED_BOX_MARK} @ ${String(L + 1)}`,
    ])
  })

  it('a done record whose boxes are all [~] reds through honestyAtClose', () => {
    const found = honestyAtClose(at({ 'completed/b.md': DONE(['- [~] a']) }), { report: 'return' })
    expect(pairs(found)).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(L)}`])
  })

  it('a done record whose boxes are all [~] reds a notExist() rule through check()', () => {
    const c = at({ 'completed/b.md': DONE(['- [~] a']) })
    let thrown: unknown
    try {
      rule(c).check()
    } catch (e) {
      thrown = e
    }
    // Emission, not only the receipt: the thrown error carries the finding itself.
    expect(isArchRuleError(thrown) ? pairs(thrown.violations) : thrown).toEqual([
      `${UNDECLARED_BOX_MARK} @ ${String(L)}`,
    ])
    expect(pairs(rule(c).violations())).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(L)}`])
  })

  it('an undeclared box carrying a deferral is not a deferral', () => {
    const c = at({ 'completed/b.md': DONE(['- [?] deferred→bug 0001', '', 'Deferred: none']) })
    expect(pairs(honestyAtClose(c, { report: 'return' }))).toEqual([
      `${UNDECLARED_BOX_MARK} @ ${String(L)}`,
    ])
  })
})

describe('a declared mark carrying a deferral (plan 0454)', () => {
  it('a declared open [~] disposed deferred→ beside Deferred: none is the deferral lie', () => {
    const c = at({ 'completed/b.md': DONE(['- [~] deferred→bug 0001', '', 'Deferred: none']) })
    expect(pairs(honestyAtClose(c, { marks: { '~': 'open' }, report: 'return' }))).toEqual([
      `ledger/deferred-none-lie @ ${String(L + 2)}`,
    ])
  })
})

describe('the builder reports what it cannot read (plan 0454)', () => {
  it('a .warn() rule carrying an unread box still fails', () => {
    expect(() => rule(page(['- [?] a'])).warn()).toThrow(/Architecture violation/)
  })

  it('a declared mark written padded is malformed, and its declaration does not clear it', () => {
    expect(pairs(rule(page(['- [ ~ ] a']), { '~': 'open' }).violations())).toEqual([
      `${MALFORMED_BOX} @ ${String(P)}`,
    ])
  })

  it('a tab or a line ending after a mark reads as GFM reads it after [x]', () => {
    const c = page(['- [~]\ttabbed', '- [~]', '  wrapped'])
    expect(boxes(c, { '~': 'open' })).toEqual([`~:open@${String(P)}`, `~:open@${String(P + 1)}`])
  })

  it("the remedy for a malformed box keeps the author's mark and offers [x] only for done work", () => {
    const [finding] = rule(page(['- [~]done'])).violations()
    expect(finding?.suggestion).toContain('`[~]`')
    expect(finding?.suggestion).toContain('Write `[x]` only if the work is done.')
  })

  it('a positive rule whose every box is unread names the boxes as the cause beside the kernel finding', () => {
    const c = page(['- [?] a'])
    const found = taskItems(c)
      .should()
      .satisfy({ description: 'anything', evaluate: () => [] })
      .violations()
    expect(
      found.map((v) => [v.ruleId === UNDECLARED_BOX_MARK ? v.ruleId : 'kernel', v.line]).sort(),
    ).toEqual([
      ['kernel', 0],
      [UNDECLARED_BOX_MARK, P],
    ])
    expect(found.find((v) => v.ruleId !== UNDECLARED_BOX_MARK)?.message).toContain(
      'examined zero units',
    )
    const mark = found.find((v) => v.ruleId === UNDECLARED_BOX_MARK)
    expect(mark?.message).toContain('They are why this rule examined nothing.')
  })

  it('a hand-written state predicate reaches an unread box', () => {
    const c = page(['- [?] a'])
    const found = taskItems(c)
      .that()
      .satisfy({ description: 'open', test: (t) => t.state === 'open' })
      .should()
      .notExist()
      .violations()
    expect(pairs(found)).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(P)}`])
  })

  it('[ ~ ] and [~]done, undeclared, are each a malformed box', () => {
    const c = page(['- [ ~ ] a', '', '- [~]done'])
    expect(pairs(rule(c).violations())).toEqual([
      `${MALFORMED_BOX} @ ${String(P)}`,
      `${MALFORMED_BOX} @ ${String(P + 2)}`,
    ])
  })

  it('a declared open [~] without a disposition is a silent open box; with one it is green', () => {
    const bare = at({ 'completed/b.md': DONE(['- [~] a']) })
    expect(pairs(honestyAtClose(bare, { marks: { '~': 'open' }, report: 'return' }))).toEqual([
      `ledger/silent-open-box @ ${String(L)}`,
    ])
    const disposed = at({ 'completed/b.md': DONE(['- [~] a dropped-on-purpose: not needed']) })
    expect([...honestyAtClose(disposed, { marks: { '~': 'open' }, report: 'return' })]).toEqual([])
  })

  it('a declared done [→] is a closed box, counted by areChecked()', () => {
    const c = at({ 'completed/b.md': DONE(['- [→] moved on']) })
    expect([...honestyAtClose(c, { marks: { '→': 'done' }, report: 'return' })]).toEqual([])
    const done = taskItems(c, { marks: { '→': 'done' } })
      .that()
      .areChecked()
      .should()
      .notExist()
      .violations()
    expect(done.map((v) => `${v.element} @ ${String(v.line)}`)).toEqual([
      `completed/b.md:${String(L)} @ ${String(L)}`,
    ])
  })

  it('a declared letter mark is read; an undeclared [o] and [v] are plain list items', () => {
    const c = page(['- [n] next', '- [o] other', '- [v] very'])
    expect(boxes(c, { n: 'open' })).toEqual([`n:open@${String(P)}`])
    expect([...rule(c, { n: 'open' }).violations()].map((v) => v.line)).toEqual([P])
  })

  it('[ x ], [x]a, an empty [ ] and an empty [x] are malformed, and marks cannot clear them', () => {
    const c = page(['- [ x ] a', '', '- [x]a', '', '- [ ]', '', '- [x]'])
    const expected = [0, 2, 4, 6].map((d) => `${MALFORMED_BOX} @ ${String(P + d)}`).sort()
    expect(pairs(rule(c).violations())).toEqual(expected)
    expect(pairs(rule(c, { '~': 'open' }).violations())).toEqual(expected)
    expect(() => taskItems(c, { marks: { x: 'open' } })).toThrow(/GFM's own/)
  })

  it('- [] is truthy stays green', () => {
    const c = page(['- [] is truthy in JS'])
    expect(boxes(c)).toEqual([])
    expect([...rule(c).violations()]).toEqual([])
  })

  it('an escaped bracket and a bracket in inline code are not marks', () => {
    const c = page(['- \\[*] a', '- `[*]` a'])
    expect(boxes(c)).toEqual([])
    expect([...rule(c).violations()]).toEqual([])
  })

  it('limit: [~] beside a link definition [~]: url yields no element, declared or not', () => {
    // mdast reads `[~]` as a reference to the definition, so it is not a box at all; pinned so a
    // change here is a decision.
    const c = page(['- [~] a', '', '[~]: https://example.com'])
    expect(boxes(c, { '~': 'open' })).toEqual([])
    expect([...rule(c).violations()]).toEqual([])
  })

  it('[…] is an undeclared mark, cleared by the escape', () => {
    expect(pairs(rule(page(['- […] quoted'])).violations())).toEqual([
      `${UNDECLARED_BOX_MARK} @ ${String(P)}`,
    ])
    expect([...rule(page(['- \\[…] quoted'])).violations()]).toEqual([])
  })

  it('a [~] nested under a GFM box, under a plain item, and in an ordered list is read', () => {
    const c = page([
      '- [ ] parent',
      '  - [~] under a box',
      '- plain',
      '  - [~] under a plain item',
      '',
      '1. [~] ordered',
    ])
    expect(boxes(c, { '~': 'done' })).toEqual([
      ` :open@${String(P)}`,
      `~:done@${String(P + 1)}`,
      `~:done@${String(P + 3)}`,
      `~:done@${String(P + 5)}`,
    ])
  })

  it('[→], [✅] and a combining sequence are each one grapheme', () => {
    const combining = 'é'
    const c = page(['- [→] a', '- [✅] b', `- [${combining}] c`])
    expect(boxes(c, { '→': 'open', '✅': 'done', [combining]: 'open' })).toEqual([
      `→:open@${String(P)}`,
      `✅:done@${String(P + 1)}`,
      `${combining}:open@${String(P + 2)}`,
    ])
  })
})

describe('scope, volume, exclusion, dedupe (plan 0454)', () => {
  const two = () =>
    at({ 'work/plans/a.md': '# A\n\n- [ ] open\n', 'docs/vendor/b.md': '# B\n\n- [?] unknown\n' })
  const inFolder = (folder: string) => ({
    description: `in ${folder}`,
    test: (t: { doc: { relPath: string } }) => t.doc.relPath.startsWith(folder),
  })

  it('a rule whose predicates exclude the document does not report its unread box; one that reaches it does', () => {
    const c = two()
    const work = taskItems(c).that().satisfy(inFolder('work/')).should().notExist().violations()
    expect(work.map((v) => `${v.element} @ ${String(v.line)}`)).toEqual(['work/plans/a.md:3 @ 3'])
    expect(
      pairs(taskItems(c).that().satisfy(inFolder('docs/')).should().notExist().violations()),
    ).toEqual([`${UNDECLARED_BOX_MARK} @ 3`])
  })

  it('areOpen() and areChecked() both report an unread box', () => {
    const c = page(['- [?] a'])
    for (const r of [taskItems(c).that().areOpen(), taskItems(c).that().areChecked()]) {
      expect(pairs(r.should().notExist().violations())).toEqual([
        `${UNDECLARED_BOX_MARK} @ ${String(P)}`,
      ])
    }
  })

  it('three undeclared [?] in one document are one finding naming three lines', () => {
    const found = rule(page(['- [?] a', '- [?] b', '- [?] c'])).violations()
    expect(pairs(found)).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(P)}`])
    expect(found[0]?.message).toContain(
      `3 boxes, lines ${String(P)}, ${String(P + 1)} and ${String(P + 2)}`,
    )
  })

  it("excluding the finding's element does not hide it", () => {
    const c = page(['- [?] a'])
    const found = rule(c).excluding('docs/page.md [?]').violations()
    expect(pairs(found)).toEqual([`${UNDECLARED_BOX_MARK} @ ${String(P)}`])
    expect(found[0]?.bypassFilters).toBe(true)
  })

  it('two rules over one corpus give one finding per cause after dedupe', () => {
    const c = page(['- [?] a', '- [ x ] b'])
    const merged = dedupeConfigFindings([
      ...taskItems(c).that().areOpen().should().notExist().violations(),
      ...taskItems(c).that().areChecked().should().notExist().violations(),
    ])
    const ids = merged.filter((v) => v.ruleId === UNDECLARED_BOX_MARK || v.ruleId === MALFORMED_BOX)
    expect(ids.map((v) => v.ruleId).sort()).toEqual([MALFORMED_BOX, UNDECLARED_BOX_MARK])
  })
})

describe('a rule cannot select an unread state (plan 0454)', () => {
  it("a taskItems() element's state is open, done or unjudged, never unread, so comparing it with undeclared does not compile", () => {
    // `npm run typecheck` holds this row: an unused @ts-expect-error is TS2578.
    // @ts-expect-error a rule never sees an unread state; test `t.mark` to select an undeclared box
    const unreadState = (t: MdTaskItem): boolean => t.state === 'undeclared'
    const byMark = (t: MdTaskItem): boolean => t.mark === '?'
    expect(
      [
        ...taskItems(page(['- [?] a']))
          .that()
          .satisfy({ description: 'by mark', test: byMark })
          .should()
          .notExist()
          .violations(),
      ].map((v) => v.ruleId),
    ).toEqual([UNDECLARED_BOX_MARK])
    expect(typeof unreadState).toBe('function')
  })
})

describe('the model and the declaration (plan 0454)', () => {
  it('collectTaskItems yields an undeclared box with checked false, and checked is state done throughout', () => {
    const c = page(['- [ ] a', '- [x] b', '- [?] c', '- [~] d', '- [ x ] e'])
    const doc = c.documents()[0]
    expect(doc).toBeDefined()
    if (doc === undefined) return
    const items = collectTaskItems(doc.root, { marks: { '~': 'done' }, source: doc.text })
    expect(items.map((t) => `${t.mark}:${t.state}:${String(t.checked)}`)).toEqual([
      ' :open:false',
      'x:done:true',
      '?:undeclared:false',
      '~:done:true',
      'x:malformed:false',
    ])
    for (const t of items) expect(t.checked).toBe(t.state === 'done')
  })

  const refused: [string, Record<string, unknown>, RegExp][] = [
    ['two characters', { ab: 'open' }, /'ab' is not one grapheme/],
    ['a space', { ' ': 'open' }, /' ' is GFM's own/],
    ['x', { x: 'done' }, /'x' is GFM's own/],
    ['X', { X: 'done' }, /'X' is GFM's own/],
    ['a state other than open, done or unjudged', { '~': 'half' }, /'~' is declared "half"/],
    ['a bracket', { ']': 'open' }, /"\]" can never be read as a mark/],
    ['a tab', { '\t': 'open' }, /"\\t" can never be read as a mark/],
  ]
  for (const [what, marks, says] of refused) {
    it(`a declaration with ${what} is refused, naming the key`, () => {
      let thrown: unknown
      try {
        // @ts-expect-error a wrong state is what this row refuses
        honestyAtClose(page(['- [ ] a']), { marks, report: 'return' })
      } catch (e) {
        thrown = e
      }
      expect(isArchConfigError(thrown)).toBe(true)
      expect(String(thrown)).toMatch(says)
    })
  }
})
