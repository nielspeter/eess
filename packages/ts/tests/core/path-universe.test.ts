import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { Project } from 'ts-morph'
import { project } from '../../src/core/project.js'
import type { ArchProject } from '../../src/core/project.js'
import { pathUniverse } from '../../src/core/path-universe.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/cross-layer')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

describe('pathUniverse', () => {
  it('materializes filePaths and their immediate parentDirs only', () => {
    const p = project(tsconfigPath)
    const universe = pathUniverse(p)
    expect(universe.filePaths.some((f) => f.endsWith('user-route.ts'))).toBe(true)
    expect(universe.parentDirs.some((d) => d.endsWith('/routes'))).toBe(true)
    // Not an ancestor two levels up — parentDirs is immediate parents only.
    expect(universe.parentDirs.some((d) => d.endsWith('/fixtures'))).toBe(false)
  })

  it('tsconfig-relative views strip the tsconfig directory prefix', () => {
    const p = project(tsconfigPath)
    const universe = pathUniverse(p)
    expect(universe.tsconfigRelativeFilePaths).toContain('src/routes/user-route.ts')
    expect(universe.tsconfigRelativeParentDirs).toContain('src/routes')
  })

  it('memoizes per project — a second call returns the same object', () => {
    const p = project(tsconfigPath)
    expect(pathUniverse(p)).toBe(pathUniverse(p))
  })

  it('two different project objects get independent universes', () => {
    // `project()` itself memoizes on the tsconfig path, so calling it twice
    // with the same path returns the SAME ArchProject — not a useful probe of
    // `pathUniverse`'s own per-project cache. Two hand-built ArchProject
    // objects (bare-object test doubles are real usage, not a shortcut — see
    // `path-universe.ts`'s own docstring) are genuinely distinct WeakMap keys.
    const a: ArchProject = {
      tsConfigPath: tsconfigPath,
      _project: new Project({ tsConfigFilePath: tsconfigPath }),
      getSourceFiles: () => new Project({ tsConfigFilePath: tsconfigPath }).getSourceFiles(),
    }
    const b: ArchProject = {
      tsConfigPath: tsconfigPath,
      _project: new Project({ tsConfigFilePath: tsconfigPath }),
      getSourceFiles: () => new Project({ tsConfigFilePath: tsconfigPath }).getSourceFiles(),
    }
    expect(pathUniverse(a)).not.toBe(pathUniverse(b))
  })
})
