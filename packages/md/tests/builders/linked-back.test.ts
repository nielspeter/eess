import { afterEach, describe, it, expect } from 'vitest'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, links, type LinkResolveOptions } from '../../src/index.js'

// Plan 0406. Each fixture folder is its own repo root; every one but `empty` and
// the all-frozen case keeps a declaration that does link back (`k.md`), so
// applying a remedy can never pass by emptying the selection.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/linked-back')

interface Run {
  readonly roots?: readonly string[]
  readonly ignore?: readonly string[]
  readonly live?: boolean
  readonly resolve?: LinkResolveOptions
  /** Options for `haveLiveTargets()` alone; defaults to `resolve`, as the docs advise. */
  readonly liveResolve?: LinkResolveOptions
}

function violations(cwd: string, o: Run = {}) {
  const c = corpus({
    roots: o.roots ?? ['**/*.md'],
    cwd,
    ...(o.ignore ? { ignore: o.ignore } : {}),
  })
  const declared = links(c).that().areLabelled('Related to')
  const selected =
    o.live === true ? declared.and().haveLiveTargets(o.liveResolve ?? o.resolve) : declared
  return selected.should().beLinkedBack(o.resolve).rule({ id: 'test/linked-back' }).violations()
}

/** Every finding as `line element | message | suggestion`, sorted — exact sets. */
function findings(cwd: string, o: Run = {}): string[] {
  return violations(cwd, o)
    .map(
      (v) => `${v.line} ${v.element} | ${v.message.split('\n')[0] ?? ''} | ${v.suggestion ?? ''}`,
    )
    .sort()
}

const copies: string[] = []
afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A writable copy of one fixture folder, for applying a remedy; removed after the test. */
function copyOf(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'eess-linked-back-'))
  copies.push(dir)
  cpSync(join(fixtures, name), dir, { recursive: true })
  return dir
}

const edit = (dir: string, file: string, from: string, to: string): void => {
  const path = join(dir, file)
  const text = readFileSync(path, 'utf8')
  if (!text.includes(from)) throw new Error(`${file} does not contain ${from}`)
  writeFileSync(path, text.replace(from, to))
}

const at = (name: string): string => join(fixtures, name)

describe('beLinkedBack() — one finding per cause, and its remedy clears it (plan 0406)', () => {
  it('a live target that does not link back', () => {
    expect(findings(at('oneway'))).toEqual([
      '3 a.md → b.md | a.md declares b.md, and b.md does not link back | add a link to a.md in b.md, or remove b.md from the declaration',
    ])
    const dir = copyOf('oneway')
    writeFileSync(join(dir, 'b.md'), '# B\n\nSee [a](a.md).\n')
    expect(findings(dir)).toEqual([])
  })

  it('a frozen target, without the selector', () => {
    expect(findings(at('frozen'))).toEqual([
      '3 a.md → archived/f.md | archived/f.md is frozen and cannot answer | add .haveLiveTargets() to the rule, passing it the options you pass beLinkedBack(), or remove archived/f.md from the declaration',
    ])
    expect(findings(at('frozen'), { live: true })).toEqual([])
  })

  it('a target outside the corpus roots', () => {
    expect(findings(at('outside'), { roots: ['in/**'] })).toEqual([
      '3 in/a.md → out/o.md | out/o.md is outside the corpus, so its links are not read | add its folder to the corpus roots, or correct the link',
    ])
    expect(findings(at('outside'), { roots: ['in/**', 'out/**'] })).toEqual([])
  })

  it('a target that is not Markdown', () => {
    expect(findings(at('not-markdown'))).toEqual([
      '3 a.md → p.png | p.png is not a Markdown record | declare a record, not a file',
    ])
    const dir = copyOf('not-markdown')
    edit(dir, 'a.md', '[p](p.png)', '[r](r.md)')
    expect(findings(dir)).toEqual([])
  })

  it('a target the corpus ignores', () => {
    expect(findings(at('ignored'), { ignore: ['ig/**'] })).toEqual([
      '3 a.md → ig/x.md | ig/x.md matches the corpus ignore option, so its links are not read | correct the link, or stop ignoring the path',
    ])
    expect(findings(at('ignored'))).toEqual([])
  })

  it('a missing target — the same fix clears resolve() too', () => {
    expect(findings(at('missing'))).toEqual([
      '3 a.md → gone.md | gone.md does not exist | correct the link to the record it means — the same fix clears resolve()',
    ])
    const dir = copyOf('missing')
    edit(dir, 'a.md', '[g](gone.md)', '[g](m.md)')
    expect(findings(dir)).toEqual([])
    const resolved = links(corpus({ roots: ['**/*.md'], cwd: dir }))
      .should()
      .resolve()
      .rule({ id: 'test/resolve' })
      .violations()
    expect([...resolved]).toEqual([])
  })

  it('a directory target', () => {
    expect(findings(at('directory'))).toEqual([
      "3 a.md → sub | the link names a directory, sub, not a record | link the record's file",
    ])
    const dir = copyOf('directory')
    edit(dir, 'a.md', '[s](sub/)', '[s](sub/s.md)')
    expect(findings(dir)).toEqual([])
  })

  it('a declaration of the record itself, spelt as a path', () => {
    expect(findings(at('self'))).toEqual([
      '3 a.md → a.md | the link points at this record | remove it; a record does not relate to itself',
    ])
    const dir = copyOf('self')
    edit(dir, 'a.md', '[me](./a.md) · ', '')
    expect(findings(dir)).toEqual([])
  })

  it('an external target', () => {
    expect(findings(at('external'))).toEqual([
      '3 a.md → https://example.com/e | the declaration links outside the repository, to https://example.com/e | declare a record in the corpus',
    ])
    const dir = copyOf('external')
    edit(dir, 'a.md', '[e](https://example.com/e)', '[r](r.md)')
    expect(findings(dir)).toEqual([])
  })
})

