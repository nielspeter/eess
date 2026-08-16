import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { Project } from 'ts-morph'
import { project } from '../../src/core/project.js'
import { buildDiskSet, diskSet } from '../../src/core/disk-set.js'
import type { ArchProject } from '../../src/core/project.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/cross-layer')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

describe('diskSet', () => {
  it('classifies a glob matching TypeScript files as holds-typescript', () => {
    const set = diskSet(project(tsconfigPath))
    expect(set.classify('**/tests/fixtures/cross-layer/src/routes/**')).toBe('holds-typescript')
  })

  it('classifies a glob matching only non-TypeScript content as no-typescript', () => {
    const set = diskSet(project(tsconfigPath))
    expect(set.classify('**/tests/fixtures/cross-layer/tsconfig.json')).toBe('no-typescript')
  })

  it('classifies a glob matching nothing on disk as absent', () => {
    const set = diskSet(project(tsconfigPath))
    expect(set.classify('**/tests/fixtures/cross-layer/definitely-does-not-exist/**')).toBe(
      'absent',
    )
  })

  it('memoizes per project — a second call returns the same closure', () => {
    const p = project(tsconfigPath)
    expect(diskSet(p)).toBe(diskSet(p))
  })
})

describe('buildDiskSet — the injectable-budget escape hatch', () => {
  it('degrades to not-determined once the entry budget is exhausted', () => {
    const set = buildDiskSet(project(tsconfigPath), 1)
    expect(set.classify('**/anything/**')).toBe('not-determined')
  })

  it('a generous budget still classifies normally', () => {
    const set = buildDiskSet(project(tsconfigPath), 50_000)
    expect(set.classify('**/tests/fixtures/cross-layer/src/routes/**')).toBe('holds-typescript')
  })
})

describe('the input guard — before any walk begins', () => {
  it('a relative tsConfigPath degrades to not-determined rather than walking the CWD', () => {
    const doubled: ArchProject = {
      tsConfigPath: 'relative/tsconfig.json',
      _project: new Project({ useInMemoryFileSystem: true }),
      getSourceFiles: () => [],
    }
    expect(buildDiskSet(doubled).classify('**/anything/**')).toBe('not-determined')
  })

  it('an absolute tsConfigPath whose root does not exist on disk degrades to not-determined', () => {
    const doubled: ArchProject = {
      tsConfigPath: '/definitely/does/not/exist/tsconfig.json',
      _project: new Project({ useInMemoryFileSystem: true }),
      getSourceFiles: () => [],
    }
    expect(buildDiskSet(doubled).classify('**/anything/**')).toBe('not-determined')
  })
})
