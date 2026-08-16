import { describe, it, expect } from 'vitest'
import {
  isFaultPosition,
  countDeclaredGlobs,
  isGlobNode,
  isOpaqueGlob,
  globAnyOf,
  globNode,
  stampGlobs,
  negateGlobs,
  combineGlobs,
  type DeclaredGlobs,
  type GlobNode,
  type DeclaredGlob,
} from '../src/glob-site.js'

describe('isFaultPosition', () => {
  it('selector and discovery are faults', () => {
    expect(isFaultPosition('selector')).toBe(true)
    expect(isFaultPosition('discovery')).toBe(true)
  })

  it('condition and exclusion are not faults', () => {
    expect(isFaultPosition('condition')).toBe(false)
    expect(isFaultPosition('exclusion')).toBe(false)
  })
})

describe('countDeclaredGlobs', () => {
  it('counts leaves across nested trees', () => {
    const tree: DeclaredGlobs = {
      op: 'all',
      children: [
        { glob: 'a', kind: 'file-path' },
        { op: 'any', children: [{ glob: 'b', kind: 'file-path' }, { opaque: true }] },
      ],
    }
    expect(countDeclaredGlobs(tree)).toBe(2)
  })

  it('does not count opaque leaves', () => {
    const tree: DeclaredGlobs = { op: 'any', children: [{ opaque: true }] }
    expect(countDeclaredGlobs(tree)).toBe(0)
  })
})

describe('isGlobNode / isOpaqueGlob', () => {
  it('narrows a tree node vs a leaf vs opaque', () => {
    const node: DeclaredGlobs = { op: 'any', children: [] }
    const leaf: DeclaredGlob = { glob: 'x', kind: 'file-path' }
    const opaque = { opaque: true as const }
    expect(isGlobNode(node)).toBe(true)
    expect(isGlobNode(leaf)).toBe(false)
    expect(isOpaqueGlob(opaque)).toBe(true)
    expect(isOpaqueGlob(leaf)).toBe(false)
  })
})

describe('globAnyOf', () => {
  it('builds a variadic any-tree from a glob list', () => {
    const tree = globAnyOf(['a', 'b'], 'file-path')
    expect(tree.op).toBe('any')
    expect(tree.children).toHaveLength(2)
  })
})

describe('globNode', () => {
  it('wraps a single leaf as a one-element any tree', () => {
    const tree = globNode<DeclaredGlob>({ glob: 'x', kind: 'file-path' })
    expect(tree).toEqual({ op: 'any', children: [{ glob: 'x', kind: 'file-path' }] })
  })
})

describe('stampGlobs', () => {
  it('stamps position and a per-leaf origin onto every declared leaf', () => {
    const declared = globAnyOf(['a', 'b'], 'file-path')
    const stamped = stampGlobs(declared, 'selector', (g) => `origin:${g.glob}`)
    const leaves = stamped.children
    expect(leaves).toEqual([
      { glob: 'a', kind: 'file-path', base: undefined, position: 'selector', origin: 'origin:a' },
      { glob: 'b', kind: 'file-path', base: undefined, position: 'selector', origin: 'origin:b' },
    ])
  })

  it('leaves opaque leaves untouched', () => {
    const declared: DeclaredGlobs = { op: 'any', children: [{ opaque: true }] }
    const stamped = stampGlobs(declared, 'selector', () => 'x')
    expect(stamped.children).toEqual([{ opaque: true }])
  })

  it('recurses into nested trees', () => {
    const declared: DeclaredGlobs = {
      op: 'all',
      children: [{ op: 'any', children: [{ glob: 'a', kind: 'file-path' }] }],
    }
    const stamped = stampGlobs(declared, 'discovery', () => 'x')
    const inner = stamped.children[0]
    expect(inner && isGlobNode(inner) ? inner.children : undefined).toEqual([
      { glob: 'a', kind: 'file-path', base: undefined, position: 'discovery', origin: 'x' },
    ])
  })
})

describe('negateGlobs', () => {
  it('inverts op AND flips polarity at every site', () => {
    const declared = globAnyOf(['a'], 'file-path')
    const stamped = stampGlobs(declared, 'selector', () => 'x')
    const negated = negateGlobs(stamped)
    expect(negated.op).toBe('all')
    const leaf = negated.children[0]
    expect(leaf && !isGlobNode(leaf) && !isOpaqueGlob(leaf) ? leaf.polarity : undefined).toBe(
      'negative',
    )
  })

  it('double negation restores the original op and polarity', () => {
    const declared = globAnyOf(['a'], 'file-path')
    const stamped = stampGlobs(declared, 'selector', () => 'x')
    const twice = negateGlobs(negateGlobs(stamped))
    expect(twice.op).toBe(stamped.op)
    // Explicitly 'positive' after two flips rather than the original `undefined`
    // — semantically identical (both default to positive), not byte-identical.
    const leaf = twice.children[0]
    expect(leaf && !isGlobNode(leaf) && !isOpaqueGlob(leaf) ? leaf.polarity : undefined).toBe(
      'positive',
    )
  })

  it('recurses into nested trees, inverting every level', () => {
    const tree: GlobNode = {
      op: 'all',
      children: [
        {
          op: 'any',
          children: [{ glob: 'a', kind: 'file-path', position: 'selector', origin: 'x' }],
        },
      ],
    }
    const negated = negateGlobs(tree)
    expect(negated.op).toBe('any')
    const inner = negated.children[0]
    expect(inner && isGlobNode(inner) ? inner.op : undefined).toBe('all')
  })
})

describe('combineGlobs', () => {
  it('treats a missing input as an opaque child, preserving arity', () => {
    const a: DeclaredGlobs = { op: 'any', children: [{ glob: 'a', kind: 'file-path' }] }
    const combined = combineGlobs('all', [a, undefined])
    expect(combined.op).toBe('all')
    expect(combined.children).toHaveLength(2)
    expect(isOpaqueGlob(combined.children[1]!)).toBe(true)
  })
})
