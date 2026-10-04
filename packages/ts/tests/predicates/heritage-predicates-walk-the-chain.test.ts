import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { types } from '../../src/builders/type-rule-builder.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0295 — `extend()`, `implement()` and `extendType()` compared the text of the
 * subject's OWN clause, so a subject that reached the base through an intermediate
 * class or interface was neither selected nor accepted. ADR-017 rules that they walk
 * the chain; these tests were KNOWN-GAP pins of the direct reading, inverted by the fix.
 *
 * Each selector case is shown by two derivations (ADR-009 rule 5): what the
 * predicate's rule reports, and what a rule selecting by name reports over the same
 * project — the second proves the reached subject really violates. The CONTROLs
 * predate the fix and must survive it: an unrelated class stays unselected, and a base
 * the checker cannot resolve stays selected, which a walk-only fix would silently drop.
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

describe('bug 0295: heritage predicates walk the chain', () => {
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

  it('extend() as a selector reaches a grandchild, so its violation is reported', () => {
    const p = heritageProject()
    const reported = reportedBySubclassRule(p)
    expect(reported).toContain('DirectRepository')
    expect(reported).toContain('AuditRepository')
    // Second derivation (ADR-009 rule 5): a rule selecting by name agrees it violates.
    expect(reportedByEveryRepositoryRule(p)).toContain('AuditRepository')
  })

  it('extend() as a condition accepts a grandchild of the base it names', () => {
    const reported = elements(
      classes(heritageProject())
        .that()
        .haveNameMatching(/^(Direct|Audit|Unrelated)Repository$/)
        .should()
        .extend('BaseRepository')
        .rule({ id: 'test/0295-extend-condition' })
        .violations(),
    )
    // Positive anchor: the condition still reds a class outside the hierarchy.
    expect(reported).toContain('UnrelatedRepository')
    expect(reported).not.toContain('AuditRepository')
    expect(reported).not.toContain('DirectRepository')
  })

  it('implement() as a selector reaches a class that implements the interface indirectly', () => {
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
    expect(selected).toContain('ViaChildImpl')
    expect(selected).toContain('SubImpl')
    expect(selected).not.toContain('UnrelatedRepository')
  })

  it('implement() as a condition accepts a class that implements the interface indirectly', () => {
    const reported = elements(
      classes(heritageProject())
        .that()
        .haveNameMatching(/Impl$|^UnrelatedRepository$/)
        .should()
        .implement('IBase')
        .rule({ id: 'test/0295-implement-condition' })
        .violations(),
    )
    expect(reported).toContain('UnrelatedRepository')
    expect(reported).not.toContain('ViaChildImpl')
    expect(reported).not.toContain('SubImpl')
    expect(reported).not.toContain('DirectImpl')
  })

  it('extendType() reaches an interface that extends the base through another interface', () => {
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
    expect(selected).toContain('GrandCfg')
    expect(selected).not.toContain('IBase')
  })

  it('the walk still matches by name where a level of the chain cannot be resolved', () => {
    // UnresolvedEntity resolves; its own base, Model, does not. The walk reaches
    // UnresolvedEntity and matches its clause by text, as the direct check did.
    const p = heritageProject()
    p._project.createSourceFile(
      '/src/order.ts',
      "import { UnresolvedEntity } from './unresolved'\nexport class Order extends UnresolvedEntity {}\n",
    )
    const selected = elements(
      classes(p)
        .that()
        .extend('Model')
        .should()
        .notExist()
        .rule({ id: 'test/0295-unresolved-level' })
        .violations(),
    )
    expect(selected).toContain('UnresolvedEntity')
    expect(selected).toContain('Order')
  })

  it('a heritage cycle ends the walk instead of looping', () => {
    const tsm = new Project({ useInMemoryFileSystem: true })
    tsm.createSourceFile(
      '/src/cycle.ts',
      'export class A extends B {}\nexport class B extends A {}\nexport interface I extends J {}\nexport interface J extends I {}\nexport class C implements I {}\n',
    )
    const p: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    expect(
      elements(
        classes(p)
          .that()
          .extend('Nowhere')
          .should()
          .notExist()
          .rule({ id: 'test/0295-cycle-a' })
          .violations(),
      ),
    ).toEqual(new Set())
    expect(
      elements(
        classes(p)
          .that()
          .implement('Nowhere')
          .should()
          .notExist()
          .rule({ id: 'test/0295-cycle-i' })
          .violations(),
      ),
    ).toEqual(new Set())
    expect(
      elements(
        types(p)
          .that()
          .extendType('Nowhere')
          .should()
          .notExist()
          .rule({ id: 'test/0295-cycle-t' })
          .violations(),
      ),
    ).toEqual(new Set())
    // Positive anchors: the clauses are still read. The checker gives a class on a circular
    // chain no base class, so each matches only its own clause; the interfaces resolve, so
    // C reaches J through I.
    expect(
      elements(
        classes(p)
          .that()
          .extend('A')
          .should()
          .notExist()
          .rule({ id: 'test/0295-cycle-a2' })
          .violations(),
      ),
    ).toEqual(new Set(['B']))
    expect(
      elements(
        classes(p)
          .that()
          .implement('J')
          .should()
          .notExist()
          .rule({ id: 'test/0295-cycle-j' })
          .violations(),
      ),
    ).toEqual(new Set(['C']))
  })
})

