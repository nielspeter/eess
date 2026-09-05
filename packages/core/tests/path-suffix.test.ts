import { describe, expect, it } from 'vitest'
import { pathSuffixIndex } from '../src/path-suffix.js'

/**
 * Bug 0257 — one suffix resolver, extracted from two dialects that had written
 * it independently.
 *
 * The cases here are the ones the callers actually depend on, not a tour of the
 * API: exact beating a longer match, the `/` boundary, and ambiguity returning
 * every candidate rather than the first.
 */
const index = (...paths: string[]) => pathSuffixIndex(paths)

describe('pathSuffixIndex', () => {
  it('an exact repo-relative path wins outright', () => {
    const m = index('a/x.ts', 'b/x.ts').resolve('a/x.ts')
    expect(m.kind).toBe('exact')
    expect(m.kind === 'exact' && m.file).toBe('a/x.ts')
  })

  it('exact beats an ambiguity it is itself part of — the precedence, pinned', () => {
    // `a/x.ts` IS a path, and `deep/a/x.ts` also ends with it. Resolving to
    // `ambiguous` here would turn a correct citation into a finding. Both
    // dialects had this precedence before the extraction; getting it backwards
    // is the one way this refactor could silently break a real corpus.
    const m = index('a/x.ts', 'deep/a/x.ts').resolve('a/x.ts')
    expect(m.kind).toBe('exact')
  })

  it('a unique suffix resolves, and reports the full path it found', () => {
    const m = index('app/pages/admin/index.vue', 'other/thing.ts').resolve('admin/index.vue')
    expect(m.kind).toBe('unique')
    expect(m.kind === 'unique' && m.file).toBe('app/pages/admin/index.vue')
  })

  it('several matches are ambiguous, and EVERY candidate comes back', () => {
    // Not just a count and not just the first: the callers put these names in
    // the message so the author can pick one. A resolver returning only the
    // first would satisfy a `kind` check while making the message useless.
    const m = index('a/dup/x.ts', 'b/dup/x.ts', 'c/other.ts').resolve('dup/x.ts')
    expect(m.kind).toBe('ambiguous')
    expect(m.kind === 'ambiguous' && [...m.files]).toEqual(['a/dup/x.ts', 'b/dup/x.ts'])
  })

  it('matching is on a / boundary, so a suffix is not a substring', () => {
    // `x.ts` must not match `prefix-x.ts`. Without the boundary this would
    // resolve, and resolve to the wrong file — the "blessed against the wrong
    // file" hazard bug 0254 named.
    expect(index('src/prefix-x.ts').resolve('x.ts').kind).toBe('none')
    expect(index('b/aa/x.ts').resolve('a/x.ts').kind).toBe('none')
    // …and the real boundary case still resolves.
    expect(index('b/a/x.ts').resolve('a/x.ts').kind).toBe('unique')
  })

  it('nothing matching is none, distinct from ambiguous', () => {
    expect(index('a/x.ts').resolve('nowhere/y.ts').kind).toBe('none')
  })

  it('an empty path set answers none rather than throwing', () => {
    // The degenerate corpus. A resolver that threw here would turn an empty
    // project into a crash instead of a finding.
    expect(pathSuffixIndex([]).resolve('anything.ts').kind).toBe('none')
  })

  it('a bare basename is the single-segment case of the same rule', () => {
    // Both dialects rely on this: `login.feature` and `admin/index.vue` resolve
    // by one rule, not two.
    expect(index('specs/auth/login.feature').resolve('login.feature').kind).toBe('unique')
  })
})
