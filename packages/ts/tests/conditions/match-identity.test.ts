import { describe, it, expect } from 'vitest'
import { Project, SyntaxKind } from 'ts-morph'
import { identifyMatches } from '../../src/conditions/match-identity.js'

function callNodes(code: string) {
  const project = new Project({ useInMemoryFileSystem: true })
  const sf = project.createSourceFile('test.ts', code)
  return sf.getDescendantsOfKind(SyntaxKind.CallExpression)
}

describe('identifyMatches', () => {
  it('buckets by the enclosing declaration, not by line number', () => {
    // Adding lines above a match must not change the identity of matches
    // below it — that is the whole point (see the docstring).
    const before = callNodes(`function f() {\n  eval('a')\n}`)
    const after = callNodes(`\n\nfunction f() {\n  eval('a')\n}`)
    const idsBefore = identifyMatches('function-body', '/f.ts', before, 'eval')
    const idsAfter = identifyMatches('function-body', '/f.ts', after, 'eval')
    expect(idsBefore).toEqual(idsAfter)
  })

  it('numbers repeated matches within the same declaration by ordinal', () => {
    const nodes = callNodes(`function f() {\n  eval('a')\n  eval('b')\n}`)
    const ids = identifyMatches('function-body', '/f.ts', nodes, 'eval')
    expect(ids).toHaveLength(2)
    expect(ids[0]).toMatch(/#1$/)
    expect(ids[1]).toMatch(/#2$/)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('keeps two different declarations with an identical match distinct', () => {
    const nodes = callNodes(`function f() {\n  eval('a')\n}\nfunction g() {\n  eval('a')\n}`)
    const ids = identifyMatches('function-body', '/f.ts', nodes, 'eval')
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps two condition families from colliding on the same node', () => {
    const nodes = callNodes(`function f() {\n  eval('a')\n}`)
    const asFunctionBody = identifyMatches('function-body', '/f.ts', nodes, 'eval')
    const asClassBody = identifyMatches('class-body', '/f.ts', nodes, 'eval')
    expect(asFunctionBody[0]).not.toBe(asClassBody[0])
  })

  it('keeps two matchers co-located in the same scope distinct', () => {
    const nodes = callNodes(`function f() {\n  eval('a')\n}`)
    const asEnv = identifyMatches('function-body', '/f.ts', nodes, 'eval')
    const asOther = identifyMatches('function-body', '/f.ts', nodes, 'someOtherMatcher')
    expect(asEnv[0]).not.toBe(asOther[0])
  })

  it('returns an empty array for an empty match list', () => {
    expect(identifyMatches('function-body', '/f.ts', [], 'eval')).toEqual([])
  })
})