describe('the remedies a review found unproven (plan 0406)', () => {
  it('a frozen finding under mismatched options names the fix that clears it', () => {
    const mismatched = { live: true, liveResolve: {}, resolve: { tryExtensions: ['.md'] } }
    expect(findings(at('frozen-ext'), mismatched)).toEqual([
      '3 a.md → archived/f.md | archived/f.md is frozen and cannot answer | add .haveLiveTargets() to the rule, passing it the options you pass beLinkedBack(), or remove archived/f.md from the declaration',
    ])
    expect(
      findings(at('frozen-ext'), { ...mismatched, liveResolve: { tryExtensions: ['.md'] } }),
    ).toEqual([])
  })

  it('a missing target whose file moved carries the autofix resolve() carries', () => {
    const v = violations(at('moved'))
    expect(v.map((x) => `${x.line} ${x.element}`)).toEqual(['3 a.md → old/m.md'])
    const resolved = links(corpus({ roots: ['**/*.md'], cwd: at('moved') }))
      .should()
      .resolve()
      .rule({ id: 'test/resolve' })
      .violations()
    expect(v[0]?.fix?.replacement).toBe('./new/m.md')
    expect(v[0]?.fix).toEqual(resolved[0]?.fix)
  })

  it('a non-Markdown file the corpus also ignores is told to declare a record', () => {
    expect(findings(at('ignored-png'), { ignore: ['ig/**'] })).toEqual([
      '3 a.md → ig/p.png | ig/p.png is not a Markdown record | declare a record, not a file',
    ])
  })
})

describe('what answers (plan 0406)', () => {
  it('any link back answers, in every spelling, once or twice', () => {
    expect(findings(at('spellings'), { resolve: { tryExtensions: ['.md'] } })).toEqual([])
    expect(violations(at('spellings'), { resolve: { tryExtensions: ['.md'] } }).examined).toBe(6)
  })

  it('an extensionless back-link needs the options, so beLinkedBack reads them', () => {
    expect(findings(at('spellings'))).toEqual([
      '3 x/a.md → x/t6.md | x/a.md declares x/t6.md, and x/t6.md does not link back | add a link to x/a.md in x/t6.md, or remove x/t6.md from the declaration',
    ])
  })

  it('a back-link only inside a code fence or an HTML comment does not answer', () => {
    expect(findings(at('fence'))).toEqual([
      '3 a.md → b.md | a.md declares b.md, and b.md does not link back | add a link to a.md in b.md, or remove b.md from the declaration',
    ])
  })

  it('a frozen target that links back answers, without the selector', () => {
    expect(findings(at('frozen-answers'))).toEqual([])
  })
})

describe('haveLiveTargets() and an empty selection (plan 0406)', () => {
  it('an all-frozen selection with the selector fails with the zero-examined finding', () => {
    const v = violations(at('all-frozen'), { live: true })
    expect(v.examined).toBe(0)
    expect(v.map((x) => x.message.split('\n')[0]?.slice(0, 32))).toEqual([
      'this rule examined zero units. I',
    ])
  })

  it('an extensionless declaration into a frozen target, both given the options: green', () => {
    expect(findings(at('frozen-ext'), { live: true, resolve: { tryExtensions: ['.md'] } })).toEqual(
      [],
    )
  })

  it('without the options, both read an extensionless link as missing', () => {
    expect(findings(at('frozen-ext'), { live: true })).toEqual([
      '3 a.md → archived/f | archived/f does not exist | correct the link to the record it means — the same fix clears resolve()',
      '3 a.md → k | k does not exist | correct the link to the record it means — the same fix clears resolve()',
    ])
  })

  it('a record with no declaration fails with the zero-examined finding', () => {
    const v = violations(at('empty'))
    expect(v.examined).toBe(0)
    expect(v.map((x) => x.message.split('\n')[0]?.slice(0, 32))).toEqual([
      'this rule examined zero units. I',
    ])
  })
})
