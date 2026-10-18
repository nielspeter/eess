/**
 * Plan 0456: one owner of the glob-text rules. For `'repo-relative'` the rows
 * are plan 0456's Problem 4, measured on picomatch 4.0.4 as eess-md resolves it.
 */
import { describe, it, expect } from 'vitest'
import { globTextCorrection, globTextFault } from '../src/internal.js'

describe('globTextFault, repo-relative (plan 0456)', () => {
  const rows: [string, string | undefined, string | undefined][] = [
    ['guides/**', undefined, undefined],
    ['./guides/**', undefined, undefined],
    ['./guides/a.md', undefined, undefined],
    ['/guides/**', 'anchored', 'guides/**'],
    ['../guides/**', 'parent-segment', undefined],
    ['guides/../guides/**', 'parent-segment', undefined],
    ['guides/./x/**', 'dot-segment', 'guides/x/**'],
    ['**/./guides/**', 'dot-segment', '**/guides/**'],
    ['guides/\\(x\\)/**', undefined, undefined],
    ['guides/\\[draft\\]/**', undefined, undefined],
    ['docs/a\\ b.md', undefined, undefined],
    ['docs\\a.md', undefined, undefined],
    ['guides\\**', undefined, undefined],
  ]
  for (const [glob, fault, correction] of rows) {
    it(`repo-relative ${glob} is ${fault ?? 'no fault'}`, () => {
      const found = globTextFault(glob, 'file-path', 'repo-relative')
      expect(found).toBe(fault)
      if (found !== undefined) expect(globTextCorrection(glob, found)).toBe(correction)
    })
  }
})

describe('globTextFault, the eess-ts bases (unchanged from syntacticFault)', () => {
  it('a ./ anywhere is a dot-segment on every eess-ts base', () => {
    for (const base of ['absolute', 'tsconfig-relative', 'normalized'] as const) {
      expect(globTextFault('./src/**', 'file-path', base)).toBe('dot-segment')
      expect(globTextFault('**/./src/**', 'file-path', base)).toBe('dot-segment')
    }
  })

  it('an unanchored path glob is unanchored on the absolute base only', () => {
    expect(globTextFault('src/**', 'file-path')).toBe('unanchored')
    expect(globTextFault('src/**', 'parent-dir', 'absolute')).toBe('unanchored')
    expect(globTextFault('src/**', 'file-path', 'tsconfig-relative')).toBeUndefined()
    expect(globTextFault('src/**', 'file-path', 'normalized')).toBeUndefined()
    expect(globTextFault('fastify', 'specifier')).toBeUndefined()
    expect(globTextFault('**/src/**', 'file-path')).toBeUndefined()
    expect(globTextFault('/abs/src/**', 'file-path')).toBeUndefined()
  })
})
