/**
 * Plan 0456: `notExist()` on every eess-md builder whose element carries a
 * document, and an empty corpus as an empty source. Driven through the public
 * builders and their terminal.
 */
import { describe, it, expect } from 'vitest'
import { globNode, type Predicate } from '@nielspeter/eess'
import {
  and,
  codeBlocks,
  corpus,
  docs,
  haveNameMatching,
  links,
  not,
  or,
  parseCodeBlocks,
  pointers,
  resideInFolder,
  rows,
  taskItems,
  terms,
  type CodeBlockParser,
  type MdDocument,
} from '../src/index.js'
import { tree } from './helpers/tree.js'

const PAGE = [
  '# Page',
  '',
  'See [the guide](other.md).',
  '',
  'Read `src/a.ts:1` first.',
  '',
  '- [ ] an open box',
  '',
  'Owner: Platform',
  '',
  '## Packages',
  '',
  '| Package | Status |',
  '| ------- | ------ |',
  '| core    | live   |',
  '',
  '```mermaid',
  'graph TD',
  '```',
  '',
].join('\n')

const repo = (): string => tree({ 'guides/page.md': PAGE, 'guides/other.md': '# Other\n' })
const loaded = () => corpus({ cwd: repo(), roots: ['**/*.md'] })
const empty = () => corpus({ cwd: repo(), roots: ['nothing-here/**'] })

const parser: CodeBlockParser = {
  name: 'stub',
  version: '1.0.0',
  canaries: [
    { text: '%%canary-invalid', expect: 'invalid' },
    { text: '%%canary-unrecognised', expect: 'unrecognised' },
  ],
  parse: (texts) =>
    texts.map((t) =>
      t.startsWith('%%canary-invalid')
        ? { outcome: 'invalid', message: 'x', line: 1, remedy: 'x' }
        : t.startsWith('%%canary-unrecognised')
          ? { outcome: 'unrecognised', message: 'x', remedy: 'x' }
          : { outcome: 'valid' },
    ),
}

/** Where each finding is: `element @ line`. */
const where = (found: readonly { element: string; line: number }[]): string[] =>
  found.map((v) => `${v.element} @ ${String(v.line)}`)

describe('notExist() on each md builder (plan 0456)', () => {
  it('docs(): a selected document is a finding named by its path, at line 1', () => {
    const found = docs(loaded())
      .that()
      .resideInFile('guides/page.md')
      .should()
      .notExist()
      .violations()
    expect(where(found)).toEqual(['guides/page.md @ 1'])
    expect(found[0]?.message).toBe('guides/page.md should not exist')
  })

  it('links(): a selected link is a finding at its own line', () => {
    const found = links(loaded()).should().notExist().violations()
    expect(where(found)).toEqual(['guides/page.md:3 @ 3'])
  })

  it('pointers(): a selected pointer is a finding at its own line', () => {
    const found = pointers(loaded()).should().notExist().violations()
    expect(where(found)).toEqual(['guides/page.md:5 @ 5'])
  })

  it('taskItems(): a selected box is a finding at its own line', () => {
    const found = taskItems(loaded()).that().areOpen().should().notExist().violations()
    expect(where(found)).toEqual(['guides/page.md:7 @ 7'])
  })

  it('terms(): a selected reference is a finding at its own line', () => {
    const found = terms(loaded(), { label: /Owner:/ })
      .should()
      .notExist()
      .violations()
    expect(where(found)).toEqual(['guides/page.md:9 @ 9'])
  })

  it('rows(): a selected row is a finding at its own line', () => {
    const found = rows(loaded(), { section: /^Packages$/, columns: { pkg: /^Package$/ } })
      .should()
      .notExist()
      .violations()
    expect(where(found)).toEqual(['guides/page.md:15 @ 15'])
  })

  it('codeBlocks(): a selected block is a finding at its opening fence', async () => {
    const parsed = await parseCodeBlocks(loaded(), { language: 'mermaid', parser })
    const found = codeBlocks(parsed).should().notExist().violations()
    expect(where(found)).toEqual(['guides/page.md:17 @ 17'])
  })

  it('an empty selection is green on every builder', () => {
    const c = loaded()
    const none: Predicate<{ doc: MdDocument }> = { description: 'none', test: () => false }
    for (const found of [
      docs(c).that().resideInFolder('guides/none/**').should().notExist().violations(),
      links(c).that().satisfy(none).should().notExist().violations(),
      pointers(c).that().satisfy(none).should().notExist().violations(),
      taskItems(c).that().areChecked().should().notExist().violations(),
      terms(c, { label: /Owner:/ })
        .that()
        .satisfy(none)
        .should()
        .notExist()
        .violations(),
    ]) {
      expect([...found]).toEqual([])
    }
  })
})

