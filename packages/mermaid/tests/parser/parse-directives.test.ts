import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '../../src/parser/parse-class-diagram.js'
import { parseDirectives, findDirective } from '../../src/parser/parse-directives.js'

function parse(src: string) {
  return parseDirectives(parseClassDiagram(src))
}

describe('parseDirectives', () => {
  it('extracts a @schema path', () => {
    const r = parse('classDiagram\n%% @schema ./arch.schema.ts')
    const schemas = findDirective(r, 'schema')
    expect(schemas).toHaveLength(1)
    expect(schemas[0]!.path).toBe('./arch.schema.ts')
    expect(r.diagnostics).toHaveLength(0)
  })

  it('extracts a @stereotype name and body', () => {
    const r = parse('classDiagram\n%% @stereotype service { allowedDeps: [repository] }')
    const ster = findDirective(r, 'stereotype')
    expect(ster).toHaveLength(1)
    expect(ster[0]!.name).toBe('service')
    expect(ster[0]!.body).toContain('allowedDeps')
    expect(r.diagnostics).toHaveLength(0)
  })

  it('extracts an @id mapping', () => {
    const r = parse('classDiagram\nclass Foo\n%% @id Foo stable-id-123')
    const ids = findDirective(r, 'id')
    expect(ids).toHaveLength(1)
    expect(ids[0]!.className).toBe('Foo')
    expect(ids[0]!.id).toBe('stable-id-123')
    expect(r.diagnostics).toHaveLength(0)
  })

  it('emits a warning for an unknown directive but still keeps it', () => {
    const r = parse('classDiagram\n%% @experimental whatever')
    const unknowns = findDirective(r, 'unknown')
    expect(unknowns).toHaveLength(1)
    expect(unknowns[0]!.name).toBe('experimental')
    expect(r.diagnostics).toHaveLength(1)
    expect(r.diagnostics[0]!.level).toBe('warning')
    expect(r.diagnostics[0]!.message).toContain('unknown directive @experimental')
  })

  it('emits a warning for malformed @stereotype missing braces', () => {
    const r = parse('classDiagram\n%% @stereotype service')
    expect(r.diagnostics).toHaveLength(1)
    expect(r.diagnostics[0]!.message).toContain('@stereotype')
  })

  it('emits a warning for @id without enough parts', () => {
    const r = parse('classDiagram\n%% @id Foo')
    expect(r.diagnostics).toHaveLength(1)
    expect(r.diagnostics[0]!.message).toContain('@id')
  })

  it('preserves directive order', () => {
    const r = parse(
      [
        'classDiagram',
        '%% @schema ./a.ts',
        '%% @id Foo X',
        'class Foo',
        '%% @stereotype service { x: 1 }',
      ].join('\n'),
    )
    expect(r.directives.map((d) => d.kind)).toEqual(['schema', 'id', 'stereotype'])
  })
})
