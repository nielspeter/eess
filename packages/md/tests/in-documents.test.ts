/**
 * Plan 0457: `inDocuments(p)` limits a rule over any element that carries its document to the
 * documents `p` selects; `areFrozen()`/`areLive()` make frozenness each rule's choice; a positive
 * rule a scope emptied names the scope. Every row drives the public entry points.
 */
import { describe, it, expect } from 'vitest'
import {
  and,
  areFrozen,
  areLive,
  codeBlocks,
  corpus,
  docs,
  predicateHaveSection,
  inDocuments,
  links,
  not,
  or,
  parseCodeBlocks,
  pointers,
  resideInFolder,
  rows,
  taskItems,
  terms,
  type ArchViolation,
  type CodeBlockParser,
  type Condition,
  type MdDocument,
  type Predicate,
} from '../src/index.js'
import { tree } from './helpers/tree.js'

/** A page holding one element of every builder, with the section or without it. */
const page = (title: string, section: string | null, other: string): string =>
  [
    `# ${title}`,
    '',
    ...(section === null ? [] : [`## ${section}`, '']),
    `See [the other page](${other}).`,
    '',
    `Read \`${other}:1\` first.`,
    '',
    `- [ ] open in ${title}`,
    '',
    'Owner: Platform',
    '',
    '| Package | Status |',
    '| ------- | ------ |',
    `| ${title} | live |`,
    '',
    '```mermaid',
    'graph TD',
    '```',
    '',
  ].join('\n')

const c = corpus({
  cwd: tree({
    'with.md': page('with', 'Verification', 'without.md'),
    'without.md': page('without', null, 'with.md'),
    // No element of any builder: every builder's count is of the corpus's documents, not its own.
    'plain.md': '# Plain\n\nNothing here.\n',
  }),
  roots: ['**/*.md'],
})

const verification = predicateHaveSection('Verification')
const typo = predicateHaveSection('Verificaton')
const DEAD_TYPO = `inDocuments(have section "Verificaton") matched none of the corpus's 3 documents`

/** A positive condition that holds for every element, for builders that ship none. */
const holds = <T>(): Condition<T> => ({ description: 'hold', evaluate: () => [] })

const said = (vs: readonly ArchViolation[]): string[] => vs.map((v) => `${v.element}: ${v.message}`)
const messages = (vs: readonly ArchViolation[]): string[] => vs.map((v) => v.message)

const ZERO =
  'this rule examined zero units. If this is expected (the corpus is legitimately empty right ' +
  'now), declare it explicitly with .expectEmpty() — otherwise this is a dead selector, an empty ' +
  'project, or a rule that never reaches its own examining seam, and the fix is to widen the ' +
  'selection, not to suppress this finding.'

/** A parser stub: every block valid, one canary it rejects. */
const parser: CodeBlockParser = {
  name: 'stub',
  version: '1.0.0',
  canaries: [{ text: '%%canary', expect: 'invalid' }],
  parse: (texts) =>
    texts.map((t) =>
      t === '%%canary'
        ? { outcome: 'invalid', message: 'bad', line: 1, remedy: 'fix it' }
        : { outcome: 'valid' },
    ),
}

