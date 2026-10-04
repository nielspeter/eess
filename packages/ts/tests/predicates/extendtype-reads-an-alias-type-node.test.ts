import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { types } from '../../src/builders/type-rule-builder.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0376 — for a type alias, `extendType` tested a regex against the alias's PRINTED type,
 * which for most aliases is the alias's own name. So `type X = BaseConfig & { b: 1 }` — the
 * alias shape most likely to mean "extends" — was never selected by `extendType('BaseConfig')`.
 * The alias's type node is read now: an intersection member counts, as written, as resolved,
 * or through an interface chain (ADR-017). What matched before still matches.
 */
function project(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(
    '/src/base.ts',
    'export interface BaseConfig {\n  a: number\n}\nexport interface Mid extends BaseConfig {}\nexport interface Other {\n  o: number\n}\n',
  )
  tsm.createSourceFile(
    '/src/aliases.ts',
    [
      "import type { BaseConfig, Mid, Other } from './base'",
      "import type { BaseConfig as BC } from './base'",
      'export type Intersection = BaseConfig & { b: 1 }',
      'export type IntersectionFirstOther = Other & BaseConfig',
      'export type ViaAlias = BC & { c: 1 }',
      'export type ViaChain = Mid & { d: 1 }',
      'export type Plain = BaseConfig',
      'export type Wrapped = Partial<BaseConfig>',
      'export type Holds = { inner: BaseConfig }',
      'export type Unrelated = Other & { e: 1 }',
      "import type { Missing } from 'not-installed'",
      'export type Unresolved = Missing & { f: 1 }',
      'export type Parenthesised = (BaseConfig & { g: 1 })',
      'export type Nested = { h: 1 } & (Mid & { i: 1 })',
      'export type Either = BaseConfig | Other',
      '',
    ].join('\n'),
  )
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function selected(name: string): Set<string> {
  return new Set(
    types(project())
      .that()
      .extendType(name)
      .should()
      .notExist()
      .rule({ id: `test/0376-${name}` })
      .violations()
      .map((v) => v.element),
  )
}

describe('bug 0376: extendType reads a type alias by its type node', () => {
  it('selects an intersection alias that names the type, wherever it sits in the intersection', () => {
    const s = selected('BaseConfig')
    expect(s).toContain('Intersection')
    expect(s).toContain('IntersectionFirstOther')
  })

  it('selects an intersection member written through an aliased import or reaching the type by its chain', () => {
    const s = selected('BaseConfig')
    expect(s).toContain('ViaAlias')
    expect(s).toContain('ViaChain')
  })

  it('keeps what matched before, and does not select a type that only holds the named one', () => {
    const s = selected('BaseConfig')
    expect(s).toContain('Plain')
    expect(s).toContain('Wrapped')
    expect(s).toContain('Mid')
    expect(s).not.toContain('Holds')
    expect(s).not.toContain('Unrelated')
  })

  it('reads a member by its written name when it cannot be resolved', () => {
    // The symbol arm covers every resolvable member, so only an unresolved one pins this arm.
    expect(selected('Missing')).toContain('Unresolved')
  })

  it('looks through parentheses and nested intersections, and does not read a union', () => {
    const s = selected('BaseConfig')
    expect(s).toContain('Parenthesised')
    expect(s).toContain('Nested')
    // A union member does not make the alias extend it.
    expect(s).not.toContain('Either')
  })
})
