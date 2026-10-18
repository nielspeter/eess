import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions, modules, ArchRuleError } from '../../src/index.js'
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
 * `notExist()` rule over zero subjects passed with it exactly as without it.
 * Bug 0466 — on that rule shape the declaration can never pass. So eess-ts now
 * reports the combination on both paths with one remedy, and below every
 * finding about the instrument or the selector (ADR-010 §3).
 */
describe('eess-ts reads .expectNonEmpty() on a notExist() rule (bugs 0467, 0466)', () => {
  const none = (): ReturnType<typeof functions> =>
    functions(p)
      .that()
      .haveNameMatching(/^NoSuchFunctionXyz0467$/)

  it('a notExist() rule over zero subjects still passes without the declaration', () => {
    expect(none().should().notExist().violations()).toHaveLength(0)
  })

  it('with the declaration, an empty selection reports that the rule can never pass', () => {
    const found = none().expectNonEmpty().should().notExist().violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toContain('can never pass')
    // Not the unmet-declaration remedy, which cannot help on this shape.
    expect(found[0]?.message).not.toContain('fix the selection')
    expect(found[0]?.suggestion).toContain('Remove .expectNonEmpty()')
    expect(found[0]?.bypassFilters).toBe(true)
    expect(() => none().expectNonEmpty().should().notExist().check()).toThrow(ArchRuleError)
  })

  it('with the declaration, a non-empty selection reports it first, beside the condition', () => {
    const found = functions(p)
      .that()
      .haveNameMatching(/^fetchOrders$/)
      .expectNonEmpty()
      .should()
      .notExist()
      .violations()
    expect(found[0]?.message).toContain('can never pass')
    expect(found.length).toBeGreaterThan(1)
  })

  it('a dead glob outranks it: the selector finding is reported, not the declaration', () => {
    const found = modules(p)
      .that()
      .resideInFolder('./nowhere-0467/**')
      .expectNonEmpty()
      .should()
      .notExist()
      .violations()
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((v) => !v.message.includes('can never pass'))).toBe(true)
  })
})
