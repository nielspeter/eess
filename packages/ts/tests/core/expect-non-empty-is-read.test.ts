import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions, ArchRuleError } from '../../src/index.js'
import type { ArchProject } from '../../src/core/project.js'

const tsconfigPath = path.resolve(import.meta.dirname, '../fixtures/modules/tsconfig.json')

function loadProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

const p = loadProject()

/**
 * Bug 0467 — `.expectNonEmpty()` set a flag that no evaluation path read, so a
 * `notExist()` rule over zero subjects passed with it exactly as without it. It
 * now reds over an empty selection and names the declaration, as the kernel's
 * `TerminalBuilder` does.
 */
describe('eess-ts reads .expectNonEmpty() (bug 0467)', () => {
  const none = (): ReturnType<typeof functions> =>
    functions(p)
      .that()
      .haveNameMatching(/^NoSuchFunctionXyz0467$/)

  it('a notExist() rule over zero subjects still passes without the declaration', () => {
    expect(none().should().notExist().violations()).toHaveLength(0)
  })

  it('expectNonEmpty() reds a notExist() rule over zero subjects and names the declaration', () => {
    const found = none().expectNonEmpty().should().notExist().violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toContain('declared .expectNonEmpty() but examined zero units')
    expect(found[0]?.bypassFilters).toBe(true)
    expect(() => none().expectNonEmpty().should().notExist().check()).toThrow(ArchRuleError)
  })
})
