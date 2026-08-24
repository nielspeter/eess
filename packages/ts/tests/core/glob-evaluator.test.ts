import { describe, it, expect } from 'vitest'
import type { GlobSite, GlobNode } from '@nielspeter/eess'
import type { PathUniverse } from '@nielspeter/eess/internal'
import { isDeadGlobTree, isDeadSite, globSitesOf } from '../../src/core/glob-evaluator.js'

const universe: PathUniverse = {
  filePaths: ['/root/src/domain/user.ts'],
  parentDirs: ['/root/src/domain'],
  tsconfigRelativeFilePaths: ['src/domain/user.ts'],
  tsconfigRelativeParentDirs: ['src/domain'],
}

function site(glob: string, extra: Partial<GlobSite> = {}): GlobSite {
  return { glob, kind: 'file-path', position: 'selector', origin: 'test', ...extra }
}

describe('isDeadSite', () => {
  it('a negative site is never dead — not(unsatisfiable) selects everything', () => {
    expect(isDeadSite(site('**/ghost/**', { polarity: 'negative' }), universe)).toBe(false)
  })

  it('a kind with no views (import-target/specifier/literal) is never dead', () => {
    expect(isDeadSite(site('anything', { kind: 'specifier' }), universe)).toBe(false)
  })

  it('a syntactically faulted glob is dead regardless of the universe', () => {
    expect(isDeadSite(site('src/domain/**'), universe)).toBe(true)
  })

  it('an anchored glob matching nothing in either view is dead', () => {
    expect(isDeadSite(site('**/ghost/**'), universe)).toBe(true)
  })

  it('an anchored glob matching the absolute view is alive', () => {
    expect(isDeadSite(site('**/user.ts'), universe)).toBe(false)
  })

  it('a glob matching only the tsconfig-relative view is alive — the union, not just the absolute view', () => {
    expect(isDeadSite(site('src/domain/**', { base: 'tsconfig-relative' }), universe)).toBe(false)
  })
})

describe('isDeadGlobTree — the three soundness rules', () => {
  const live: GlobSite = site('**/user.ts')
  const dead: GlobSite = site('**/ghost/**')
  const opaque = { opaque: true as const }

  it('all: dead if ANY child is dead', () => {
    const tree: GlobNode = { op: 'all', children: [live, dead] }
    expect(isDeadGlobTree(tree, universe)).toBe(true)
  })

  it('all: alive if every child is alive', () => {
    const tree: GlobNode = { op: 'all', children: [live, live] }
    expect(isDeadGlobTree(tree, universe)).toBe(false)
  })

  it('any: dead only if EVERY child is dead', () => {
    const alive: GlobNode = { op: 'any', children: [live, dead] }
    const allDead: GlobNode = { op: 'any', children: [dead, dead] }
    expect(isDeadGlobTree(alive, universe)).toBe(false)
    expect(isDeadGlobTree(allDead, universe)).toBe(true)
  })

  it('an opaque leaf is never dead and is never dropped — an all-tree with only an opaque leaf is alive', () => {
    const tree: GlobNode = { op: 'all', children: [opaque] }
    expect(isDeadGlobTree(tree, universe)).toBe(false)
  })

  it('an any-tree of only dead children is dead even alongside an opaque sibling — opaque never rescues', () => {
    const tree: GlobNode = { op: 'any', children: [dead, opaque] }
    // opaque is never dead, so `any` (dead only if every child is dead) is alive here —
    // this is the documented "opaque never dead" rule, not a rescue of the dead sibling.
    expect(isDeadGlobTree(tree, universe)).toBe(false)
  })

  it('a negative dead-looking site never makes an all-tree dead', () => {
    const negated = site('**/ghost/**', { polarity: 'negative' })
    const tree: GlobNode = { op: 'all', children: [live, negated] }
    expect(isDeadGlobTree(tree, universe)).toBe(false)
  })

  it('recurses through nested trees', () => {
    const tree: GlobNode = {
      op: 'all',
      children: [{ op: 'any', children: [dead, dead] }],
    }
    expect(isDeadGlobTree(tree, universe)).toBe(true)
  })
})

describe('globSitesOf', () => {
  it('collects every leaf in declaration order, across nested trees, skipping opaque', () => {
    const a = site('a')
    const b = site('b')
    const tree: GlobNode = {
      op: 'all',
      children: [a, { opaque: true }, { op: 'any', children: [b] }],
    }
    expect(globSitesOf(tree)).toEqual([a, b])
  })

  it('an empty tree yields no sites', () => {
    expect(globSitesOf({ op: 'any', children: [] })).toEqual([])
  })
})
