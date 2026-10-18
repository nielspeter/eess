import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { corpus, isArchConfigError } from '../src/index.js'

const fixture = path.resolve(import.meta.dirname, 'fixtures/corpus')

/**
 * Bug 0465 — a root that matches no file used to be dropped without a word: a
 * two-root corpus with one mistyped root loaded the other root's documents, so
 * it was not an empty source, and every rule over it judged half of what its
 * author named. `corpus()` now refuses it and names the root.
 */
describe('a corpus root that matches no file is refused (bug 0465)', () => {
  it('a mistyped root among several is refused, naming the root', () => {
    let thrown: unknown
    try {
      corpus({ cwd: fixture, roots: ['docs/**', 'dcos-typo/**'] })
    } catch (e) {
      thrown = e
    }
    expect(isArchConfigError(thrown)).toBe(true)
    expect(String(thrown)).toContain("'dcos-typo/**'")
    expect(String(thrown)).toContain('matches no file')
  })

  it('every dead root is named, in one refusal', () => {
    expect(() => corpus({ cwd: fixture, roots: ['docs/**', 'a-typo/**', 'b-typo/**'] })).toThrow(
      /'a-typo\/\*\*'.*'b-typo\/\*\*'/s,
    )
  })

  it('roots that all match load as before', () => {
    const c = corpus({ cwd: fixture, roots: ['docs/**', 'site/**'] })
    expect(c.documents().length).toBeGreaterThan(0)
  })

  it('a corpus whose every root is dead is left to the empty-source report', () => {
    // Loading nothing at all is an empty source, which the rules report through
    // their receipts; gates build such corpora on purpose. Only one dead root
    // beside live ones was silent.
    expect(() => corpus({ cwd: fixture, roots: ['a-typo/**', 'b-typo/**'] })).not.toThrow()
  })

  it('a root that matches files but no Markdown, beside a live root, is not refused', () => {
    // Callers list code globs as roots beside their documents. Bug 0465's
    // Resolution records this as a residual: such a root contributes nothing.
    expect(() => corpus({ cwd: fixture, roots: ['docs/**', 'src/**'] })).not.toThrow()
  })

  it('a root whose files are all ignored is named as ignored, not as matching nothing', () => {
    expect(() =>
      corpus({ cwd: fixture, roots: ['docs/**', 'site/**'], ignore: ['site/**'] }),
    ).toThrow(/'site\/\*\*'.*ignored/s)
  })
})

/**
 * Bug 0475 — a root that is empty on purpose had no way to say so. Its only remedy was to remove
 * the root, after which the folder is silently unexamined once it fills. `expectEmptyRoots` names
 * such roots; the declaration expires, as `.expectEmpty()` does (ADR-010 §3).
 */
describe('a root can be declared empty, and the declaration expires (bug 0475)', () => {
  it('a declared root that matches no file loads beside a live root', () => {
    const c = corpus({
      cwd: fixture,
      roots: ['docs/**', 'empty-on-purpose/**'],
      expectEmptyRoots: ['empty-on-purpose/**'],
    })
    expect(c.documents().length).toBeGreaterThan(0)
  })

  it('a declared root that now loads documents is refused: the declaration has expired', () => {
    expect(() =>
      corpus({ cwd: fixture, roots: ['docs/**', 'site/**'], expectEmptyRoots: ['site/**'] }),
    ).toThrow(/'site\/\*\*'.*declared empty.*loads documents/s)
  })

  it('a declared root that matches files but no Markdown stays declared', () => {
    // A lane holding only a .gitkeep, or code, has no records yet.
    expect(() =>
      corpus({ cwd: fixture, roots: ['docs/**', 'src/**'], expectEmptyRoots: ['src/**'] }),
    ).not.toThrow()
  })

  it('a typo beside a declared-empty root, with no live root, is still named', () => {
    expect(() =>
      corpus({
        cwd: fixture,
        roots: ['empty-on-purpose/**', 'typo/**'],
        expectEmptyRoots: ['empty-on-purpose/**'],
      }),
    ).toThrow(/'typo\/\*\*'/)
  })

  it('a declared name that is not one of the roots is refused as stale', () => {
    expect(() =>
      corpus({ cwd: fixture, roots: ['docs/**'], expectEmptyRoots: ['nope/**'] }),
    ).toThrow(/'nope\/\*\*'.*not one of this corpus's roots/s)
  })

  it('an undeclared dead root beside a declared one is still refused', () => {
    expect(() =>
      corpus({
        cwd: fixture,
        roots: ['docs/**', 'empty-on-purpose/**', 'typo/**'],
        expectEmptyRoots: ['empty-on-purpose/**'],
      }),
    ).toThrow(/'typo\/\*\*'/)
  })
})