describe('block 6: every page claimed by one selection, none by two (plan 0456)', () => {
  const pages = (files: readonly string[]) => corpus({ cwd: tree(files), roots: ['guides/**'] })
  const howTo = resideInFolder('guides/how-to/**')
  const reference = resideInFolder('guides/reference/**')
  const tutorial = haveNameMatching(/^tutorial-/)
  const unclaimed = (c: ReturnType<typeof pages>) =>
    docs(c)
      .that()
      .satisfy(not(or(howTo, reference, tutorial)))
      .should()
      .notExist()
      .violations()
  const claimedTwice = (c: ReturnType<typeof pages>) =>
    docs(c)
      .that()
      .satisfy(or(and(howTo, reference), and(howTo, tutorial), and(reference, tutorial)))
      .should()
      .notExist()
      .violations()

  it('a page outside every selection is a finding naming its path', () => {
    const c = pages(['guides/how-to/a.md', 'guides/stray.md'])
    expect(where(unclaimed(c))).toEqual(['guides/stray.md @ 1'])
  })

  it('when every page is claimed once, both rules are green', () => {
    const c = pages(['guides/how-to/a.md', 'guides/reference/b.md', 'guides/tutorial-c.md'])
    expect([...unclaimed(c)]).toEqual([])
    expect([...claimedTwice(c)]).toEqual([])
  })

  it('a page claimed by two selections is a finding', () => {
    const c = pages(['guides/how-to/tutorial-a.md', 'guides/reference/b.md'])
    expect(where(claimedTwice(c))).toEqual(['guides/how-to/tutorial-a.md @ 1'])
  })

  it('a selection widened to everything reds the second rule', () => {
    const c = pages(['guides/how-to/a.md', 'guides/reference/b.md'])
    const everything = resideInFolder('**')
    const found = docs(c)
      .that()
      .satisfy(or(and(everything, reference), and(everything, tutorial), and(reference, tutorial)))
      .should()
      .notExist()
      .violations()
    expect(where(found)).toEqual(['guides/reference/b.md @ 1'])
  })
})

/** A predicate over any element's document, declaring the glob it matches. */
function inFolder<T extends { doc: MdDocument }>(glob: string): Predicate<T> {
  return {
    description: `in folder ${glob}`,
    test: (e) => e.doc.relPath.startsWith(glob.replace(/^\/|\*.*$/g, '')),
    globs: globNode({ glob, kind: 'file-path', base: 'normalized' }),
    originLabel: `inFolder("${glob}")`,
  }
}

const SOURCE_EMPTY = "this rule's source loaded zero units"
const ABSENCE = 'This absence rule examined nothing'

describe('an empty corpus and a broken selector, on the six corpus builders (plan 0456)', () => {
  type Build = (
    c: ReturnType<typeof corpus>,
    glob: string,
    expectEmpty: boolean,
  ) => readonly { message: string }[]
  const builders: [string, Build][] = [
    [
      'docs',
      (c, g, e) =>
        (e ? docs(c).that().resideInFolder(g).expectEmpty() : docs(c).that().resideInFolder(g))
          .should()
          .notExist()
          .violations(),
    ],
    [
      'links',
      (c, g, e) =>
        (e
          ? links(c).that().satisfy(inFolder(g)).expectEmpty()
          : links(c).that().satisfy(inFolder(g))
        )
          .should()
          .notExist()
          .violations(),
    ],
    [
      'pointers',
      (c, g, e) =>
        (e
          ? pointers(c).that().satisfy(inFolder(g)).expectEmpty()
          : pointers(c).that().satisfy(inFolder(g))
        )
          .should()
          .notExist()
          .violations(),
    ],
    [
      'rows',
      (c, g, e) => {
        const r = rows(c, { section: /^Packages$/, columns: { pkg: /^Package$/ } })
          .that()
          .satisfy(inFolder(g))
        return (e ? r.expectEmpty() : r).should().notExist().violations()
      },
    ],
    [
      'terms',
      (c, g, e) =>
        (e
          ? terms(c, { label: /Owner:/ })
              .that()
              .resideInFile(g)
              .expectEmpty()
          : terms(c, { label: /Owner:/ })
              .that()
              .resideInFile(g)
        )
          .should()
          .notExist()
          .violations(),
    ],
    [
      'taskItems',
      (c, g, e) =>
        (e
          ? taskItems(c).that().satisfy(inFolder(g)).expectEmpty()
          : taskItems(c).that().satisfy(inFolder(g))
        )
          .should()
          .notExist()
          .violations(),
    ],
  ]

  for (const [name, build] of builders) {
    it(`${name}: a corpus that loaded nothing is an empty source, declared empty or not`, () => {
      for (const declared of [false, true]) {
        const found = build(empty(), 'guides/**', declared)
        expect(found.map((v) => v.message)).toEqual([expect.stringContaining(SOURCE_EMPTY)])
      }
    })

    it(`${name}: an anchored selector glob over a loaded corpus is a selector fault`, () => {
      const found = build(loaded(), '/x/**', false)
      expect(found.map((v) => v.message)).toEqual([
        expect.stringContaining(`${ABSENCE} because its selector`),
      ])
      expect(found[0]?.message).toContain(
        "a leading `/` can never match a path relative to the corpus's `cwd`",
      )
    })
  }

  it('codeBlocks: an anchored folder glob is a selector fault, forwarded through its document predicate', async () => {
    const parsed = await parseCodeBlocks(loaded(), { language: 'mermaid', parser })
    const found = codeBlocks(parsed).that().resideInFolder('/x/**').should().notExist().violations()
    expect(found.map((v) => v.message)).toEqual([
      expect.stringContaining('resideInFolder("/x/**") is broken'),
    ])
  })
})
