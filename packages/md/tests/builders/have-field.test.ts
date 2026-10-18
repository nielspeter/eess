/**
 * Plan 0469: `haveField`, a document has a value. The resolver's outcomes, each message word for
 * word, and every unreadable cause reported in either position, through the public `docs()`.
 */
import { describe, it, expect } from 'vitest'
import { corpus, docs, type ArchViolation, type HaveFieldOptions } from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const one = (lines: readonly string[], path = 'bugs/b.md') =>
  corpus({ cwd: tree({ [path]: [...lines, ''].join('\n') }), roots: ['**/*.md'] })
const spec = (extra: Partial<HaveFieldOptions> = {}): HaveFieldOptions => ({
  label: 'Status',
  forms: ['bold', 'heading'],
  ...extra,
})
const said = (found: readonly ArchViolation[]): string[] =>
  found.filter((v) => v.line > 0).map((v) => `${v.element}: ${v.message}`)
/** The documents a `haveField` selector keeps. */
const selected = (c: ReturnType<typeof corpus>, s: HaveFieldOptions): string[] =>
  docs(c)
    .that()
    .haveField(s)
    .select({ label: 'doc', identify: (d) => ({ name: d.relPath }) })
    .elements.map((d) => d.relPath)
const asCondition = (c: ReturnType<typeof corpus>, s: HaveFieldOptions) =>
  said(docs(c).should().haveField(s).violations())

describe('the resolver (plan 0469)', () => {
  it('one structured occurrence resolves the value', () => {
    expect(selected(one(['# B', '', '**Status:** open']), spec())).toEqual(['bugs/b.md'])
  })

  it('a structured field beats an earlier plain one, and the disagreeing prose is reported', () => {
    const c = one(['# B', '', 'Status: open', '', '**Status:** fixed'])
    expect(selected(c, spec({ forms: ['bold', 'plain'] }))).toEqual(['bugs/b.md'])
    expect(asCondition(c, spec({ forms: ['bold', 'plain'] }))).toEqual([
      "bugs/b.md:3: prose says Status 'open', but the field at line 5 says 'fixed'",
    ])
  })

  it('two structured occurrences conflict, agreeing or not', () => {
    const c = one(['# B', '', '**Status:** open', '', '## Status: fixed'])
    expect(selected(c, spec())).toEqual([])
    expect(asCondition(c, spec())).toEqual([
      "bugs/b.md:3,5: Status is given twice (line 3 'open', line 5 'fixed'); keep one",
    ])
    expect(asCondition(one(['# B', '', '**Status:** open', '**Status:** open']), spec())).toEqual([
      "bugs/b.md:3,4: Status is given twice (line 3 'open', line 4 'open'); keep one",
    ])
  })

  it('several agreeing plain occurrences resolve; disagreeing ones conflict', () => {
    const plain = spec({ forms: ['plain'] })
    expect(selected(one(['# B', '', 'Status: open', '', 'Status: open']), plain)).toEqual([
      'bugs/b.md',
    ])
    expect(asCondition(one(['# B', '', 'Status: open', '', 'Status: shut']), plain)).toEqual([
      "bugs/b.md:3,5: Status is given twice (line 3 'open', line 5 'shut'); keep one",
    ])
  })

  it('no occurrence: no field, naming the labels the document does carry', () => {
    const c = one(['# B', '', '**State:** open', '**Severity:** High'])
    expect(selected(c, spec())).toEqual([])
    expect(asCondition(c, spec())).toEqual([
      'bugs/b.md: no Status field (read as bold, heading); its labels: State, Severity',
    ])
  })

  it('a split field is one occurrence, never a conflict with itself', () => {
    const c = one(['# B', '', '**Status:** open, fixed'])
    const s = spec({ split: (v) => v.split(',').map((x) => x.trim()) })
    expect(selected(c, s)).toEqual(['bugs/b.md'])
  })

  it('an empty value is unreadable, not present', () => {
    const c = one(['# B', '', '**Status:** ✅'])
    expect(selected(c, spec())).toEqual([])
    expect(asCondition(c, spec())).toEqual([
      'bugs/b.md:3: Status at line 3 has no value this rule can read',
    ])
  })
})

