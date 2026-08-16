import { describe, it, expect } from 'vitest'
import { viewsFor, type PathUniverse } from '../src/path-universe.js'

const universe: PathUniverse = {
  filePaths: ['/root/src/a.ts'],
  parentDirs: ['/root/src'],
  tsconfigRelativeFilePaths: ['src/a.ts'],
  tsconfigRelativeParentDirs: ['src'],
}

describe('viewsFor', () => {
  it('file-path returns the absolute and tsconfig-relative file views', () => {
    expect(viewsFor(universe, 'file-path')).toEqual([
      universe.filePaths,
      universe.tsconfigRelativeFilePaths,
    ])
  })

  it('parent-dir returns the absolute and tsconfig-relative dir views', () => {
    expect(viewsFor(universe, 'parent-dir')).toEqual([
      universe.parentDirs,
      universe.tsconfigRelativeParentDirs,
    ])
  })

  it('non-path kinds (import-target, specifier, literal) have no views', () => {
    expect(viewsFor(universe, 'import-target')).toEqual([])
    expect(viewsFor(universe, 'specifier')).toEqual([])
    expect(viewsFor(universe, 'literal')).toEqual([])
  })
})