/**
 * Added after review: every chain above is two levels deep, so a walk that climbed one
 * level, or an interface walk that did not recurse, stayed green. And the text arm of the
 * per-level comparison was proven for `extend` only. These reach depth 3, and put an
 * unresolved name in an `implements` clause and an interface's `extends` clause.
 */
function deepProject(): ArchProject {
  const p = heritageProject()
  const tsm = p._project
  tsm.createSourceFile(
    '/src/ledger.ts',
    "import { AuditRepository as AuditAlias } from './audit'\nexport class LedgerRepository extends AuditAlias {\n  post(): string {\n    return this.db('ledger')\n  }\n}\n",
  )
  tsm.createSourceFile(
    '/src/generic-deep.ts',
    "import { Generic } from './base'\nexport class GenericMid<T> extends Generic<T> {}\nexport class GenericDeep extends GenericMid<number> {}\n",
  )
  tsm.createSourceFile(
    '/src/deep-interfaces.ts',
    "import type { IChild } from './interfaces'\nimport type { GrandCfg } from './config'\nexport interface IGrandChild extends IChild {}\nexport interface GreatCfg extends GrandCfg {}\nexport class DeepImpl implements IGrandChild {\n  x = 1\n}\nexport class ViaChildBase implements IChild {\n  x = 1\n}\nexport class ViaChildSub extends ViaChildBase {}\nexport class ViaChildSubSub extends ViaChildSub {}\n",
  )
  tsm.createSourceFile(
    '/src/orm.ts',
    "import type { IOrm } from 'not-installed-orm'\nexport class OrmImpl implements IOrm {}\nexport class OrmSub extends OrmImpl {}\nexport interface IOrmExt extends IOrm {}\nexport interface IOrmExt2 extends IOrmExt {}\nexport class OrmViaExt implements IOrmExt2 {}\n",
  )
  return p
}

function selectedClasses(p: ArchProject, by: 'extend' | 'implement', name: string): Set<string> {
  const that = classes(p).that()
  return elements(
    (by === 'extend' ? that.extend(name) : that.implement(name))
      .should()
      .notExist()
      .rule({ id: `test/0295-deep-${by}-${name}` })
      .violations(),
  )
}