describe('the header region (plan 0469)', () => {
  const register = [
    '# Plan',
    '',
    '**Status:** open',
    '',
    '## Feedback',
    '',
    '- **Status:** open.',
    '- **Status:** fixed.',
  ]
  it('a register of bulleted Status items below the header resolves to the header value', () => {
    expect(selected(one(register), spec({ region: 'header' }))).toEqual(['bugs/b.md'])
  })

  it('without the region the register is a conflict', () => {
    expect(selected(one(register), spec())).toEqual([])
    expect(asCondition(one(register), spec())).toEqual([
      "bugs/b.md:3,7,8: Status is given 3 times (line 3 'open', line 7 'open.', line 8 'fixed.'); keep one",
    ])
  })

  it('a value only below the header is reported as outside the region, in either position', () => {
    const c = one(['# B', '', '## Notes', '', '## Status: fixed'])
    const s = spec({ forms: ['bold'], region: 'header' })
    const message =
      "bugs/b.md:5: Status at line 5 is outside the header (region: 'header'); move it into the header, or drop the region"
    expect(asCondition(c, s)).toEqual([message])
    const asSelector = docs(c).that().haveField(s).should().haveSection('Notes').violations()
    expect(said(asSelector)).toEqual([message])
  })
})

describe('the condition reports each cause word for word, one per document (plan 0469)', () => {
  it('a value outside oneOf', () => {
    const c = one(['# B', '', '**Status:** Shipped'])
    expect(asCondition(c, spec({ oneOf: /open|fixed/ }))).toEqual([
      "bugs/b.md:3: 'Shipped' (Status, line 3) does not match /open|fixed/",
    ])
  })

  it('a label in a form the rule does not read replaces "no field"', () => {
    const c = one(['# B', '', '**Status: open**'])
    expect(asCondition(c, spec())).toEqual([
      "bugs/b.md:3: found `**Status: open**` at line 3, in a form this rule does not read (bold-line); add 'bold-line' to forms, or rewrite the line",
    ])
  })
})

describe('the predicate (plan 0469)', () => {
  const bugs = () =>
    corpus({
      cwd: tree({
        'bugs/fixed.md': '# A\n\n**Status:** fixed\n',
        'bugs/open.md': '# B\n\n**Status:** open\n',
        'bugs/twice.md': '# C\n\n**Status:** fixed\n**Status:** open\n',
        'bugs/unread.md': '# D\n\n**Status: fixed**\n',
        'README.md': '# R\n\n**Status:** a\n**Status:** b\n',
      }),
      roots: ['**/*.md'],
    })
  const inBugs = {
    description: 'in bugs',
    test: (d: { relPath: string }) => d.relPath.startsWith('bugs/'),
  }
  const rule = () =>
    docs(bugs())
      .that()
      .satisfy(inBugs)
      .and()
      .haveField(spec({ oneOf: /fixed/i }))
      .should()
      .haveSection('Verification')

  it('selects only the allowed documents; reports the unreadable ones; is silent on an open bug and on a README', () => {
    // fixed.md is selected and lacks the section; twice.md and unread.md are not selected and are
    // reported; open.md is filtered out silently (oneOf); the README is outside the other predicate.
    expect(said(rule().violations())).toEqual([
      'bugs/fixed.md: missing section "Verification"',
      "bugs/twice.md:3,4: Status is given twice (line 3 'fixed', line 4 'open'); keep one",
      "bugs/unread.md:3: found `**Status: fixed**` at line 3, in a form this rule does not read (bold-line); add 'bold-line' to forms, or rewrite the line",
    ])
  })

  it('the same spec in both positions gives one finding per cause', () => {
    const c = one(['# B', '', '**Status:** a', '**Status:** b'])
    const found = docs(c).that().haveField(spec()).should().haveField(spec()).violations()
    expect(said(found)).toEqual([
      "bugs/b.md:3,4: Status is given twice (line 3 'a', line 4 'b'); keep one",
    ])
  })

  it('a selector that keeps nothing gives the kernel its zero-examined finding', () => {
    const found = docs(one(['# B', '', '**Status:** open']))
      .that()
      .haveField(spec({ oneOf: /fixed/ }))
      .should()
      .haveSection('X')
      .violations()
    expect(found.map((v) => v.message)).toEqual([expect.stringContaining('examined zero units')])
  })
})