describe('inDocuments: the scope', () => {
  it('the scoped rule is green where the unscoped one is red', () => {
    const unscoped = taskItems(c).that().areOpen().should().notExist().violations()
    expect(said(unscoped)).toEqual([
      'with.md:9: with.md:9 should not exist',
      'without.md:7: without.md:7 should not exist',
    ])
    const scoped = taskItems(c)
      .that()
      .areOpen()
      .satisfy(inDocuments(verification))
      .should()
      .notExist()
      .violations()
    expect(said(scoped)).toEqual(['with.md:9: with.md:9 should not exist'])
  })

  it('a dead content scope under notExist() is green (ADR-010 §3, ADR-018 C3)', () => {
    const found = taskItems(c)
      .that()
      .areOpen()
      .satisfy(inDocuments(typo))
      .should()
      .notExist()
      .violations()
    expect([...found]).toEqual([])
    expect(found.examined).toBe(0)
  })

  it('a folder scope under notExist() is judged by the selector check through the lift', () => {
    const bare = docs(c).that().resideInFolder('/work/**').should().notExist().violations()
    const lifted = taskItems(c)
      .that()
      .satisfy(inDocuments(resideInFolder('/work/**')))
      .should()
      .notExist()
      .violations()
    expect(messages(bare)).toHaveLength(1)
    expect(messages(lifted)).toEqual(messages(bare))
    // A folder that does not exist is not a broken selector (bug 0355's ruling).
    const absent = taskItems(c)
      .that()
      .satisfy(inDocuments(resideInFolder('nowhere/**')))
      .should()
      .notExist()
      .violations()
    expect([...absent]).toEqual([])
  })

  it('a live scope that holds no element, under notExist(), is green', () => {
    const closed = corpus({
      cwd: tree({
        'with.md': '# W\n\n## Verification\n\n- [x] done\n',
        'without.md': '# O\n\n- [ ] open\n',
      }),
      roots: ['**/*.md'],
    })
    const found = taskItems(closed)
      .that()
      .areOpen()
      .satisfy(inDocuments(verification))
      .should()
      .notExist()
      .violations()
    expect([...found]).toEqual([])
  })

  it('the description reads "are in documents that …", and undecided is declared only when p declares it', () => {
    const lifted: Predicate<{ readonly doc: MdDocument }> = inDocuments(verification)
    expect(lifted.description).toBe('are in documents that have section "Verification"')
    expect(lifted.undecided).toBeUndefined()
  })
})

