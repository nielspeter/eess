import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { types } from '../../src/builders/type-rule-builder.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0295 — `extend()`, `implement()` and `extendType()` compare the text of the
 * subject's OWN clause, so a subject that reaches the base through an intermediate
 * class or interface is neither selected nor accepted.
 *
 * The KNOWN GAP tests detect a fix that makes the predicates transitive, and turn
 * red under it: invert them in the same change, and say so in the record. Under a
 * ruling that keeps direct semantics they stay green, and the record says so too.
 *
 * Each selector gap is shown by two derivations (ADR-009 rule 5): what the
 * predicate's rule reports, and what a rule selecting by name reports over the same
 * project — the second proves the dropped subject really violates. The CONTROLs
 * must survive any fix: an unrelated class stays unselected, and a base the checker
 * cannot resolve stays selected, which a walk-only fix would silently drop.
 */
function heritageProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  const db = '  db(table: string): string {\n    return table\n  }\n'
  const load = (t: string) => `  load(): string {\n    return this.db('${t}')\n  }\n`
  tsm.createSourceFile(
    '/src/base.ts',
    `export class BaseRepository {\n${db}}\nexport class Generic<T> {\n  value?: T\n}\n`,
  )
  tsm.createSourceFile(
    '/src/scoped.ts',
    "import { BaseRepository } from './base'\nexport class ScopedRepository extends BaseRepository {}\n",
  )
  tsm.createSourceFile(
    '/src/direct.ts',
    `import { BaseRepository } from './base'\nexport class DirectRepository extends BaseRepository {\n${load('direct')}}\n`,
  )
  tsm.createSourceFile(
    '/src/audit.ts',
    `import { ScopedRepository } from './scoped'\nexport class AuditRepository extends ScopedRepository {\n${load('audit')}}\n`,
  )
  tsm.createSourceFile(
    '/src/unrelated.ts',
    `export class UnrelatedRepository {\n${db}${load('unrelated')}}\n`,
  )
  tsm.createSourceFile(
    '/src/generic.ts',
    "import { Generic } from './base'\nexport class GenericChild extends Generic<string> {}\n",
  )
  tsm.createSourceFile(
    '/src/unresolved.ts',
    "import { Model } from 'not-installed-orm'\nexport class UnresolvedEntity extends Model {}\n",
  )
  tsm.createSourceFile(
    '/src/interfaces.ts',
    'export interface IBase {\n  x: number\n}\nexport interface IChild extends IBase {}\n',
  )
  tsm.createSourceFile(
    '/src/impl.ts',
    "import type { IBase, IChild } from './interfaces'\nexport class DirectImpl implements IBase {\n  x = 1\n}\nexport class ViaChildImpl implements IChild {\n  x = 1\n}\nexport class SubImpl extends DirectImpl {}\n",
  )
  tsm.createSourceFile(
    '/src/config.ts',
    'export interface BaseConfig {\n  a: number\n}\nexport interface Mid extends BaseConfig {}\nexport interface GrandCfg extends Mid {}\n',
  )
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function elements(result: readonly { element: string }[]): Set<string> {
  return new Set(result.map((v) => v.element))
}

function reportedBySubclassRule(p: ArchProject): Set<string> {
  return elements(
    classes(p)
      .that()
      .extend('BaseRepository')
      .should()
      .notContain(call('this.db'))
      .rule({ id: 'test/0295-extend-selector' })
      .violations(),
  )
}

function reportedByEveryRepositoryRule(p: ArchProject): Set<string> {
  return elements(
    classes(p)
      .that()
      .haveNameEndingWith('Repository')
      .should()
      .notContain(call('this.db'))
      .rule({ id: 'test/0295-every-repository' })
      .violations(),
  )
}

describe('bug 0295: heritage predicates read only the direct clause', () => {
  it('CONTROL — extend() selects a direct child and not an unrelated class', () => {
    const reported = reportedBySubclassRule(heritageProject())
    expect(reported).toContain('DirectRepository')
    expect(reported).not.toContain('UnrelatedRepository')
  })

  it('CONTROL — extend() selects a generic base and a base the checker cannot resolve', () => {
    const p = heritageProject()
    const selectedBy = (name: string) =>
      elements(
        classes(p)
          .that()
          .extend(name)
          .should()
          .notExist()
          .rule({ id: `test/0295-control-${name}` })
          .violations(),
      )
    expect(selectedBy('Generic')).toContain('GenericChild')
    expect(selectedBy('Model')).toContain('UnresolvedEntity')
  })

  it('KNOWN GAP — extend() as a selector drops a grandchild, so its violation is never reported', () => {
    const p = heritageProject()
    const reported = reportedBySubclassRule(p)
    // Positive anchor: the rule selects and reports something.
    expect(reported).toContain('DirectRepository')
    expect(reported).not.toContain('AuditRepository')
    // …and AuditRepository does violate, by a rule that selects it.
    expect(reportedByEveryRepositoryRule(p)).toContain('AuditRepository')
  })

  it('KNOWN GAP — extend() as a condition reds a grandchild of the base it names', () => {
    const reported = elements(
      classes(heritageProject())
        .that()
        .haveNameMatching(/^(Direct|Audit)Repository$/)
        .should()
        .extend('BaseRepository')
        .rule({ id: 'test/0295-extend-condition' })
        .violations(),
    )
    expect(reported).toContain('AuditRepository')
    expect(reported).not.toContain('DirectRepository')
  })

  it('KNOWN GAP — implement() as a selector drops a class that reaches the interface indirectly', () => {
    const selected = elements(
      classes(heritageProject())
        .that()
        .implement('IBase')
        .should()
        .notExist()
        .rule({ id: 'test/0295-implement-selector' })
        .violations(),
    )
    expect(selected).toContain('DirectImpl')
    expect(selected).not.toContain('ViaChildImpl')
    expect(selected).not.toContain('SubImpl')
  })

  it('KNOWN GAP — implement() as a condition reds a class that reaches the interface indirectly', () => {
    const reported = elements(
      classes(heritageProject())
        .that()
        .haveNameEndingWith('Impl')
        .should()
        .implement('IBase')
        .rule({ id: 'test/0295-implement-condition' })
        .violations(),
    )
    expect(reported).toContain('ViaChildImpl')
    expect(reported).toContain('SubImpl')
    expect(reported).not.toContain('DirectImpl')
  })

  it('KNOWN GAP — extendType() drops an interface that reaches the base through another interface', () => {
    const selected = elements(
      types(heritageProject())
        .that()
        .extendType('BaseConfig')
        .should()
        .notExist()
        .rule({ id: 'test/0295-extend-type' })
        .violations(),
    )
    expect(selected).toContain('Mid')
    expect(selected).not.toContain('GrandCfg')
  })
})
