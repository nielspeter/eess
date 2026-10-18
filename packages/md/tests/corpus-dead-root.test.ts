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

  it('a root that matches files but no Markdown is not a dead root', () => {
    // An empty source, not a mistyped root: plan 0456 owns that case.
    expect(() => corpus({ cwd: fixture, roots: ['src/**'] })).not.toThrow()
  })
})
