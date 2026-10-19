/**
 * Plan 0455: a corpus built from text resolves as `corpus()` does over the same files on disk.
 *
 * The parity half loads seven fixture trees both ways with the same options and compares what every
 * rule below sees. Its guard is per rule: each rule has a tree where it examines something and
 * reports a real finding (not a configuration finding, which both sides produce by construction).
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseExclusionComments } from '@nielspeter/eess'
import {
  ArchConfigError,
  corpus,
  corpusFromText,
  links,
  pointers,
  taskItems,
  type ArchViolation,
  type Corpus,
} from '../src/index.js'
import { honestyAtClose } from '../src/rules/ledger.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

/** Every file under `dir` as a map of repo-relative POSIX path → text. */
function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue
    const abs = join(e.parentPath, e.name)
    out[relative(dir, abs).split(sep).join('/')] = readFileSync(abs, 'utf8')
  }
  return out
}

interface Tree {
  readonly name: string
  readonly cwd: string
  readonly roots: readonly string[]
  readonly ignore?: readonly string[]
  readonly frozen?: readonly string[]
}

const TREES: readonly Tree[] = [
  // The waiver document is left out on both sides: a text corpus refuses it (plan 0455).
  {
    name: 'corpus',
    cwd: join(FIXTURES, 'corpus'),
    roots: ['**/*.md'],
    ignore: ['docs/sanctioned-pointer.md'],
  },
  // As `resolve-link.test.ts` loads it.
  {
    name: 'resolve-link',
    cwd: join(FIXTURES, 'resolve-link'),
    roots: ['docs/**'],
    ignore: ['docs/ignored/**', 'outside/ign.md'],
  },
  { name: 'linked-back', cwd: join(FIXTURES, 'linked-back'), roots: ['**/*.md'] },
  // An explicit `frozen` that differs from the default and marks documents in both of its folders,
  // so the caller's `frozen` reaching `corpusFromText` is compared, not only the default.
  {
    name: 'ledger',
    cwd: join(FIXTURES, 'ledger'),
    roots: ['**/*.md'],
    frozen: ['completed/**', 'fixed/**'],
  },
  { name: 'declared-block', cwd: join(FIXTURES, 'declared-block'), roots: ['**/*.md'] },
  { name: 'frontmatter', cwd: join(FIXTURES, 'frontmatter'), roots: ['**/*.md'] },
  // As `builders/external-root-pointers.test.ts` loads it, without its external root: a text corpus
  // refuses `externalRoots`, so the pointers into it are broken on both sides.
  { name: 'external-root', cwd: join(FIXTURES, 'external-root', 'repo'), roots: ['docs/**'] },
]

/** One side of the parity: the receipts and element sets every rule gives, root stripped. */
interface Seen {
  readonly documents: readonly string[]
  readonly fileIndex: readonly string[]
  readonly receipts: Readonly<Record<string, Receipt>>
  readonly frozenPointers: readonly string[]
  readonly boxes: readonly string[]
}

interface Receipt {
  readonly examined: number | undefined
  readonly findings: readonly string[]
  /** Findings that are about the subject, not about the rule's configuration. */
  readonly real: number
}

const RULES = ['links', 'live pointers', 'honestyAtClose'] as const

/** A receipt's `examined` (ADR-014), read without a cast: `honestyAtClose` is typed as a plain array. */
function examinedOf(v: ArchViolation[]): number | undefined {
  return 'examined' in v && typeof v.examined === 'number' ? v.examined : undefined
}

function receipt(v: ArchViolation[], root: string): Receipt {
  return {
    examined: examinedOf(v),
    findings: v.map((f) => JSON.stringify(f).replaceAll(root, '<root>')).sort(),
    real: v.filter((f) => f.bypassFilters !== true).length,
  }
}

function see(c: Corpus): Seen {
  const root = c.root
  return {
    documents: c
      .documents()
      .map((d) => JSON.stringify([d.relPath, d.frozen, d.text]))
      .sort(),
    fileIndex: [...c.fileIndex].sort(),
    receipts: {
      links: receipt(links(c).should().resolve().violations(), root),
      'live pointers': receipt(pointers(c).that().areLive().should().resolve().violations(), root),
      honestyAtClose: receipt(honestyAtClose(c, { report: 'return' }), root),
    },
    frozenPointers: pointers(c)
      .that()
      .areFrozen()
      .select({ label: 'pointer', identify: (p) => ({ name: p.raw }) })
      .elements.map((p) => JSON.stringify([p.doc.relPath, p.line, p.raw]))
      .sort(),
    boxes: taskItems(c)
      .select({ label: 'box', identify: (b) => ({ name: b.text }) })
      .elements.map((b) =>
        JSON.stringify([b.doc.relPath, b.line, b.checked, b.text, b.mark, b.state]),
      )
      .sort(),
  }
}