describe('bug 0295: the walk reaches past depth 2', () => {
  it('extend() reaches a great-grandchild written through an aliased import, and a generic base two levels up', () => {
    const p = deepProject()
    // The condition is asserted first, so it reds on its own when the walk stops short —
    // not only because the selector assertion before it already failed.
    const reported = elements(
      classes(p)
        .that()
        .haveNameMatching(/^(Ledger|Unrelated)Repository$/)
        .should()
        .extend('BaseRepository')
        .rule({ id: 'test/0295-deep-extend-condition' })
        .violations(),
    )
    expect(reported).toContain('UnrelatedRepository')
    expect(reported).not.toContain('LedgerRepository')
    expect(reportedBySubclassRule(p)).toContain('LedgerRepository')
    expect(selectedClasses(p, 'extend', 'Generic')).toEqual(
      new Set(['GenericChild', 'GenericMid', 'GenericDeep']),
    )
  })

  it('implement() and extendType() recurse through more than one extended interface', () => {
    const p = deepProject()
    // DeepImpl → IGrandChild → IChild → IBase: two interface steps past the clause.
    expect(selectedClasses(p, 'implement', 'IBase')).toContain('DeepImpl')
    const types_ = elements(
      types(p)
        .that()
        .extendType('BaseConfig')
        .should()
        .notExist()
        .rule({ id: 'test/0295-deep-extend-type' })
        .violations(),
    )
    expect(types_).toEqual(new Set(['Mid', 'GrandCfg', 'GreatCfg']))
  })

  it('implement() reaches through an ancestor that implements a sub-interface', () => {
    const selected = selectedClasses(deepProject(), 'implement', 'IBase')
    for (const name of ['ViaChildBase', 'ViaChildSub', 'ViaChildSubSub']) {
      expect(selected).toContain(name)
    }
    expect(selected).not.toContain('UnrelatedRepository')
  })

  it('an unresolved name in an implements or interface extends clause still matches by its text', () => {
    const p = deepProject()
    expect(selectedClasses(p, 'implement', 'IOrm')).toEqual(
      new Set(['OrmImpl', 'OrmSub', 'OrmViaExt']),
    )
    const types_ = elements(
      types(p)
        .that()
        .extendType('IOrm')
        .should()
        .notExist()
        .rule({ id: 'test/0295-deep-unresolved-type' })
        .violations(),
    )
    expect(types_).toEqual(new Set(['IOrmExt', 'IOrmExt2']))
  })
})

/**
 * ADR-017 rule 5 says the checker breaks every circular class chain, so the class walk needs no
 * guard. These are the seven shapes that claim was measured on, kept here so the evidence
 * can be re-run. Asking for a base nothing extends makes the walk climb every chain to its end;
 * if one never ended, the test would crash its worker rather than pass.
 */
describe('bug 0295: the checker breaks every circular class chain', () => {
  const shapes: Record<string, Record<string, string>> = {
    'self-extend': { '/src/a.ts': 'export class A extends A {}\n' },
    pair: { '/src/a.ts': 'export class A extends B {}\nexport class B extends A {}\n' },
    'cross-file pair': {
      '/src/a.ts': "import { B } from './b'\nexport class A extends B {}\n",
      '/src/b.ts': "import { A } from './a'\nexport class B extends A {}\n",
    },
    'declaration merge': {
      '/src/a.ts':
        'export class A extends B {}\nexport interface B extends A {}\nexport class B {}\n',
    },
    mixin: {
      '/src/a.ts':
        'type Ctor = new (...a: never[]) => object\nconst M = <T extends Ctor>(b: T) => class extends b {}\nexport class A extends M(B) {}\nexport class B extends M(A) {}\n',
    },
    'ambient pair': {
      '/src/a.d.ts': 'declare class A extends B {}\ndeclare class B extends A {}\n',
    },
  }
  for (const [name, files] of Object.entries(shapes)) {
    it(`a circular chain ends — ${name}`, () => {
      const tsm = new Project({ useInMemoryFileSystem: true })
      for (const [path, text] of Object.entries(files)) tsm.createSourceFile(path, text)
      const p: ArchProject = {
        tsConfigPath: '/tsconfig.json',
        _project: tsm,
        getSourceFiles: () => tsm.getSourceFiles(),
      }
      const selected = elements(
        classes(p)
          .that()
          .extend('Nowhere')
          .should()
          .notExist()
          .rule({ id: `test/0295-circular-${name}` })
          .violations(),
      )
      expect(selected).toEqual(new Set())
    })
  }

  it('a circular chain ends — JS file', () => {
    const tsm = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } })
    tsm.createSourceFile('/src/a.js', 'class A extends B {}\nclass B extends A {}\n')
    const p: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    const examined = classes(p)
      .that()
      .extend('Nowhere')
      .should()
      .notExist()
      .rule({ id: 'test/0295-circular-js' })
      .violations()
    expect(elements(examined)).toEqual(new Set())
  })
})
