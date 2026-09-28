import { describe, it, expect } from 'vitest'
import { viewsFor, type PathUniverse } from '../src/path-universe.js'

const universe: PathUniverse = {
  filePaths: ['/root/src/a.ts'],
  parentDirs: ['/root/src'],
  tsconfigRelativeFilePaths: ['src/a.ts'],
  tsconfigRelativeParentDirs: ['src'],
  identityRelativeFilePaths: ['pkg/src/a.ts'],
  identityRelativeParentDirs: ['pkg/src'],
}

describe('viewsFor', () => {
  it('file-path returns the absolute, tsconfig-relative and identity-relative file views', () => {
    expect(viewsFor(universe, 'file-path', true)).toEqual([
      universe.filePaths,
      universe.tsconfigRelativeFilePaths,
      universe.identityRelativeFilePaths,
    ])
  })

  it('parent-dir returns the absolute, tsconfig-relative and identity-relative dir views', () => {
    expect(viewsFor(universe, 'parent-dir', true)).toEqual([
      universe.parentDirs,
      universe.tsconfigRelativeParentDirs,
      universe.identityRelativeParentDirs,
    ])
  })

  it('withholds the identity view from a glob whose matcher does not read it', () => {
    // The union decides whether a glob is reported dead, so a view the matcher does NOT read
    // makes an unsatisfiable glob look live. Measured while fixing bug 0348, before this
    // parameter existed: a project-relative `'apps/identity/**'` in a monorepo selected 0
    // subjects and produced 0 findings — a silently vacuous selector introduced by the fix for
    // a silently vacuous rule.
    expect(viewsFor(universe, 'file-path', false)).toEqual([
      universe.filePaths,
      universe.tsconfigRelativeFilePaths,
    ])
    expect(viewsFor(universe, 'parent-dir', false)).toEqual([
      universe.parentDirs,
      universe.tsconfigRelativeParentDirs,
    ])
  })

  it('every declared view of a kind is returned, so a new one cannot be forgotten', () => {
    // `viewsFor` is the one place the union is decided, and a view the universe holds and this
    // never returns is a view no rule can ever be checked against. Counted rather than listed:
    // adding a `*FilePaths` field without adding it here fails this.
    const fileViews = Object.keys(universe).filter((k) => k.toLowerCase().includes('filepath'))
    const dirViews = Object.keys(universe).filter((k) => k.toLowerCase().includes('parentdir'))
    expect(viewsFor(universe, 'file-path', true)).toHaveLength(fileViews.length)
    expect(viewsFor(universe, 'parent-dir', true)).toHaveLength(dirViews.length)
  })

  it('non-path kinds (import-target, specifier, literal) have no views', () => {
    expect(viewsFor(universe, 'import-target', true)).toEqual([])
    expect(viewsFor(universe, 'specifier', true)).toEqual([])
    expect(viewsFor(universe, 'literal', true)).toEqual([])
  })
})
