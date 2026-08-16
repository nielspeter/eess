import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { loadedNothing, emptyProjectAdvice } from '../../src/core/empty-project-advice.js'
import type { ArchProject } from '../../src/core/project.js'

function projectWithFileCount(count: number): ArchProject {
  const tsProject = new Project({ useInMemoryFileSystem: true })
  for (let i = 0; i < count; i++) {
    tsProject.createSourceFile(`/repo/src/f${String(i)}.ts`, 'export {}')
  }
  return {
    tsConfigPath: '/repo/tsconfig.json',
    _project: tsProject,
    getSourceFiles: () => tsProject.getSourceFiles(),
  }
}

describe('loadedNothing', () => {
  it('true when the project has zero source files', () => {
    expect(loadedNothing(projectWithFileCount(0))).toBe(true)
  })

  it('false when the project has at least one source file', () => {
    expect(loadedNothing(projectWithFileCount(1))).toBe(false)
  })
})

describe('emptyProjectAdvice', () => {
  it('names the tsconfig path so the reader knows which config to fix', () => {
    const advice = emptyProjectAdvice(projectWithFileCount(0))
    expect(advice).toContain('/repo/tsconfig.json')
  })

  it('does not end in a period — callers append their own trailing sentence', () => {
    const advice = emptyProjectAdvice(projectWithFileCount(0))
    expect(advice.endsWith('.')).toBe(false)
  })

  it('mentions project references, the commonest real cause of a silently-empty project', () => {
    const advice = emptyProjectAdvice(projectWithFileCount(0))
    expect(advice).toContain('references')
  })
})
