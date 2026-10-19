import { describe, it, expect } from 'vitest'
import { areFrozen, corpus, inDocuments, isArchConfigError, taskItems } from '../src/index.js'
import { tree } from './helpers/tree.js'

/**
 * Bug 0499 — `corpus()` judged its `roots` (bug 0465) but not its `frozen` globs, and
 * `areFrozen()`/`areLive()` carry no globs for the selector-fault check to read. A broken
 * frozen glob emptied `inDocuments(areFrozen())`, so an absence rule over it was green with
 * nothing examined. `corpus()` now refuses a caller's frozen glob that can never match, or
 * that marks none of the documents it loaded.
 */
const files = { 'archive/old.md': '# Old\n\n- [ ] old\n', 'live.md': '# Live\n\n- [x] new\n' }

function refusal(load: () => unknown): string {
  let thrown: unknown
  try {
    load()
  } catch (e) {
    thrown = e
  }
  expect(isArchConfigError(thrown)).toBe(true)
  return String(thrown)
}

describe("a corpus's frozen globs are judged at load (bug 0499)", () => {
  it('a frozen glob with a leading slash is refused, with its correction', () => {
    const cwd = tree(files)
    const said = refusal(() =>
      taskItems(corpus({ cwd, roots: ['**/*.md'], frozen: ['/archive/**'] }))
        .that()
        .areOpen()
        .satisfy(inDocuments(areFrozen()))
        .should()
        .notExist()
        .violations(),
    )
    expect(said).toContain("frozen glob '/archive/**'")
    expect(said).toContain('a leading `/` can never match')
    expect(said).toContain('`archive/**`')
  })

  it('a frozen glob that marks no loaded document is refused, naming it', () => {
    const said = refusal(() =>
      corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: ['archve/**'] }),
    )
    expect(said).toContain("frozen glob 'archve/**' marks none of the corpus's 2 documents")
  })

  it('every faulted frozen glob is named, in one refusal', () => {
    expect(() =>
      corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: ['../archive/**', 'archve/**'] }),
    ).toThrow(/'\.\.\/archive\/\*\*'.*'archve\/\*\*'/s)
  })

  it('a frozen glob that marks a document loads, and the absence rule over it reports the box', () => {
    const c = corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: ['archive/**', 'live.md'] })
    const found = taskItems(c)
      .that()
      .areOpen()
      .satisfy(inDocuments(areFrozen()))
      .should()
      .notExist()
      .violations()
    expect(found.map((v) => v.file)).toEqual([expect.stringContaining('archive/old.md')])
  })

  it('the default frozen globs are a convention and are not judged', () => {
    // `**/completed/**` and `**/archived/**` match nothing here; they are eess-md's default,
    // not a glob the caller wrote.
    expect(() => corpus({ cwd: tree(files), roots: ['**/*.md'] })).not.toThrow()
  })

  it('frozen: [] has no glob to judge', () => {
    expect(() => corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: [] })).not.toThrow()
  })

  it('a corpus that loads nothing is left to the empty-source report', () => {
    // No document means every frozen glob marks none; the empty source is its own finding.
    expect(() =>
      corpus({ cwd: tree(files), roots: ['nothing/**'], frozen: ['archive/**'] }),
    ).not.toThrow()
  })

  it('a text-faulted frozen glob is refused even over a corpus that loads nothing', () => {
    expect(() =>
      corpus({ cwd: tree(files), roots: ['nothing/**'], frozen: ['/archive/**'] }),
    ).toThrow(/frozen glob '\/archive\/\*\*'/)
  })
})

/**
 * A lifecycle folder with no record yet (`wont-do/` before anything is filed there). Removing its
 * glob is not a remedy: a record that lands there later is read as live, and an absence rule over
 * the frozen documents never sees it. `expectEmptyFrozen` declares such globs, as
 * `expectEmptyRoots` declares a root (bug 0475), and the declaration expires (ADR-010 §3).
 */
describe('expectEmptyFrozen: a frozen glob that marks nothing on purpose (bug 0499)', () => {
  it('a declared frozen glob that marks no document loads', () => {
    expect(() =>
      corpus({
        cwd: tree(files),
        roots: ['**/*.md'],
        frozen: ['archive/**', 'wont-do/**'],
        expectEmptyFrozen: ['wont-do/**'],
      }),
    ).not.toThrow()
  })

  it('the refusal of an undeclared dead glob names expectEmptyFrozen as the remedy', () => {
    const said = refusal(() =>
      corpus({ cwd: tree(files), roots: ['**/*.md'], frozen: ['archive/**', 'wont-do/**'] }),
    )
    expect(said).toContain("frozen glob 'wont-do/**' marks none of the corpus's 2 documents")
    expect(said).toContain('expectEmptyFrozen')
  })

  it('the declaration expires: a declared glob that marks a document is refused', () => {
    const said = refusal(() =>
      corpus({
        cwd: tree(files),
        roots: ['**/*.md'],
        frozen: ['archive/**'],
        expectEmptyFrozen: ['archive/**'],
      }),
    )
    expect(said).toContain("'archive/**' is declared in expectEmptyFrozen, but it marks 1 document")
    expect(said).toContain('drop it from expectEmptyFrozen')
  })

  it('a declared glob that is not one of the frozen globs is refused', () => {
    const said = refusal(() =>
      corpus({
        cwd: tree(files),
        roots: ['**/*.md'],
        frozen: ['archive/**'],
        expectEmptyFrozen: ['wont-do/**'],
      }),
    )
    expect(said).toContain(
      "expectEmptyFrozen names 'wont-do/**', which is not one of the frozen globs",
    )
  })

  it("declaring a glob with frozen omitted is refused: the default is not the caller's to declare", () => {
    expect(() =>
      corpus({ cwd: tree(files), roots: ['**/*.md'], expectEmptyFrozen: ['**/archived/**'] }),
    ).toThrow(
      /expectEmptyFrozen names '\*\*\/archived\/\*\*', which is not one of the frozen globs/,
    )
  })

  it('a declaration does not excuse a text fault', () => {
    expect(() =>
      corpus({
        cwd: tree(files),
        roots: ['**/*.md'],
        frozen: ['archive/**', '/wont-do/**'],
        expectEmptyFrozen: ['/wont-do/**'],
      }),
    ).toThrow(/frozen glob '\/wont-do\/\*\*': a leading `\/` can never match/)
  })
})