function bothWays(t: Tree): { disk: Seen; text: Seen } {
  const options = {
    roots: t.roots,
    ...(t.ignore ? { ignore: t.ignore } : {}),
    ...(t.frozen ? { frozen: t.frozen } : {}),
  }
  return {
    disk: see(corpus({ cwd: t.cwd, ...options })),
    text: see(corpusFromText(readTree(t.cwd), options)),
  }
}

describe('corpusFromText resolves as corpus() does (plan 0455)', () => {
  // Loaded per test and memoised, so a tree that throws reds its own row, not the whole file.
  const memo = new Map<string, { disk: Seen; text: Seen }>()
  const loaded = (t: Tree): { disk: Seen; text: Seen } => {
    const hit = memo.get(t.name)
    if (hit !== undefined) return hit
    const both = bothWays(t)
    memo.set(t.name, both)
    return both
  }

  for (const t of TREES) {
    it(`parity on the ${t.name} tree: documents, index, receipts and element sets`, () => {
      const { disk, text } = loaded(t)
      expect(text.documents).toEqual(disk.documents)
      expect(text.fileIndex).toEqual(disk.fileIndex)
      expect(text.receipts).toEqual(disk.receipts)
      expect(text.frozenPointers).toEqual(disk.frozenPointers)
      expect(text.boxes).toEqual(disk.boxes)
    })
  }

  it('the parity is not empty: every rule examines and finds something real on some tree', () => {
    const seen = TREES.map((t) => ({ tree: t.name, ...loaded(t) }))
    for (const rule of RULES) {
      const live = seen.filter(
        ({ disk, text }) =>
          (disk.receipts[rule]?.examined ?? 0) > 0 &&
          (disk.receipts[rule]?.real ?? 0) > 0 &&
          (text.receipts[rule]?.examined ?? 0) > 0 &&
          (text.receipts[rule]?.real ?? 0) > 0,
      )
      expect(
        live.map((s) => s.tree),
        rule,
      ).not.toEqual([])
    }
    // The element-set comparisons each need a population on both sides somewhere.
    const frozen = seen.filter(
      (s) => s.disk.frozenPointers.length > 0 && s.text.frozenPointers.length > 0,
    )
    expect(frozen.map((s) => s.tree)).not.toEqual([])
    const boxes = seen.filter((s) => s.disk.boxes.length > 0 && s.text.boxes.length > 0)
    expect(boxes.map((s) => s.tree)).not.toEqual([])
    // Frozen documents exist on both sides, so `frozen`'s default is compared, not assumed.
    const frozenDocs = seen.filter(
      (s) =>
        s.disk.documents.some((d) => d.includes('",true,"')) &&
        s.text.documents.some((d) => d.includes('",true,"')),
    )
    expect(frozenDocs.map((s) => s.tree)).not.toEqual([])
  })
})

describe('corpusFromText: pointers resolve in memory', () => {
  const c = corpusFromText({
    'docs/guide.md': '# Guide\n\nSee `src/app.ts:2` and `src/app.ts:9`.\n',
    'src/app.ts': 'export const a = 1\nexport const b = 2\n',
  })

  it('a pointer past the end of a file that exists only in the map is stale at its own line', () => {
    const v = pointers(c).that().areLive().should().resolve().violations()
    expect(examinedOf(v)).toBe(2)
    expect(v.map((f) => [f.file, f.line, f.message])).toEqual([
      [
        join(c.root, 'docs/guide.md'),
        3,
        'stale code pointer: src/app.ts has 3 lines; "src/app.ts:9" references line 9',
      ],
    ])
  })
})

