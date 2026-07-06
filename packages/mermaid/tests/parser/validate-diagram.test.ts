import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '../../src/parser/parse-class-diagram.js'
import { validateReferences } from '../../src/parser/validate-diagram.js'

function validate(src: string) {
  return validateReferences(parseClassDiagram(src))
}

describe('validateReferences', () => {
  it('reports no diagnostics for a fully resolved diagram', () => {
    const d = validate(['classDiagram', 'class Foo', 'class Bar', 'Foo --> Bar'].join('\n'))
    expect(d).toEqual([])
  })

  it('reports unresolved relationship references', () => {
    const d = validate(['classDiagram', 'class Foo', 'Foo --> Missing'].join('\n'))
    expect(d).toHaveLength(1)
    expect(d[0]!.kind).toBe('unresolved-reference')
    expect(d[0]!.refText).toBe('Missing')
    expect(d[0]!.level).toBe('error')
  })

  it('reports unresolved stereotype assignment references', () => {
    const d = validate(['classDiagram', '<<interface>> Missing'].join('\n'))
    expect(d).toHaveLength(1)
    expect(d[0]!.refText).toBe('Missing')
    expect(d[0]!.declaredOn).toBe('stereotypeAssignment')
  })

  it('reports unresolved note targets', () => {
    const d = validate(['classDiagram', 'note for Missing "x"'].join('\n'))
    expect(d).toHaveLength(1)
    expect(d[0]!.declaredOn).toBe('note')
  })

  it('reports duplicate class declarations', () => {
    const d = validate(['classDiagram', 'class Foo', 'class Foo'].join('\n'))
    expect(d).toHaveLength(1)
    expect(d[0]!.kind).toBe('duplicate-class')
    expect(d[0]!.refText).toBe('Foo')
  })
})