describe('the review round (plan 0469)', () => {
  it('a value after a code fence that never closes is reported, in either position, not taken as absent', () => {
    const c = one(['# B', '', '```', '**Status:** fixed'])
    const message =
      'bugs/b.md:4: Status at line 4 follows a code fence that never closes; close the fence'
    expect(asCondition(c, spec())).toEqual([message])
    expect(said(docs(c).that().haveField(spec()).should().haveSection('X').violations())).toEqual([
      message,
    ])
  })

  it('the same spec in both positions gives one finding for a selected document with disagreeing prose', () => {
    const c = one(['# B', '', 'Status: open', '', '**Status:** fixed'])
    const s = spec({ forms: ['bold', 'plain'] })
    expect(said(docs(c).that().haveField(s).should().haveField(s).violations())).toEqual([
      "bugs/b.md:3: prose says Status 'open', but the field at line 5 says 'fixed'",
    ])
  })

  it('a selector reports disagreeing prose and an unread label beside a resolved value', () => {
    const c = one(['# B', '', 'Status: open', '', '**Status:** fixed', '', '**Status: shut**'])
    const found = docs(c)
      .that()
      .haveField(spec({ forms: ['bold', 'plain'] }))
      .should()
      .haveSection('X')
      .violations()
    // The document is selected (its value resolved), so the condition runs on it too.
    expect(said(found)).toEqual([
      'bugs/b.md: missing section "X"',
      "bugs/b.md:3: prose says Status 'open', but the field at line 5 says 'fixed'",
      "bugs/b.md:7: found `**Status: shut**` at line 7, in a form this rule does not read (bold-line); add 'bold-line' to forms, or rewrite the line",
    ])
  })

  it('two rules forked from one base do not share their haveField specs', () => {
    const c = one(['# B', '', '**Status:** fixed', '**State:** a', '**State:** b'])
    const base = docs(c).that()
    // Both rules are built before either is evaluated, so a spec shared through the base would show.
    const byStatus = base.haveField(spec()).should().haveSection('X')
    const byState = base
      .haveField(spec({ label: 'State', forms: ['bold'] }))
      .should()
      .haveSection('X')
    // Only its own condition's finding: the sibling's State conflict does not leak in.
    expect(said(byStatus.violations())).toEqual(['bugs/b.md: missing section "X"'])
    expect(said(byState.violations())).toEqual([
      "bugs/b.md:4,5: State is given twice (line 4 'a', line 5 'b'); keep one",
    ])
  })

  it('with split and oneOf, a field is allowed only when every value is', () => {
    const c = one(['# B', '', '**Status:** fixed, open'])
    const s = spec({ split: (v) => v.split(',').map((x) => x.trim()), oneOf: /fixed/ })
    expect(selected(c, s)).toEqual([])
    expect(asCondition(c, s)).toEqual([
      "bugs/b.md:3: 'open' (Status, line 3) does not match /fixed/",
    ])
  })

  it('a plain line the rule does not read is named in the no-field finding', () => {
    expect(asCondition(one(['# B', '', 'Status: fixed']), spec({ forms: ['bold'] }))).toEqual([
      "bugs/b.md: no Status field (read as bold); line 3 has `Status: fixed`, a plain line this rule does not read: add 'plain' to forms, or write it as `**Status:** v`",
    ])
  })

  it('a label in an unread form after an unclosed fence is reported, not dropped', () => {
    const c = one(['# B', '', '```', '**Status: fixed**'])
    expect(said(docs(c).that().haveField(spec()).should().haveSection('X').violations())).toEqual([
      'bugs/b.md:4: Status at line 4 follows a code fence that never closes; close the fence',
    ])
  })

  it('a value in an indented code block names the indented block, not a fence', () => {
    const c = one(['# B', '', 'Some prose.', '', '    **Status:** fixed'])
    expect(asCondition(c, spec())).toEqual([
      'bugs/b.md:5: Status at line 5 sits in an indented code block (four spaces or a tab); unindent it',
    ])
  })
})