describe('corpusFromText: frozen globs are judged as corpus() judges them (bug 0499)', () => {
  const files = { 'docs/a.md': '# A\n', 'docs/b.md': '# B\n' }

  it('an explicit frozen glob that marks nothing is refused, and accepted once declared', () => {
    expect(() => corpusFromText(files, { frozen: ['**/wont-do/**'] })).toThrow(
      "corpus frozen glob '**/wont-do/**' marks none of the corpus's 2 documents",
    )
    const c = corpusFromText(files, {
      frozen: ['**/wont-do/**'],
      expectEmptyFrozen: ['**/wont-do/**'],
    })
    expect(c.documents().map((d) => [d.relPath, d.frozen])).toEqual([
      ['docs/a.md', false],
      ['docs/b.md', false],
    ])
    // The declaration expires: once a key lands under the glob, it is refused until dropped.
    expect(() =>
      corpusFromText(
        { ...files, 'wont-do/c.md': '# C\n' },
        { frozen: ['**/wont-do/**'], expectEmptyFrozen: ['**/wont-do/**'] },
      ),
    ).toThrow(
      "corpus frozen glob '**/wont-do/**' is declared in expectEmptyFrozen, but it marks 1 document now",
    )
  })

  it('a frozen glob that can never match is refused through corpusFromText', () => {
    expect(() => corpusFromText(files, { frozen: ['dnoe/**'] })).toThrow(
      "corpus frozen glob 'dnoe/**' marks none of the corpus's 2 documents",
    )
  })

  it("the caller's frozen glob is the one applied, not the default", () => {
    const c = corpusFromText(
      { 'docs/a.md': '# A\n', 'done/b.md': '# B\n', 'completed/c.md': '# C\n' },
      { frozen: ['done/**'] },
    )
    expect(c.documents().map((d) => [d.relPath, d.frozen])).toEqual([
      ['completed/c.md', false],
      ['docs/a.md', false],
      ['done/b.md', true],
    ])
  })
})

describe('corpusFromText: expectEmptyRoots keeps corpus() meaning', () => {
  const files = { 'docs/a.md': '# A\n' }

  it('a dead root beside a live one is refused, and accepted once declared empty', () => {
    expect(() => corpusFromText(files, { roots: ['docs/**', 'notes/**'] })).toThrow(
      "corpus root 'notes/**' matches no file",
    )
    const c = corpusFromText(files, {
      roots: ['docs/**', 'notes/**'],
      expectEmptyRoots: ['notes/**'],
    })
    expect(c.documents().map((d) => d.relPath)).toEqual(['docs/a.md'])
  })
})

