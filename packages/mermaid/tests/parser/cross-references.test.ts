import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '../../src/parser/parse-class-diagram.js'

describe('cross-references', () => {
  it('relationship $refText matches a declared class name', () => {
    const ast = parseClassDiagram(
      ['classDiagram', 'class Foo', 'class Bar', 'Foo --> Bar'].join('\n'),
    )
    const r = ast.relationships[0]!
    const declaredNames = ast.classes.map((c) => c.name)
    expect(declaredNames).toContain(r.lhs.$refText)
    expect(declaredNames).toContain(r.rhs.$refText)
  })

  it('shorthand stereotype assignment $refText matches a declared class', () => {
    const ast = parseClassDiagram(['classDiagram', 'class Foo', '<<service>> Foo'].join('\n'))
    const a = ast.stereotypeAssignments[0]!
    const declaredNames = ast.classes.map((c) => c.name)
    expect(declaredNames).toContain(a.classRef.$refText)
  })

  it('targeted note $refText matches a declared class', () => {
    const ast = parseClassDiagram(
      ['classDiagram', 'class Foo', 'note for Foo "see ADR"'].join('\n'),
    )
    const note = ast.notes[0]!
    expect(note.target?.$refText).toBe('Foo')
    expect(ast.classes.map((c) => c.name)).toContain(note.target?.$refText)
  })

  it('a relationship referring to an unknown class still parses (deferred check)', () => {
    // The grammar allows forward references; semantic validation that the name
    // exists is the responsibility of a downstream check, not the parser.
    const ast = parseClassDiagram(['classDiagram', 'class Foo', 'Foo --> Bar'].join('\n'))
    expect(ast.relationships[0]!.rhs.$refText).toBe('Bar')
    expect(ast.classes.map((c) => c.name)).not.toContain('Bar')
  })
})
