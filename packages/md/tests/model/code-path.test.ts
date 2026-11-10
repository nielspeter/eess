/**
 * Plan 0648 Phase 1: `citedPaths`, the one resolver `pointers().resolve()` and the code-reference
 * conditions share. In-corpus only; a path the corpus does not hold is `broken`, never skipped.
 */
import { describe, it, expect } from 'vitest'
import { corpusFromText } from '../../src/index.js'
import { citedPaths } from '../../src/model/code-path.js'

const FILES = {
  'docs/a.md': '# A\n',
  'src/one/util.ts': 'export const pathSuffixIndex = 1\nexport function $go() {}\n',
  'src/two/util.ts': 'export const other = 2\n',
  'src/solo.ts': '// solo\nconst x = 1\n',
}

describe('plan 0648: citedPaths', () => {
  it('resolves an exact path, and a unique suffix in suffix mode', () => {
    const paths = citedPaths(corpusFromText(FILES), 'suffix')
    expect(paths.classify('src/solo.ts')).toEqual({ kind: 'resolved', rel: 'src/solo.ts' })
    expect(paths.classify('./src/solo.ts')).toEqual({ kind: 'resolved', rel: 'src/solo.ts' })
    expect(paths.classify('solo.ts')).toEqual({ kind: 'resolved', rel: 'src/solo.ts' })
    expect(paths.classify('one/util.ts')).toEqual({ kind: 'resolved', rel: 'src/one/util.ts' })
  })

  it('reports an ambiguous suffix with its candidates in suffix mode', () => {
    expect(citedPaths(corpusFromText(FILES), 'suffix').classify('util.ts')).toEqual({
      kind: 'ambiguous',
      wanted: 'util.ts',
      candidates: ['src/one/util.ts', 'src/two/util.ts'],
    })
  })

  it('reports a path the corpus does not hold, and a ../ path, as broken', () => {
    const paths = citedPaths(corpusFromText(FILES), 'suffix')
    expect(paths.classify('src/missing.ts')).toEqual({ kind: 'broken', wanted: 'src/missing.ts' })
    expect(paths.classify('../src/solo.ts')).toEqual({ kind: 'broken', wanted: '../src/solo.ts' })
  })

  it('in exact mode a suffix match is broken, carrying the one file it matched', () => {
    const paths = citedPaths(corpusFromText(FILES), 'exact')
    expect(paths.classify('src/solo.ts')).toEqual({ kind: 'resolved', rel: 'src/solo.ts' })
    expect(paths.classify('solo.ts')).toEqual({
      kind: 'broken',
      wanted: 'solo.ts',
      unique: 'src/solo.ts',
    })
    expect(paths.classify('util.ts')).toEqual({ kind: 'broken', wanted: 'util.ts' })
  })

  it("gives a file's text, lines and identifier tokens, with no empty token", () => {
    const paths = citedPaths(corpusFromText(FILES), 'suffix')
    expect(paths.lines('src/solo.ts')).toBe(2)
    expect(paths.text('src/solo.ts')).toBe('// solo\nconst x = 1\n')
    const tokens = paths.tokens('src/one/util.ts')
    expect([...tokens].sort()).toEqual([
      '$go',
      '1',
      'const',
      'export',
      'function',
      'pathSuffixIndex',
    ])
    expect(tokens.has('')).toBe(false)
    expect(paths.tokens('src/solo.ts').has('')).toBe(false)
  })

  it('is made once per corpus and mode, so every rule shares one read of each file', () => {
    const c = corpusFromText(FILES)
    expect(citedPaths(c, 'suffix')).toBe(citedPaths(c, 'suffix'))
    expect(citedPaths(c, 'exact')).not.toBe(citedPaths(c, 'suffix'))
    expect(citedPaths(corpusFromText(FILES), 'suffix')).not.toBe(citedPaths(c, 'suffix'))
  })
})
