import { describe, it, expect } from 'vitest'
import { diagram } from '../../src/core/diagram.js'
import { classes, ClassRuleBuilder } from '../../src/builders/class-rule-builder.js'
import { ArchRuleError } from '@nielspeter/eess'

const KITCHEN_SINK = [
  'classDiagram',
  'class BaseService',
  '<<abstract>> BaseService',
  'class OrderService',
  '<<service>> OrderService',
  'class OrderRepository',
  '<<repository>> OrderRepository',
  'class PaymentService',
  '<<service>> PaymentService',
  'BaseService <|-- OrderService',
  'BaseService <|-- PaymentService',
  'OrderService --> OrderRepository',
].join('\n')

describe('ClassRuleBuilder', () => {
  const d = diagram(KITCHEN_SINK)

  describe('getElements()', () => {
    it('returns all classes from the diagram', () => {
      const builder = new ClassRuleBuilder(d)
      expect(() => builder.should().notExist().check()).toThrow(ArchRuleError)
    })
  })

  describe('predicate wiring', () => {
    it('haveStereotype filters by stereotype', () => {
      expect(() => {
        classes(d).that().haveStereotype('repository').should().notExist().check()
      }).toThrow(ArchRuleError)
    })

    it('haveNameMatching filters by regex', () => {
      expect(() => {
        classes(d)
          .that()
          .haveNameMatching(/Service$/)
          .should()
          .notExist()
          .check()
      }).toThrow(ArchRuleError)
    })

    it('haveNameStartingWith filters by prefix', () => {
      expect(() => {
        classes(d).that().haveNameStartingWith('Order').should().notExist().check()
      }).toThrow(ArchRuleError)
    })

    it('haveNameEndingWith filters by suffix', () => {
      expect(() => {
        classes(d).that().haveNameEndingWith('Repository').should().notExist().check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('condition wiring — extend', () => {
    it('passes when classes extend the expected superclass', () => {
      expect(() => {
        classes(d).that().haveStereotype('service').should().extend('BaseService').check()
      }).not.toThrow()
    })

    it('throws when a service does not extend BaseService', () => {
      const isolated = diagram(
        ['classDiagram', 'class StandaloneService', '<<service>> StandaloneService'].join('\n'),
      )
      expect(() => {
        classes(isolated).that().haveStereotype('service').should().extend('BaseService').check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('predicate wiring — extra', () => {
    it('areAbstract filters by <<abstract>> stereotype', () => {
      const a = diagram(['classDiagram', 'class Foo', '<<abstract>> Foo'].join('\n'))
      expect(() => {
        classes(a).that().areAbstract().should().notExist().check()
      }).toThrow(ArchRuleError)
    })

    it('haveAtLeastOneMethod filters by methods presence', () => {
      const a = diagram('classDiagram\nclass Foo {\n  +run()\n}\nclass Bar')
      expect(() => {
        classes(a).that().haveAtLeastOneMethod().should().notExist().check()
      }).toThrow(ArchRuleError)
    })

    it('haveNoMembers filters by empty body', () => {
      const a = diagram('classDiagram\nclass Foo\nclass Bar { +run() }')
      expect(() => {
        classes(a).that().haveNoMembers().should().notExist().check()
      }).toThrow(ArchRuleError)
    })

    it('extendName filters classes that inherit from a given parent', () => {
      const a = diagram(['classDiagram', 'class Base', 'class Sub', 'Base <|-- Sub'].join('\n'))
      expect(() => {
        classes(a).that().extendName('Base').should().notExist().check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('condition wiring — extra', () => {
    it('notHaveStereotype throws when present', () => {
      const a = diagram('classDiagram\nclass Foo\n<<service>> Foo')
      expect(() => {
        classes(a).should().notHaveStereotype('service').check()
      }).toThrow(ArchRuleError)
    })

    it('dependOn passes when the dependency exists', () => {
      const a = diagram(['classDiagram', 'class Foo', 'class Bar', 'Foo --> Bar'].join('\n'))
      expect(() => {
        classes(a).that().haveNameMatching(/^Foo$/).should().dependOn('Bar').check()
      }).not.toThrow()
    })

    it('notDependOn throws when an edge exists', () => {
      const a = diagram(['classDiagram', 'class Foo', 'class Bar', 'Foo --> Bar'].join('\n'))
      expect(() => {
        classes(a).that().haveNameMatching(/^Foo$/).should().notDependOn('Bar').check()
      }).toThrow(ArchRuleError)
    })

    it('notDependOnStereotype throws across stereotype boundaries', () => {
      const a = diagram(
        ['classDiagram', 'class S', '<<service>> S', 'class R', '<<repository>> R', 'R --> S'].join(
          '\n',
        ),
      )
      expect(() => {
        classes(a)
          .that()
          .haveStereotype('repository')
          .should()
          .notDependOnStereotype('service')
          .check()
      }).toThrow(ArchRuleError)
    })
  })

  describe('condition wiring — notExtendStereotype', () => {
    it('passes when no inheritance violates the stereotype rule', () => {
      expect(() => {
        classes(d)
          .that()
          .haveStereotype('service')
          .should()
          .notExtendStereotype('repository')
          .check()
      }).not.toThrow()
    })

    it('throws when a service extends a repository', () => {
      const bad = diagram(
        [
          'classDiagram',
          'class Foo',
          '<<service>> Foo',
          'class Bar',
          '<<repository>> Bar',
          'Bar <|-- Foo',
        ].join('\n'),
      )
      expect(() => {
        classes(bad)
          .that()
          .haveStereotype('service')
          .should()
          .notExtendStereotype('repository')
          .check()
      }).toThrow(ArchRuleError)
    })
  })
})