describe('inDocuments: a positive rule a scope emptied names it', () => {
  it('a dead scope under a positive rule reds with the reason naming it', () => {
    const found = links(c).that().satisfy(inDocuments(typo)).should().resolve().violations()
    expect(messages(found)).toEqual([
      `this rule examined zero units — ${DEAD_TYPO} — the document predicate is dead; fix it, or ` +
        'declare .expectEmpty() if no document is meant to match yet (the declaration lapses the ' +
        'first time this rule examines an element)',
    ])
  })

  it('two scopes, the second dead: the reason names the second, not the first', () => {
    const [finding] = links(c)
      .that()
      .satisfy(inDocuments(verification))
      .satisfy(inDocuments(typo))
      .should()
      .resolve()
      .violations()
    expect(finding?.message).toContain(DEAD_TYPO)
    expect(finding?.message).not.toContain('"Verification"')
  })

  it('every dead scope is named, not only the first', () => {
    const [finding] = links(c)
      .that()
      .satisfy(inDocuments(predicateHaveSection('A')))
      .satisfy(inDocuments(predicateHaveSection('B')))
      .should()
      .resolve()
      .violations()
    expect(finding?.message).toContain(
      'inDocuments(have section "A"), inDocuments(have section "B") matched none',
    )
  })

  it('a live scope whose documents hold no selected element names the counts', () => {
    const closed = corpus({
      cwd: tree({
        'with.md': '# W\n\n## Verification\n\n- [x] done\n',
        'without.md': '# O\n\n- [ ] open\n',
      }),
      roots: ['**/*.md'],
    })
    const rule = taskItems(closed).that().areOpen().satisfy(inDocuments(verification)).should()
    expect(messages(rule.satisfy(holds()).violations())).toEqual([
      'this rule examined zero units — the scope matched 1 of 2 documents, and they hold none of ' +
        'the 1 task items the rest of this rule selects — declare .expectEmpty() if that is ' +
        'expected (the declaration lapses the first time this rule examines an element)',
    ])
    expect([...rule.satisfy(holds()).expectEmpty().violations()]).toEqual([])
  })

  // Three pages, two sections: `both.md` holds both and no open box; `first.md` and `second.md` one
  // section each, with an open box. Two live scopes, counted as their intersection.
  const twoSections = (files: Readonly<Record<string, string>>) =>
    taskItems(corpus({ cwd: tree(files), roots: ['**/*.md'] }))
      .that()
      .areOpen()
      .satisfy(inDocuments(verification))
      .satisfy(inDocuments(predicateHaveSection('Notes')))
      .should()
      .satisfy(holds())
      .violations()
  const first = '# F\n\n## Verification\n\n- [ ] open\n'
  const second = '# S\n\n## Notes\n\n- [ ] open\n'

  it('two live scopes count the documents that match every scope', () => {
    const found = twoSections({
      'both.md': '# B\n\n## Verification\n\n## Notes\n\n- [x] done\n',
      'first.md': first,
      'second.md': second,
    })
    expect(messages(found)).toEqual([
      'this rule examined zero units — the scopes together matched 1 of 3 documents, and they ' +
        'hold none of the 2 task items the rest of this rule selects — declare .expectEmpty() if ' +
        'that is expected (the declaration lapses the first time this rule examines an element)',
    ])
  })

  it('two live scopes no document matches together say so', () => {
    const found = twoSections({ 'first.md': first, 'second.md': second })
    expect(messages(found)).toEqual([
      "this rule examined zero units — no document matches every scope (each matches some of the corpus's 2), " +
        'so none of the 2 task items the rest of this rule selects is in scope — declare ' +
        '.expectEmpty() if that is expected (the declaration lapses the first time this rule ' +
        'examines an element)',
    ])
  })

  it('a non-scope predicate that emptied the selection gets the generic finding', () => {
    const closed = corpus({
      cwd: tree({ 'with.md': '# W\n\n## Verification\n\n- [x] done\n' }),
      roots: ['**/*.md'],
    })
    const found = taskItems(closed)
      .that()
      .areOpen()
      .satisfy(inDocuments(verification))
      .should()
      .satisfy(holds())
      .violations()
    expect(messages(found)).toEqual([ZERO])
  })

  it('the remedy lapses: a dead scope under .expectEmpty() is green until its documents hold an element', () => {
    const rule = (cwd: string) =>
      taskItems(corpus({ cwd, roots: ['**/*.md'] }))
        .that()
        .satisfy(inDocuments(typo))
        .should()
        .satisfy(holds())
        .expectEmpty()
        .violations()
    expect([...rule(tree({ 'a.md': '# A\n\n- [ ] open\n' }))]).toEqual([])
    expect(messages(rule(tree({ 'a.md': '# A\n\n## Verificaton\n\n- [ ] open\n' })))).toEqual([
      'this rule declared .expectEmpty() but examined 1 unit(s) — the declaration has expired. If ' +
        'the corpus legitimately grew past empty, remove .expectEmpty() from this rule; the ' +
        'underlying violations (if any) above still stand.',
    ])
  })

  it('a document the scope cannot judge is not a match, and the reason says how many', () => {
    const records = corpus({
      cwd: tree({
        'bugs/conflict.md': '# C\n\n**Status:** done\n**Status:** open\n',
        'bugs/open.md': '# O\n\n**Status:** open\n\nSee [c](conflict.md).\n',
      }),
      roots: ['**/*.md'],
    })
    const done: Predicate<MdDocument> = {
      description: 'are done',
      test: (d) => d.text.includes('**Status:** done'),
      undecided: (d) =>
        d.relPath === 'bugs/conflict.md'
          ? [{ file: d.file, line: 3, element: 'bugs/conflict.md:3,4', message: 'given twice' }]
          : [],
    }
    const [finding] = links(records)
      .that()
      .satisfy(inDocuments(done))
      .should()
      .resolve()
      .violations()
    expect(finding?.message).toContain(
      "inDocuments(are done) matched none of the corpus's 2 documents (1 could not be judged)",
    )
  })

  it('only a dead scope counts the documents it could not judge', () => {
    // `done` is live (bugs/done.md) and cannot judge bugs/conflict.md; the dead scope decides every
    // document, so the dead scope's note says nothing about the live scope's undecided document.
    const records = corpus({
      cwd: tree({
        'bugs/conflict.md': '# C\n\n**Status:** done\n**Status:** open\n',
        'bugs/done.md': '# D\n\n**Status:** done\n',
        'bugs/open.md': '# O\n\n**Status:** open\n\nSee [c](conflict.md).\n',
      }),
      roots: ['**/*.md'],
    })
    const done: Predicate<MdDocument> = {
      description: 'are done',
      test: (d) => d.text.includes('**Status:** done'),
      undecided: (d) =>
        d.relPath === 'bugs/conflict.md'
          ? [{ file: d.file, line: 3, element: 'bugs/conflict.md:3,4', message: 'given twice' }]
          : [],
    }
    const [finding] = links(records)
      .that()
      .satisfy(inDocuments(done))
      .satisfy(inDocuments(typo))
      .should()
      .resolve()
      .violations()
    expect(finding?.message).toContain(
      'inDocuments(have section "Verificaton") matched none of the corpus\'s 3 documents — the document',
    )
  })

  it('a scope over a corpus that loaded nothing gives the empty-source finding, not a scope reason', () => {
    const empty = corpus({ cwd: tree({ 'a.md': '# A\n' }), roots: ['nothing/**'] })
    const found = links(empty).that().satisfy(inDocuments(typo)).should().resolve().violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toMatch(/loaded zero units before any selection ran/)
  })

  describe('each builder names a dead scope on a positive rule', () => {
    it('taskItems()', () => {
      const found = taskItems(c).that().satisfy(inDocuments(typo)).should().satisfy(holds())
      expect(messages(found.violations())[0]).toContain(DEAD_TYPO)
    })
    it('links()', () => {
      const found = links(c).that().satisfy(inDocuments(typo)).should().resolve()
      expect(messages(found.violations())[0]).toContain(DEAD_TYPO)
    })
    it('pointers()', () => {
      const found = pointers(c).that().satisfy(inDocuments(typo)).should().resolve()
      expect(messages(found.violations())[0]).toContain(DEAD_TYPO)
    })
    it('rows()', () => {
      const found = rows(c, { columns: { pkg: /^Package$/ } })
        .that()
        .satisfy(inDocuments(typo))
        .should()
        .satisfy(holds())
      expect(messages(found.violations())[0]).toContain(DEAD_TYPO)
    })
    it('terms()', () => {
      const found = terms(c, { label: /Owner:/ })
        .that()
        .satisfy(inDocuments(typo))
        .should()
        .resolveAgainst(/Platform/)
      expect(messages(found.violations())[0]).toContain(DEAD_TYPO)
    })
    it('codeBlocks(), counting every document, not only those holding a block', async () => {
      const parsed = await parseCodeBlocks(c, { language: 'mermaid', parser })
      expect(parsed.blocks).toHaveLength(2)
      const found = codeBlocks(parsed).that().satisfy(inDocuments(typo)).should().parse()
      expect(messages(found.violations())[0]).toContain(DEAD_TYPO)
    })
  })

  it('codeBlocks() keeps its own predicates\' rule text: no "are in documents that"', async () => {
    const parsed = await parseCodeBlocks(c, { language: 'mermaid', parser })
    const [finding] = codeBlocks(parsed)
      .that()
      .resideInFolder('none/**')
      .should()
      .parse()
      .violations()
    expect(finding?.rule).toBe('that reside in folder none/** should parse with stub 1.0.0')
    expect(finding?.message).toBe(ZERO)
  })

  it('a scope inside a combinator is not named; composed inside the scope, it is', () => {
    const a = predicateHaveSection('A')
    const b = predicateHaveSection('B')
    const around = links(c)
      .that()
      .satisfy(or(inDocuments(a), inDocuments(b)))
      .should()
      .resolve()
      .violations()
    expect(messages(around)).toEqual([ZERO])
    const [inside] = links(c)
      .that()
      .satisfy(inDocuments(or(a, b)))
      .should()
      .resolve()
      .violations()
    expect(inside?.message).toContain('inDocuments(')
    expect(inside?.message).toContain("matched none of the corpus's 3 documents")
    // not() around a scope is a combinator too: every page is live, so the selection is empty and
    // the generic finding speaks, still red.
    const negated = links(c)
      .that()
      .satisfy(not(inDocuments(areLive())))
      .should()
      .resolve()
      .violations()
    expect(messages(negated)).toEqual([ZERO])
  })
})

