import { describe, it, expect } from 'vitest'
import { parseClassDiagram, MermaidUnitParseError } from '../../src/parser/parse-class-diagram.js'

describe('parseClassDiagram', () => {
  it('parses a minimal classDiagram header', () => {
    const ast = parseClassDiagram('classDiagram')
    expect(ast.$type).toBe('Diagram')
  })

  it('rejects an unknown header keyword', () => {
    expect(() => parseClassDiagram('graph TD')).toThrow(MermaidUnitParseError)
  })

  describe('class declarations', () => {
    it('parses one class', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo')
      expect(ast.classes.map((c) => c.name)).toEqual(['Foo'])
    })

    it('parses one class with empty body', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {}')
      expect(ast.classes.map((c) => c.name)).toEqual(['Foo'])
    })

    it('parses multiple classes', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo\nclass Bar\nclass Baz')
      expect(ast.classes.map((c) => c.name)).toEqual(['Foo', 'Bar', 'Baz'])
    })

    it('rejects class names starting with a digit', () => {
      expect(() => parseClassDiagram('classDiagram\nclass 1Foo')).toThrow(MermaidUnitParseError)
    })
  })

  describe('class members', () => {
    it('parses a class with one untyped field', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  +field\n}')
      const m = ast.classes[0]!.members
      expect(m).toHaveLength(1)
      expect(m[0]!.name).toBe('field')
      expect(m[0]!.visibility).toBe('+')
      expect(m[0]!.method).toBeFalsy()
    })

    it('parses a class with a typed field', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  -count: int\n}')
      const m = ast.classes[0]!.members[0]!
      expect(m.name).toBe('count')
      expect(m.visibility).toBe('-')
      expect(m.type).toBe('int')
    })

    it('accepts all visibility tokens', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  +a\n  -b\n  #c\n  ~d\n}')
      expect(ast.classes[0]!.members.map((m) => m.visibility)).toEqual(['+', '-', '#', '~'])
    })

    it('parses a method with no params and no return type', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  +run()\n}')
      const m = ast.classes[0]!.members[0]!
      expect(m.name).toBe('run')
      expect(m.method).toBe(true)
      expect(m.params).toEqual([])
    })

    it('parses a method with params and return type', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  +sum(a: int, b: int) int\n}')
      const m = ast.classes[0]!.members[0]!
      expect(m.method).toBe(true)
      expect(m.params.map((p) => p.name)).toEqual(['a', 'b'])
      expect(m.params.map((p) => p.type)).toEqual(['int', 'int'])
      expect(m.returnType).toBe('int')
    })

    it('parses an abstract method', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  +calc()*\n}')
      const m = ast.classes[0]!.members[0]!
      expect(m.method).toBe(true)
      expect(m.abstract).toBe(true)
    })

    it('parses a static method', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  +instance() Foo$\n}')
      const m = ast.classes[0]!.members[0]!
      expect(m.method).toBe(true)
      expect(m.static).toBe(true)
      expect(m.returnType).toBe('Foo')
    })

    it('omits visibility when not specified', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  bareField\n}')
      const m = ast.classes[0]!.members[0]!
      expect(m.name).toBe('bareField')
      expect(m.visibility).toBeUndefined()
    })
  })

  describe('stereotypes', () => {
    it('parses an inside-body stereotype marker', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  <<interface>>\n  +method()\n}')
      const c = ast.classes[0]!
      expect(c.stereotypes.map((s) => s.name)).toEqual(['interface'])
      expect(c.members.map((m) => m.name)).toEqual(['method'])
    })

    it('parses multiple stereotypes inside a body', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo {\n  <<interface>>\n  <<service>>\n}')
      expect(ast.classes[0]!.stereotypes.map((s) => s.name)).toEqual(['interface', 'service'])
    })

    it('parses a shorthand stereotype assignment', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo\n<<interface>> Foo')
      expect(ast.classes.map((c) => c.name)).toEqual(['Foo'])
      expect(ast.stereotypeAssignments).toHaveLength(1)
      expect(ast.stereotypeAssignments[0]!.stereotype.name).toBe('interface')
      expect(ast.stereotypeAssignments[0]!.classRef.$refText).toBe('Foo')
    })
  })

  describe('relationships', () => {
    const setup = 'classDiagram\nclass Foo\nclass Bar\n'

    it.each([
      ['<|--', 'Foo <|-- Bar'],
      ['<|..', 'Foo <|.. Bar'],
      ['--|>', 'Bar --|> Foo'],
      ['..|>', 'Bar ..|> Foo'],
      ['-->', 'Foo --> Bar'],
      ['..>', 'Foo ..> Bar'],
      ['*--', 'Foo *-- Bar'],
      ['o--', 'Foo o-- Bar'],
      ['--', 'Foo -- Bar'],
    ])('parses arrow %s', (expectedArrow, line) => {
      const ast = parseClassDiagram(setup + line)
      expect(ast.relationships).toHaveLength(1)
      expect(ast.relationships[0]!.arrow).toBe(expectedArrow)
    })

    it('captures lhs and rhs class references', () => {
      const ast = parseClassDiagram(setup + 'Foo --> Bar')
      const r = ast.relationships[0]!
      expect(r.lhs.$refText).toBe('Foo')
      expect(r.rhs.$refText).toBe('Bar')
    })

    it('parses cardinality strings on both sides', () => {
      const ast = parseClassDiagram(setup + 'Foo "1" --> "many" Bar')
      const r = ast.relationships[0]!
      expect(r.lhsCard).toBe('1')
      expect(r.rhsCard).toBe('many')
    })

    it('parses a label after the colon', () => {
      const ast = parseClassDiagram(setup + 'Foo --> Bar : owns')
      expect(ast.relationships[0]!.label).toBe('owns')
    })

    it('parses multiple relationships', () => {
      const ast = parseClassDiagram(setup + 'class Baz\nFoo --> Bar\nBar --> Baz')
      expect(ast.relationships.map((r) => r.arrow)).toEqual(['-->', '-->'])
    })
  })

  describe('notes', () => {
    it('parses a floating note', () => {
      const ast = parseClassDiagram('classDiagram\nnote "general note"')
      expect(ast.notes).toHaveLength(1)
      expect(ast.notes[0]!.text).toBe('general note')
      expect(ast.notes[0]!.target).toBeUndefined()
    })

    it('parses a note targeted at a class', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo\nnote for Foo "see the design doc"')
      const n = ast.notes[0]!
      expect(n.text).toBe('see the design doc')
      expect(n.target?.$refText).toBe('Foo')
    })
  })

  describe('directives', () => {
    it('captures @schema directive', () => {
      const ast = parseClassDiagram('classDiagram\n%% @schema ./arch.schema.ts')
      expect(ast.directives).toHaveLength(1)
      expect(ast.directives[0]!.text).toContain('@schema')
      expect(ast.directives[0]!.text).toContain('./arch.schema.ts')
    })

    it('captures @id directive', () => {
      const ast = parseClassDiagram('classDiagram\nclass Foo\n%% @id Foo stable-id-123')
      expect(ast.directives[0]!.text).toContain('@id')
      expect(ast.directives[0]!.text).toContain('stable-id-123')
    })

    it('captures @stereotype directive', () => {
      const ast = parseClassDiagram(
        'classDiagram\n%% @stereotype service { allowedDeps: [repository] }',
      )
      expect(ast.directives[0]!.text).toContain('@stereotype')
      expect(ast.directives[0]!.text).toContain('service')
    })

    it('captures multiple directives in order', () => {
      const ast = parseClassDiagram(
        [
          'classDiagram',
          '%% @schema ./a.ts',
          '%% @id Foo X',
          'class Foo',
          '%% @stereotype service { }',
        ].join('\n'),
      )
      expect(ast.directives).toHaveLength(3)
      expect(ast.directives[0]!.text).toContain('@schema')
      expect(ast.directives[1]!.text).toContain('@id')
      expect(ast.directives[2]!.text).toContain('@stereotype')
    })

    it('ignores plain comments (no @)', () => {
      const ast = parseClassDiagram('classDiagram\n%% just a regular comment\nclass Foo')
      expect(ast.directives ?? []).toHaveLength(0)
      expect(ast.classes.map((c) => c.name)).toEqual(['Foo'])
    })

    it('captures even unknown directives (warnings happen later)', () => {
      const ast = parseClassDiagram('classDiagram\n%% @experimental whatever')
      expect(ast.directives[0]!.text).toContain('@experimental')
    })
  })

  describe('end-to-end integration', () => {
    it('parses a kitchen-sink diagram covering every spec section', () => {
      const src = [
        'classDiagram',
        '%% @schema ./arch.schema.ts',
        '%% @stereotype service { allowedDeps: [repository] }',
        '%% just a comment, not a directive',
        'class BaseService {',
        '  <<abstract>>',
        '  #logger: Logger',
        '  +execute()*',
        '}',
        'class OrderService {',
        '  <<service>>',
        '  -repo: OrderRepo',
        '  +execute()',
        '  +findById(id: string) Order',
        '  +instance() OrderService$',
        '}',
        'class OrderRepo',
        '<<repository>> OrderRepo',
        'BaseService <|-- OrderService',
        'OrderService "1" --> "many" OrderRepo : owns',
        'note for OrderService "see ADR 042"',
        'note "system-wide note"',
      ].join('\n')

      const ast = parseClassDiagram(src)

      expect(ast.classes.map((c) => c.name)).toEqual(['BaseService', 'OrderService', 'OrderRepo'])

      const baseService = ast.classes[0]!
      expect(baseService.stereotypes.map((s) => s.name)).toEqual(['abstract'])
      expect(baseService.members.map((m) => m.name)).toEqual(['logger', 'execute'])
      const executeMethod = baseService.members[1]!
      expect(executeMethod.method).toBe(true)
      expect(executeMethod.abstract).toBe(true)

      const orderService = ast.classes[1]!
      const staticMethod = orderService.members.find((m) => m.name === 'instance')
      expect(staticMethod?.static).toBe(true)
      expect(staticMethod?.returnType).toBe('OrderService')

      expect(ast.stereotypeAssignments).toHaveLength(1)
      expect(ast.stereotypeAssignments[0]!.classRef.$refText).toBe('OrderRepo')

      expect(ast.relationships.map((r) => r.arrow)).toEqual(['<|--', '-->'])
      expect(ast.relationships[1]!.lhsCard).toBe('1')
      expect(ast.relationships[1]!.rhsCard).toBe('many')
      expect(ast.relationships[1]!.label).toBe('owns')

      expect(ast.notes).toHaveLength(2)
      expect(ast.notes[0]!.target?.$refText).toBe('OrderService')
      expect(ast.notes[1]!.target).toBeUndefined()

      expect(ast.directives).toHaveLength(2)
      expect(ast.directives[0]!.text).toContain('@schema')
      expect(ast.directives[1]!.text).toContain('@stereotype')
    })
  })
})