describe('corpusFromText: roots', () => {
  it('defaults to every .md key', () => {
    const c = corpusFromText({ 'a.md': '# A\n', 'src/b.ts': 'export {}\n' })
    expect(c.documents().map((d) => d.relPath)).toEqual(['a.md'])
    expect([...c.fileIndex].sort()).toEqual(['a.md', 'src/b.ts'])
  })

  it('a root matching nothing is an empty source, as corpus() over an empty directory is', () => {
    const fromText = corpusFromText({ 'a.md': '# A\n' }, { roots: ['docs/**'] })
    expect(fromText.documents()).toEqual([])
    const dir = mkdtempSync(join(tmpdir(), 'eess-text-corpus-'))
    try {
      const onDisk = corpus({ cwd: dir, roots: ['docs/**'] })
      const rule = (c: Corpus): ArchViolation[] =>
        links(c).should().resolve().rule({ id: 'test/links' }).violations()
      const text = rule(fromText)
      const disk = rule(onDisk)
      expect(text.map((f) => f.message)).toEqual(disk.map((f) => f.message))
      expect(examinedOf(text)).toBe(examinedOf(disk))
      // The empty-source finding by name: `zeroLoadedSourceViolation`'s message, on the rule's id.
      expect(text).toHaveLength(1)
      expect(text[0]?.ruleId).toBe('test/links')
      expect(text[0]?.bypassFilters).toBe(true)
      expect(text[0]?.message).toMatch(
        /^this rule's source loaded zero units before any selection ran/,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('corpusFromText: what cannot behave as on disk is refused', () => {
  const refused = (files: Record<string, string>, named: string, root?: string): void => {
    let caught: unknown
    try {
      corpusFromText(files, root === undefined ? {} : { root })
    } catch (error: unknown) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ArchConfigError)
    expect(caught instanceof Error ? caught.message : '').toContain(named)
  }

  it('refuses a waiver in a loaded document, naming the document and line', () => {
    refused(
      { 'docs/a.md': '# A\n\n<!-- eess-exclude corpus/x: a reason -->\nText.\n' },
      "'docs/a.md' line 3",
    )
  })

  it('refuses a malformed waiver in a loaded document, which the kernel would report', () => {
    // A block that never ends: the kernel's parse yields a warning and no exclusion, so only the
    // warnings half of the refusal can refuse it.
    const text = '# A\n\n<!-- eess-exclude-start corpus/x: a reason -->\nText.\n'
    const parsed = parseExclusionComments(text, join(sep, '__eess_text_corpus__', 'docs/a.md'))
    expect(parsed.exclusions).toEqual([])
    expect(parsed.warnings).not.toEqual([])
    refused({ 'docs/a.md': text }, "'docs/a.md' line 3")
  })

  it('accepts the same waiver in a file outside roots', () => {
    const c = corpusFromText(
      {
        'docs/a.md': '# A\n',
        'notes/w.md': '# W\n\n<!-- eess-exclude corpus/x: a reason -->\n',
      },
      { roots: ['docs/**'] },
    )
    expect(c.documents().map((d) => d.relPath)).toEqual(['docs/a.md'])
  })

  it('refuses a path that has no single repo-relative meaning, naming it and why', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['/abs.md', 'is absolute'],
      ['C:/abs.md', 'is absolute'],
      ['../x.md', "contains '..'"],
      ['./x.md', "starts with './'"],
      ['a\\b.md', 'contains a backslash'],
      ['a//b.md', 'is not normalised'],
      ['a/./b.md', 'is not normalised'],
      ['a/', 'is not normalised'],
      ['', 'is empty'],
    ]
    for (const [p, why] of cases) refused({ [p]: '# X\n' }, `'${p}' ${why}`)
  })

  it('refuses keys that differ only in letter case, naming both', () => {
    refused(
      { 'docs/a.md': '# A\n', 'docs/A.md': '# A\n' },
      "'docs/a.md' and 'docs/A.md' differ only in letter case",
    )
    refused(
      { 'Docs/a.md': '# A\n', 'docs/b.md': '# B\n' },
      "'docs' and 'Docs' differ only in letter case",
    )
  })

  it('accepts a file named like a directory corpus() never walks', () => {
    // The walk skips such names only as directories, so a file called `dist` is indexed on disk too.
    const c = corpusFromText({ 'docs/a.md': '# A\n', 'docs/dist': 'x\n', coverage: 'y\n' })
    expect([...c.fileIndex].sort()).toEqual(['coverage', 'docs/a.md', 'docs/dist'])
  })

  it('refuses a pointer rule with externalRoots over a text corpus', () => {
    const c = corpusFromText({ 'docs/a.md': 'See `legacy-src/Thing.groovy:1`.\n' })
    expect(() =>
      pointers(c)
        .should()
        .resolve({ externalRoots: [join(FIXTURES, 'external-root', 'legacy')] }),
    ).toThrow(ArchConfigError)
    expect(() =>
      pointers(c)
        .should()
        .resolve({ externalRoots: [tmpdir()] }),
    ).toThrow('external roots are read from the real disk')
  })

  it('refuses a path that is also the directory of another key, naming both', () => {
    refused({ a: 'x\n', 'a/b.md': '# B\n' }, "'a' is a file and also the directory of 'a/b.md'")
  })

  it('refuses a key under a directory corpus() never walks, naming the path and the directory', () => {
    refused(
      { 'node_modules/p/readme.md': '# P\n' },
      "'node_modules/p/readme.md' lies under 'node_modules/'",
    )
  })

  it('refuses a root that exists on disk', () => {
    refused({ 'a.md': '# A\n' }, `root '${tmpdir()}' exists on disk`, tmpdir())
  })
})

describe('corpusFromText: document order', () => {
  it('does not depend on the order the map was built in', () => {
    const forward = corpusFromText({ 'b.md': '# B\n', 'a.md': '# A\n', 'c/d.md': '# D\n' })
    const backward = corpusFromText({ 'c/d.md': '# D\n', 'a.md': '# A\n', 'b.md': '# B\n' })
    const order = (c: Corpus): string[] => c.documents().map((d) => d.relPath)
    expect(order(forward)).toEqual(['a.md', 'b.md', 'c/d.md'])
    expect(order(backward)).toEqual(order(forward))
  })
})

describe("corpusFromText: the waiver refusal reads what the kernel's parse reads", () => {
  it('a directive only inside a fenced code block is accepted exactly when the kernel reads none', () => {
    const text = '# A\n\n```md\n<!-- eess-exclude corpus/x: shown, not applied -->\n```\n'
    const parsed = parseExclusionComments(text, join(sep, '__eess_text_corpus__', 'docs/a.md'))
    expect(parsed.exclusions).toEqual([])
    expect(parsed.warnings).toEqual([])
    expect(corpusFromText({ 'docs/a.md': text }).documents()).toHaveLength(1)
  })
})