describe('inDocuments: the guard pair', () => {
  const SECTION = 'Verification'
  const ratchet = (cwd: string, roots = ['**/*.md']) =>
    taskItems(corpus({ cwd, roots, frozen: ['archive/**'] }))
      .that()
      .areOpen()
      .satisfy(inDocuments(areLive()))
      .satisfy(inDocuments(predicateHaveSection(SECTION)))
      .should()
      .notExist()
  const guard = (cwd: string, roots = ['**/*.md']) =>
    docs(corpus({ cwd, roots, frozen: ['archive/**'] }))
      .that()
      .satisfy(areLive())
      .haveSection(SECTION)
      .should()
      .haveSection(SECTION)
      .rule({ id: 'in-documents/verification-guard' })

  it('renamed heading: the ratchet is green and the guard reds; restored, both are green', () => {
    const renamed = tree({ 'a.md': '# A\n\n## Checks\n\n- [x] done\n' })
    expect([...ratchet(renamed).violations()]).toEqual([])
    expect(messages(guard(renamed).violations())).toEqual([ZERO])
    const restored = tree({ 'a.md': '# A\n\n## Verification\n\n- [x] done\n' })
    expect([...ratchet(restored).violations()]).toEqual([])
    const kept = guard(restored).violations()
    expect([...kept]).toEqual([])
    expect(kept.examined).toBe(1)
  })

  it('a guard over a corpus that loads nothing gives the empty-source finding, not the zero-examined one', () => {
    const cwd = tree({ 'a.md': '# A\n\n## Checks\n' })
    const found = guard(cwd, ['nothing/**']).violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).not.toBe(ZERO)
    expect(found[0]?.message).toMatch(/loaded zero units before any selection ran/)
  })
})

