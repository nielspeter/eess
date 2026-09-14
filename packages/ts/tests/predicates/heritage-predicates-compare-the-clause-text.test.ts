import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { types } from '../../src/builders/type-rule-builder.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0296 — the heritage and decorator predicates compared the clause as written, so a
 * DIRECT base written through an alias, a namespace or a mixin call was missed. They now
 * match the clause as written OR the name the checker resolves it to, which only ever adds
 * matches. A grandchild is not a direct child; that is bug 0295, pinned separately.
 *
 * Every expectation is an exact set (ADR-009 rule 5), and each fixture carries a subject that
 * must NOT match — a class with no base, a class with no `implements` — so an assertion over a
 * condition's findings cannot pass over a rule that reports nothing.
 *
 * The same-file decorator CONTROL guards the resolution itself: a decorator that is not an
 * import has a symbol that is not an alias, so there is no target to resolve. It must still
 * match, by the name it is written with.
 */
function clauseTextProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  // The mixin takes `...args: any[]` because TypeScript only types a class expression that
  // extends a type parameter as a mixin when its constructor signature is exactly that
  // (TS2545). With any other signature the checker gives the result no base class, and the
  // predicates fall back to the written text — which does not name `BaseRepository`.
  tsm.createSourceFile(
    '/src/base.ts',
    'export class BaseRepository {}\nexport function Scoped<C extends new (...args: any[]) => object>(B: C) {\n  return class extends B {}\n}\n',
  )
  tsm.createSourceFile(
    '/src/repositories.ts',
    [
      "import { BaseRepository, Scoped } from './base'",
      "import { BaseRepository as Base } from './base'",
      "import * as base from './base'",
      'export class DirectRepository extends BaseRepository {}',
      'export class AliasedRepository extends Base {}',
      'export class NamespacedRepository extends base.BaseRepository {}',
      'export class MixinRepository extends Scoped(BaseRepository) {}',
      'export class UnrelatedRepository {}',
      '',
    ].join('\n'),
  )
  tsm.createSourceFile('/src/interfaces.ts', 'export interface IBase {\n  x: number\n}\n')
  tsm.createSourceFile(
    '/src/impl.ts',
    [
      "import type { IBase } from './interfaces'",
      "import type { IBase as B } from './interfaces'",
      'export class DirectImpl implements IBase {',
      '  x = 1',
      '}',
      'export class AliasedImpl implements B {',
      '  x = 1',
      '}',
      'export class BareImpl {',
      '  x = 1',
      '}',
      '',
    ].join('\n'),
  )
  tsm.createSourceFile('/src/config.ts', 'export interface BaseConfig {\n  a: number\n}\n')
  tsm.createSourceFile(
    '/src/configs.ts',
    [
      "import type { BaseConfig } from './config'",
      "import type { BaseConfig as BC } from './config'",
      "import type * as cfg from './config'",
      'export interface DirectCfg extends BaseConfig {}',
      'export interface AliasCfg extends BC {}',
      'export interface NsCfg extends cfg.BaseConfig {}',
      'export interface StandaloneCfg {',
      '  b: number',
      '}',
      '',
    ].join('\n'),
  )
  tsm.createSourceFile(
    '/src/decorators.ts',
    'export function Controller(): ClassDecorator {\n  return () => undefined\n}\n',
  )
  tsm.createSourceFile(
    '/src/controllers.ts',
    [
      "import { Controller } from './decorators'",
      "import { Controller as C } from './decorators'",
      'function Local(): ClassDecorator {',
      '  return () => undefined',
      '}',
      '@Controller()',
      'export class PlainController {}',
      '@C()',
      'export class AliasedController {}',
      '@Local()',
      'export class LocalController {}',
      'export class UndecoratedController {}',
      '',
    ].join('\n'),
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

function extendSelects(p: ArchProject): Set<string> {
  return elements(
    classes(p)
      .that()
      .extend('BaseRepository')
      .should()
      .notExist()
      .rule({ id: 'test/0296-extend-selector' })
      .violations(),
  )
}

function implementSelects(p: ArchProject): Set<string> {
  return elements(
    classes(p)
      .that()
      .implement('IBase')
      .should()
      .notExist()
      .rule({ id: 'test/0296-implement-selector' })
      .violations(),
  )
}

function extendTypeSelects(p: ArchProject): Set<string> {
  return elements(
    types(p)
      .that()
      .extendType('BaseConfig')
      .should()
      .notExist()
      .rule({ id: 'test/0296-extend-type' })
      .violations(),
  )
}

function decoratorSelects(p: ArchProject, name: string): Set<string> {
  return elements(
    classes(p)
      .that()
      .haveDecorator(name)
      .should()
      .notExist()
      .rule({ id: `test/0296-decorator-${name}` })
      .violations(),
  )
}

describe('bug 0296: heritage and decorator predicates match a base however it is written', () => {
  it('CONTROL — each predicate matches a base written as its own imported name', () => {
    const p = clauseTextProject()
    expect(extendSelects(p)).toContain('DirectRepository')
    expect(implementSelects(p)).toContain('DirectImpl')
    expect(extendTypeSelects(p)).toContain('DirectCfg')
    expect(decoratorSelects(p, 'Controller')).toContain('PlainController')
  })

  it('CONTROL — a decorator declared in the same file, not imported, is matched by its name', () => {
    expect(decoratorSelects(clauseTextProject(), 'Local')).toEqual(new Set(['LocalController']))
  })

  it('extend() as a selector matches a base written through an alias, a namespace or a mixin call', () => {
    expect(extendSelects(clauseTextProject())).toEqual(
      new Set(['DirectRepository', 'AliasedRepository', 'NamespacedRepository', 'MixinRepository']),
    )
  })

  it('extend() as a condition accepts a base written through an alias, a namespace or a mixin call', () => {
    const reported = elements(
      classes(clauseTextProject())
        .that()
        .haveNameEndingWith('Repository')
        .and()
        .haveNameMatching(/^(Direct|Aliased|Namespaced|Mixin|Unrelated)/)
        .should()
        .extend('BaseRepository')
        .rule({ id: 'test/0296-extend-condition' })
        .violations(),
    )
    expect(reported).toEqual(new Set(['UnrelatedRepository']))
  })

  it('implement() matches an interface imported under an alias, as a selector and as a condition', () => {
    const p = clauseTextProject()
    expect(implementSelects(p)).toEqual(new Set(['DirectImpl', 'AliasedImpl']))

    const reported = elements(
      classes(p)
        .that()
        .haveNameEndingWith('Impl')
        .should()
        .implement('IBase')
        .rule({ id: 'test/0296-implement-condition' })
        .violations(),
    )
    expect(reported).toEqual(new Set(['BareImpl']))
  })

  it('extendType() matches a base interface written through an alias or a namespace', () => {
    expect(extendTypeSelects(clauseTextProject())).toEqual(
      new Set(['DirectCfg', 'AliasCfg', 'NsCfg']),
    )
  })

  it('haveDecorator() and haveDecoratorMatching() match a decorator imported under an alias', () => {
    const p = clauseTextProject()
    expect(decoratorSelects(p, 'Controller')).toEqual(
      new Set(['PlainController', 'AliasedController']),
    )
    const matching = elements(
      classes(p)
        .that()
        .haveDecoratorMatching(/^Controller$/)
        .should()
        .notExist()
        .rule({ id: 'test/0296-decorator-matching' })
        .violations(),
    )
    expect(matching).toEqual(new Set(['PlainController', 'AliasedController']))
  })
})
