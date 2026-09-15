import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { resolvers } from '../../src/graphql/index.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0315 — since the function collection returns a class's constructor and accessors beside its
 * methods, a class-based resolver's injected constructor and its getters would be selected as
 * resolvers, and fail every `contain(...)` rule written against them. `resolvers()` leaves them out;
 * its methods and function-valued properties stay.
 */
const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/graphql')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

describe('bug 0315: resolvers() leaves out constructors and accessors', () => {
  it('a class-based resolver is judged on its methods and function-valued properties only', () => {
    const p = loadTestProject()

    const subjects = resolvers(p, 'src/**/class-based-0315.ts')
      .should()
      .notContain(call('loader.load'))
      .rule({ id: 'test/0315-resolver-subjects' })
      .violations()

    expect(subjects.map((v) => v.element).sort()).toEqual([
      'AssetResolver.asset',
      'AssetResolver.related',
    ])
  })
})