describe('areFrozen() and areLive()', () => {
  const files = { 'archive/old.md': '# Old\n\n- [ ] old\n', 'live.md': '# Live\n\n- [ ] new\n' }

  it("select by the corpus's frozen globs, lifted onto boxes", () => {
    const fc = corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: ['archive/**'] })
    const of = (p: Predicate<MdDocument>) =>
      taskItems(fc).that().satisfy(inDocuments(p)).should().notExist().violations()
    expect(said(of(areLive()))).toEqual(['live.md:3: live.md:3 should not exist'])
    expect(said(of(areFrozen()))).toEqual(['archive/old.md:3: archive/old.md:3 should not exist'])
  })

  it('a corpus built with frozen: [] has no frozen document, where the default would freeze one', () => {
    // `completed/` is frozen by the default (`DEFAULT_FROZEN`), so this tells `[]` from no option.
    const cwd = tree({ 'completed/old.md': '# Old\n', 'live.md': '# Live\n' })
    const none = corpus({ cwd, roots: ['**/*.md'], frozen: [] })
    expect(said(docs(none).that().satisfy(areLive()).should().notExist().violations())).toEqual([
      'completed/old.md: completed/old.md should not exist',
      'live.md: live.md should not exist',
    ])
    expect(
      messages(docs(none).that().satisfy(areFrozen()).should().haveSection('X').violations()),
    ).toEqual([ZERO])
    const byDefault = corpus({ cwd, roots: ['**/*.md'] })
    expect(
      said(docs(byDefault).that().satisfy(areFrozen()).should().notExist().violations()),
    ).toEqual(['completed/old.md: completed/old.md should not exist'])
  })
})

describe('inDocuments: the memo', () => {
  it('runs the inner predicate once per document, however many elements and runs', () => {
    const many = corpus({
      cwd: tree({ 'a.md': '# A\n\n- [ ] 1\n- [ ] 2\n- [ ] 3\n- [ ] 4\n- [ ] 5\n' }),
      roots: ['**/*.md'],
    })
    let calls = 0
    const counted: Predicate<MdDocument> = {
      description: 'are counted',
      test: () => {
        calls += 1
        return true
      },
    }
    const rule = taskItems(many).that().satisfy(inDocuments(counted)).should().notExist()
    const boxes = ['a.md:3', 'a.md:4', 'a.md:5', 'a.md:6', 'a.md:7']
    expect(rule.violations().map((v) => v.element)).toEqual(boxes)
    expect(rule.violations().map((v) => v.element)).toEqual(boxes)
    expect(calls).toBe(1)
  })

  it('two corpora holding the same relPath with opposite verdicts each get their own', () => {
    const marked: Predicate<MdDocument> = {
      description: 'are marked',
      test: (d) => d.text.includes('MARK'),
    }
    const shared = inDocuments<{ readonly doc: MdDocument }>(marked)
    const yes = corpus({ cwd: tree({ 'a.md': '# A MARK\n\n- [ ] box\n' }), roots: ['**/*.md'] })
    const no = corpus({ cwd: tree({ 'a.md': '# A\n\n- [ ] box\n' }), roots: ['**/*.md'] })
    expect(said(taskItems(yes).that().satisfy(shared).should().notExist().violations())).toEqual([
      'a.md:3: a.md:3 should not exist',
    ])
    expect([...taskItems(no).that().satisfy(shared).should().notExist().violations()]).toEqual([])
  })
})

