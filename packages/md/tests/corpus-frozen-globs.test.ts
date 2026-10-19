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
