import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { types } from '../../src/builders/type-rule-builder.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0296 — the heritage and decorator predicates compare the clause as written,
 * so a DIRECT base written through an alias, a namespace or a mixin call is missed.
 * No grandchild is involved; that is bug 0295.
 *
 * The KNOWN GAP tests assert today's behaviour. Fixing 0296 turns them red: invert
 * them into red-first tests in the same change, and say so in the record. The
 * CONTROL is the half that must survive the fix — each predicate still matches a
 * base written as its own imported name.
 */
function clauseTextProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(
    '/src/base.ts',
    'export class BaseRepository {}\nexport function Scoped<C extends new (...args: never[]) => object>(B: C) {\n  return class extends B {}\n}\n',
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
      '@Controller()',
      'export class PlainController {}',
      '@C()',
      'export class AliasedController {}',
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

function decoratorSelects(p: ArchProject): Set<string> {
  return elements(
    classes(p)
      .that()
      .haveDecorator('Controller')
      .should()
      .notExist()
      .rule({ id: 'test/0296-decorator' })
      .violations(),
  )
}

describe('bug 0296: heritage and decorator predicates compare the clause text', () => {
  it('CONTROL — each predicate matches a base written as its own imported name', () => {
    const p = clauseTextProject()
    expect(extendSelects(p)).toContain('DirectRepository')
    expect(implementSelects(p)).toContain('DirectImpl')
    expect(extendTypeSelects(p)).toContain('DirectCfg')
    expect(decoratorSelects(p)).toContain('PlainController')
  })

  it('KNOWN GAP — extend() as a selector drops a base written through an alias, a namespace or a mixin call', () => {
    const selected = extendSelects(clauseTextProject())
    expect(selected).toContain('DirectRepository')
    expect(selected).not.toContain('AliasedRepository')
    expect(selected).not.toContain('NamespacedRepository')
    expect(selected).not.toContain('MixinRepository')
  })

  it('KNOWN GAP — extend() as a condition reds a base written through an alias, a namespace or a mixin call', () => {
    const reported = elements(
      classes(clauseTextProject())
        .that()
        .haveNameEndingWith('Repository')
        .and()
        .haveNameMatching(/^(Direct|Aliased|Namespaced|Mixin)/)
        .should()
        .extend('BaseRepository')
        .rule({ id: 'test/0296-extend-condition' })
        .violations(),
    )
    expect(reported).not.toContain('DirectRepository')
    expect(reported).toContain('AliasedRepository')
    expect(reported).toContain('NamespacedRepository')
    expect(reported).toContain('MixinRepository')
  })

  it('KNOWN GAP — implement() drops and reds an interface imported under an alias', () => {
    const p = clauseTextProject()
    expect(implementSelects(p)).toContain('DirectImpl')
    expect(implementSelects(p)).not.toContain('AliasedImpl')

    const reported = elements(
      classes(p)
        .that()
        .haveNameEndingWith('Impl')
        .should()
        .implement('IBase')
        .rule({ id: 'test/0296-implement-condition' })
        .violations(),
    )
    expect(reported).toEqual(new Set(['AliasedImpl']))
  })

  it('KNOWN GAP — extendType() drops a base interface written through an alias or a namespace', () => {
    const selected = extendTypeSelects(clauseTextProject())
    expect(selected).toContain('DirectCfg')
    expect(selected).not.toContain('AliasCfg')
    expect(selected).not.toContain('NsCfg')
  })

  it('KNOWN GAP — haveDecorator() drops a decorator imported under an alias', () => {
    const selected = decoratorSelects(clauseTextProject())
    expect(selected).toContain('PlainController')
    expect(selected).not.toContain('AliasedController')
  })
})