describe('inDocuments: what the selection and the receipt carry', () => {
  it(".select() holds only the matched documents' rows", () => {
    const selected = rows(c, { columns: { pkg: /^Package$/ } })
      .that()
      .satisfy(inDocuments(verification))
      .select({ label: 'row', identify: (r) => ({ name: r.get('pkg') }) })
    expect(selected.elements.map((r) => `${r.doc.relPath}:${r.get('pkg')}`)).toEqual([
      'with.md:with',
    ])
  })

  it("a green scoped rule's receipt counts elements, not documents", () => {
    const many = corpus({
      cwd: tree({ 'a.md': '# A\n\n## Verification\n\n- [ ] 1\n- [ ] 2\n- [ ] 3\n' }),
      roots: ['**/*.md'],
    })
    const found = taskItems(many)
      .that()
      .satisfy(inDocuments(verification))
      .should()
      .satisfy(holds())
      .violations()
    expect([...found]).toEqual([])
    expect(found.examined).toBe(3)
  })

  it('a scope composes with and() inside it', () => {
    const found = taskItems(c)
      .that()
      .satisfy(inDocuments(and(verification, areLive())))
      .should()
      .notExist()
      .violations()
    expect(said(found)).toEqual(['with.md:9: with.md:9 should not exist'])
  })

  it('is typed: a document builder cannot take a lifted predicate', () => {
    // @ts-expect-error a document carries no `doc`: pass the document predicate itself.
    docs(c).that().satisfy(inDocuments(verification))
  })
})

describe('inDocuments: a document the predicate cannot judge (ADR-021)', () => {
  const records = () =>
    corpus({
      cwd: tree({
        'bugs/conflict.md': '# C\n\n**Status:** done\n**Status:** open\n\n- [ ] one\n- [ ] two\n',
        'bugs/done.md': '# D\n\n**Status:** done\n\n- [ ] left open\n',
      }),
      roots: ['**/*.md'],
    })
  const counting = () => {
    const calls = { test: 0, undecided: 0 }
    const p: Predicate<MdDocument> = {
      description: 'are done',
      test: (d) => {
        calls.test += 1
        if (d.relPath === 'bugs/conflict.md')
          throw new Error('test() asked of an undecided document')
        return true
      },
      undecided: (d) => {
        calls.undecided += 1
        return d.relPath === 'bugs/conflict.md'
          ? [{ file: d.file, line: 3, element: 'bugs/conflict.md:3,4', message: 'given twice' }]
          : []
      },
    }
    return { p, calls }
  }

  it('forwards undecided, memoized per document, and never asks test() of an undecided one', () => {
    const { p, calls } = counting()
    const found = taskItems(records())
      .that()
      .satisfy(inDocuments(p))
      .should()
      .notExist()
      .violations()
    expect(said(found)).toEqual([
      'bugs/done.md:5: bugs/done.md:5 should not exist',
      'bugs/conflict.md:3,4: given twice',
    ])
    expect(found.undecided).toBe(1)
    // Two documents: each judged once, though the conflict holds two boxes; test() only on the other.
    expect(calls).toEqual({ undecided: 2, test: 1 })
  })

  it('.select() through the lift refuses an undecided document, naming the cause', () => {
    const { p } = counting()
    const rule = taskItems(records()).that().satisfy(inDocuments(p))
    expect(() => rule.select({ label: 'box', identify: (t) => ({ name: t.doc.relPath }) })).toThrow(
      /^select\(\) cannot answer.*given twice/s,
    )
  })

  it('the lifted test() refuses an undecided document, naming the cause', () => {
    const { p } = counting()
    const lifted = inDocuments<{ readonly doc: MdDocument }>(p)
    const [doc] = records()
      .documents()
      .filter((d) => d.relPath === 'bugs/conflict.md')
    expect(doc).toBeDefined()
    if (doc === undefined) return
    expect(() => lifted.test({ doc })).toThrow(/^test\(\) cannot answer.*given twice/s)
  })
})
