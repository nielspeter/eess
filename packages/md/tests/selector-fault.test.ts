/**
 * Bug 0460 — the kernel exempted a cardinality rule before it looked at its
 * selector, so a `notExist()`-shaped rule whose glob can never match a
 * repository-relative path passed, permanently. Plan 0456 adds the hook
 * `cardinalitySelectorFault()`, and eess-md's corpus builders answer it.
 */
import { describe, it, expect } from 'vitest'
import { marksAssertsCardinality } from '@nielspeter/eess/internal'
import { corpus, docs, not, resideInFolder } from '../src/index.js'
import { tree } from './helpers/tree.js'

describe('a cardinality rule with a broken selector is red (bug 0460)', () => {
  it('a marked condition behind an anchored folder glob reds instead of passing', () => {
    const c = corpus({ cwd: tree(['guides/a.md']), roots: ['**/*.md'] })
    const found = docs(c)
      .that()
      .resideInFolder('/guides/**')
      .should()
      .satisfy(marksAssertsCardinality({ description: 'cardinality probe', evaluate: () => [] }))
      .violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toContain('This absence rule examined nothing')
    expect(found[0]?.message).toContain('resideInFolder')
    expect(found[0]?.bypassFilters).toBe(true)
  })
})

const ABSENCE = 'This absence rule examined nothing'
type C = ReturnType<typeof corpus>
const inFolder = (c: C, glob: string) => docs(c).that().resideInFolder(glob).should().notExist()
const inFile = (c: C, glob: string) => docs(c).that().resideInFile(glob).should().notExist()
const messages = (found: readonly { message: string }[]): string[] => found.map((v) => v.message)

describe('text faults in an md glob (plan 0456)', () => {
  const c = (): C => corpus({ cwd: tree(['guides/a.md', 'guides/x/b.md']), roots: ['**/*.md'] })

  const rows: [string, string, string, string | undefined][] = [
    ['/guides/**', 'guides/**', 'a leading `/`', 'resideInFolder'],
    ['../guides/**', '', 'a `../` segment', 'resideInFolder'],
    ['guides/./x/**', 'guides/x/**', 'a `./` segment after the first', 'resideInFolder'],
    ['/guides/a.md', 'guides/a.md', 'a leading `/`', 'resideInFile'],
    ['../guides/a.md', '', 'a `../` segment', 'resideInFile'],
    ['guides/./x/b.md', 'guides/x/b.md', 'a `./` segment after the first', 'resideInFile'],
  ]
  for (const [glob, correction, cause, call] of rows) {
    it(`${call}("${glob}") reds with its cause, and its correction remediates`, () => {
      const rule = call === 'resideInFolder' ? inFolder : inFile
      const found = rule(c(), glob).violations()
      expect(messages(found)).toEqual([
        expect.stringContaining(`${ABSENCE} because its selector ${call}("${glob}")`),
      ])
      expect(found[0]?.message).toContain(cause)
      if (correction === '') {
        expect(found[0]?.suggestion).toContain('name the folder relative to it, or change `cwd`')
        return
      }
      expect(found[0]?.suggestion).toBe(`Write the glob as \`${correction}\`.`)
      // The remedy remediates: the corrected rule examines the documents it names.
      const corrected = rule(c(), correction).violations()
      expect(corrected.examined).toBeGreaterThan(0)
      expect(messages(corrected).some((m) => m.includes(ABSENCE))).toBe(false)
    })
  }

  it('a leading ./ is a working md glob: the rule examines its documents', () => {
    const found = inFolder(c(), './guides/**').violations()
    expect(found.examined).toBe(2)
    expect(messages(found)).toEqual([
      'guides/a.md should not exist',
      'guides/x/b.md should not exist',
    ])
  })

  it('escaped metacharacters name real folders, and are never a fault', () => {
    const named = corpus({
      cwd: tree(['guides/(x)/a.md', 'guides/[draft]/b.md']),
      roots: ['**/*.md'],
    })
    expect(inFolder(named, 'guides/\\(x\\)/**').violations().examined).toBe(1)
    expect(inFolder(named, 'guides/\\[draft\\]/**').violations().examined).toBe(1)
    const absent = corpus({ cwd: tree(['guides/a.md']), roots: ['**/*.md'] })
    expect([...inFolder(absent, 'guides/\\(x\\)/**').violations()]).toEqual([])
    expect([...inFolder(absent, 'guides/\\[draft\\]/**').violations()]).toEqual([])
  })

  it('a negative site is never a fault', () => {
    const found = docs(c())
      .that()
      .satisfy(not(resideInFolder('/x/**')))
      .and()
      .satisfy(resideInFolder('guides/none/**'))
      .should()
      .notExist()
      .violations()
    expect([...found]).toEqual([])
  })
})

