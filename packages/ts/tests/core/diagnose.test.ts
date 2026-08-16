import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { ClassRuleBuilder } from '../../src/builders/class-rule-builder.js'
import { diagnose } from '../../src/core/diagnose.js'
import type { ArchProject } from '../../src/core/project.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/poc')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

/** A project that loaded zero source files — the tsconfig-matches-nothing case. */
function emptyProject(): ArchProject {
  const tsMorphProject = new Project({ useInMemoryFileSystem: true })
  return {
    tsConfigPath: '/virtual/tsconfig.json',
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

describe('diagnose()', () => {
  const p = loadTestProject()

  it('reports a dead-glob finding for a resideInFolder() glob that can never match', () => {
    const rule = new ClassRuleBuilder(p)
      .that()
      .resideInFolder('**/this-folder-does-not-exist-anywhere/**')
      .should()
      .beExported()

    const findings = diagnose([rule])
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ kind: 'dead-glob' })
    expect(findings[0]!.glob).toBe('**/this-folder-does-not-exist-anywhere/**')
    expect(findings[0]!.advice).toContain('no file or directory matching this was found')
  })

  it('reports nothing for a rule whose declared glob is live', () => {
    const rule = new ClassRuleBuilder(p).that().resideInFolder('**/src/**').should().beExported()

    expect(diagnose([rule])).toEqual([])
  })

  it('reports nothing for a live glob narrowed to zero matches by a further predicate', () => {
    // An ordinary empty SELECTION, not a dead glob — diagnose() must not
    // conflate the two, or it reports a false "this glob can never match"
    // about a glob that plainly can.
    const rule = new ClassRuleBuilder(p)
      .that()
      .resideInFolder('**/src/**')
      .and()
      .haveNameMatching(/^NothingNamedThisExists$/)
      .should()
      .beExported()

    expect(diagnose([rule])).toEqual([])
  })

  it('reports a project-empty finding once per project, not once per rule', () => {
    const empty = emptyProject()
    const ruleA = new ClassRuleBuilder(empty)
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
    const ruleB = new ClassRuleBuilder(empty)
      .that()
      .resideInFolder('**/other/**')
      .should()
      .beExported()

    const findings = diagnose([ruleA, ruleB])
    const projectEmpty = findings.filter((f) => f.kind === 'project-empty')
    expect(projectEmpty).toHaveLength(1)
  })

  it('does not blame individual glob spelling when the project itself loaded nothing', () => {
    // Bug-0031-class: diagnosing each glob against an empty project would
    // otherwise report every one of them as independently malformed, when
    // the real cause is the project, not any one glob.
    const empty = emptyProject()
    const rule = new ClassRuleBuilder(empty)
      .that()
      .resideInFolder('**/perfectly/valid/**')
      .should()
      .beExported()

    const findings = diagnose([rule])
    expect(findings).toHaveLength(1)
    expect(findings[0]!.kind).toBe('project-empty')
  })

  it('returns no findings for a rule with no globs() method (a foreign RuleBuilderLike)', () => {
    const bareRule = { check: (): void => {} }
    expect(diagnose([bareRule])).toEqual([])
  })

  it('falls back to the project parameter when a rule cannot name its own', () => {
    const empty = emptyProject()
    const rule = new ClassRuleBuilder(empty)
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
    // A builder that can declare globs but not its own project (no
    // `getProject()`) — the caller-supplied fallback parameter must still
    // be consulted, not silently skipped.
    const namelessRule = { check: (): void => {}, globs: () => rule.globs() }

    const findings = diagnose([namelessRule], empty)
    expect(findings.some((f) => f.kind === 'project-empty')).toBe(true)
  })
})
