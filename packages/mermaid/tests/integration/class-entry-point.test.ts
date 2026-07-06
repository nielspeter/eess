import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { diagram } from '../../src/core/diagram.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { fromDiagram } from '../../src/bridge/from-diagram.js'
import { ArchRuleError } from '@nielspeter/eess'

const fixture = path.resolve(import.meta.dirname, '../fixtures/classes/layered.mmd')

describe('classes() entry point — file fixture integration', () => {
  const d = diagram(fixture)

  it('loads a diagram from a .mmd file', () => {
    expect(d.filePath).toBe(fixture)
    expect(d.ast.classes.map((c) => c.name)).toEqual([
      'BaseService',
      'OrderService',
      'OrderRepository',
      'PaymentService',
    ])
  })

  it('all services should extend BaseService', () => {
    expect(() => {
      classes(d)
        .that()
        .haveStereotype('service')
        .should()
        .extend('BaseService')
        .rule({
          id: 'arch/services-extend-base',
          because: 'Every service must inherit shared logging/transactional behavior',
          suggestion: 'Extend BaseService',
        })
        .check()
    }).not.toThrow()
  })

  it('services must not extend repositories', () => {
    expect(() => {
      classes(d).that().haveStereotype('service').should().notExtendStereotype('repository').check()
    }).not.toThrow()
  })

  it('produces a violation message that points at the diagram source', () => {
    const bad = diagram(
      [
        'classDiagram',
        'class BadService',
        '<<service>> BadService',
        'class FooRepo',
        '<<repository>> FooRepo',
        'FooRepo <|-- BadService',
      ].join('\n'),
    )
    let captured: Error | undefined
    try {
      classes(bad)
        .that()
        .haveStereotype('service')
        .should()
        .notExtendStereotype('repository')
        .rule({
          id: 'arch/no-service-from-repo',
          because: 'Services may depend on repositories, never inherit from them',
          suggestion: 'Refactor to composition',
        })
        .check()
    } catch (e) {
      captured = e as Error
    }
    expect(captured).toBeInstanceOf(ArchRuleError)
    const err = captured as ArchRuleError
    expect(err.violations).toHaveLength(1)
    expect(err.violations[0]!.ruleId).toBe('arch/no-service-from-repo')
    expect(err.violations[0]!.element).toBe('BadService')
  })
})

describe('fromDiagram bridge — file fixture integration', () => {
  const d = diagram(fixture)

  it('emits eess-ts-shaped layered config', () => {
    const out = fromDiagram(d, {
      stereotypeToFolder: {
        abstract: 'src/abstract/**',
        service: 'src/services/**',
        repository: 'src/repositories/**',
      },
    })
    expect(out.allowed).toContainEqual(['service', 'repository'])
    expect(out.layers).toMatchObject({
      service: 'src/services/**',
      repository: 'src/repositories/**',
    })
    expect(out.rules.some((r) => r.kind === 'inheritance')).toBe(true)
    expect(out.rules.some((r) => r.kind === 'allowed-edge')).toBe(true)
    expect(out.rules.some((r) => r.kind === 'forbidden-edge')).toBe(true)
  })
})