describe('Markdown the corpus did not load (plan 0456, bug 0355 class)', () => {
  it('a glob naming files outside the roots reds, and adding the root turns it green', () => {
    const root = tree(['guides/a.md', 'docs/b.md'])
    const found = inFolder(corpus({ cwd: root, roots: ['docs/**'] }), 'guides/**').violations()
    expect(messages(found)).toEqual([
      expect.stringContaining('the corpus did not load (first: `guides/a.md`)'),
    ])
    expect(found[0]?.suggestion).toContain('Add the folder to `roots`')
    const fixed = inFolder(
      corpus({ cwd: root, roots: ['docs/**', 'guides/**'] }),
      'guides/**',
    ).violations()
    expect(messages(fixed)).toEqual(['guides/a.md should not exist'])
  })

  it('a glob naming ignored files names the ignore, and removing it turns it green', () => {
    const root = tree(['guides/a.md', 'docs/b.md'])
    const found = inFolder(
      corpus({ cwd: root, roots: ['**/*.md'], ignore: ['guides/**'] }),
      'guides/**',
    ).violations()
    expect(messages(found)).toEqual([expect.stringContaining("excluded by the corpus's `ignore`")])
    expect(found[0]?.suggestion).toContain('remove that pattern, or narrow the glob')
    const fixed = inFolder(corpus({ cwd: root, roots: ['**/*.md'] }), 'guides/**').violations()
    expect(messages(fixed)).toEqual(['guides/a.md should not exist'])
  })

  it('a dotfile the predicate can never match is not unloaded Markdown', () => {
    const c = corpus({ cwd: tree(['guides/.draft.md', 'docs/b.md']), roots: ['docs/**'] })
    expect([...inFolder(c, 'guides/**').violations()]).toEqual([])
  })

  it('a ratchet that holds is green: no folder of that name anywhere', () => {
    const c = corpus({ cwd: tree(['docs/b.md']), roots: ['docs/**'] })
    expect([...inFolder(c, 'legacy/**').violations()]).toEqual([])
  })
})

describe('a backslash written as a path separator (plan 0456)', () => {
  it('guides\\** reds with the separator fault, and its correction examines the folder', () => {
    const c = corpus({ cwd: tree(['guides/a.md']), roots: ['**/*.md'] })
    const found = inFolder(c, 'guides\\**').violations()
    expect(messages(found)).toEqual([
      expect.stringContaining('is an escape in a glob, not a path separator'),
    ])
    expect(found[0]?.suggestion).toBe(
      'Write the glob as `guides/**`. If you meant a literal `*` or `?`, write it as `[*]` or `[?]`.',
    )
    expect(messages(inFolder(c, 'guides/**').violations())).toEqual([
      'guides/a.md should not exist',
    ])
  })

  it('guides\\x/** reds with the correction guides/x/**, and no word of [*]', () => {
    const c = corpus({ cwd: tree(['guides/x/a.md']), roots: ['**/*.md'] })
    const found = inFolder(c, 'guides\\x/**').violations()
    expect(found[0]?.suggestion).toBe('Write the glob as `guides/x/**`.')
  })

  it('several separators are replaced at once: docs\\guides\\** and guides\\x\\**', () => {
    const a = corpus({ cwd: tree(['docs/guides/a.md']), roots: ['**/*.md'] })
    expect(inFolder(a, 'docs\\guides\\**').violations()[0]?.suggestion).toContain(
      '`docs/guides/**`',
    )
    const b = corpus({ cwd: tree(['guides/x/a.md']), roots: ['**/*.md'] })
    expect(inFolder(b, 'guides\\x\\**').violations()[0]?.suggestion).toContain('`guides/x/**`')
  })

  it('a glob that selects a path as written is no separator fault, though narrowed away', () => {
    const c = corpus({ cwd: tree(['guidesx/a.md', 'guides/x/a.md']), roots: ['**/*.md'] })
    const found = docs(c)
      .that()
      .resideInFolder('guides\\x/**')
      .haveNameMatching(/^zzz/)
      .should()
      .notExist()
      .violations()
    expect([...found]).toEqual([])
  })

  it('with no such folder anywhere, guides\\** stays green', () => {
    const c = corpus({ cwd: tree(['docs/a.md']), roots: ['**/*.md'] })
    expect([...inFolder(c, 'guides\\**').violations()]).toEqual([])
  })

  it('an escaped paren is never a separator, though its slash reading selects a file', () => {
    const c = corpus({ cwd: tree(['guides/x/a.md']), roots: ['**/*.md'] })
    expect([...inFolder(c, 'guides\\(x)/**').violations()]).toEqual([])
  })

  it('the pinned cost: an escaped literal star beside a real folder reds, and [*] is the remedy', () => {
    const c = corpus({ cwd: tree(['docs/a.md']), roots: ['**/*.md'] })
    const found = inFile(c, 'docs\\*.md').violations()
    expect(messages(found)).toEqual([expect.stringContaining('not a path separator')])
    expect(found[0]?.suggestion).toContain('write it as `[*]` or `[?]`')
    expect([...inFile(c, 'docs[*].md').violations()]).toEqual([])
  })
})

describe('pinned limits of the absence rule (plan 0456)', () => {
  it('limit: a folder in .that() naming nothing over a wide corpus is green (bug 0355)', () => {
    const c = corpus({ cwd: tree(['guides/a.md']), roots: ['**/*.md'] })
    expect([...inFolder(c, 'gudies/**').violations()]).toEqual([])
  })

  it('limit: a corpus whose every root is dead is the empty-source finding, not a refusal', () => {
    const c = corpus({ cwd: tree(['guides/a.md']), roots: ['a-typo/**', 'b-typo/**'] })
    expect(messages(inFolder(c, 'guides/**').violations())).toEqual([
      expect.stringContaining("this rule's source loaded zero units"),
    ])
  })
})
