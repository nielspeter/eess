/**
 * Bug 0547: a text is parsed once per process. The memo is private to `model/prose.ts` and must change
 * no verdict: every document still gets its own tree, a changed text is read anew, the front-matter
 * fallback is what is kept, and a text over the bound still parses whole (spike 0546's decision).
 * That the memo is wired in, and cleared with the kernel's caches, is `parse-memo-wiring.test.ts`.
 */
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Root } from 'mdast'
import { describe, expect, it } from 'vitest'
import { corpus, corpusFromText, taskItems, type MdDocument } from '../src/index.js'
import { createParseMemo } from '../src/model/parse-memo.js'
import { parseMarkdown, proseText } from '../src/model/prose.js'
import { findState } from '../src/rules/ledger.js'

const kinds = (root: Root): string[] => root.children.map((n) => n.type)

function docAt(docs: readonly MdDocument[], relPath: string): MdDocument {
  const doc = docs.find((d) => d.relPath === relPath)
  if (doc === undefined) throw new Error(`no document ${relPath}`)
  return doc
}

/** Every object reachable from `value` that is not frozen. */
function unfrozen(value: unknown, found: unknown[] = []): unknown[] {
  if (typeof value !== 'object' || value === null) return found
  if (!Object.isFrozen(value)) found.push(value)
  for (const child of Object.values(value)) unfrozen(child, found)
  return found
}

describe('a text is parsed once per process, and no verdict depends on it', () => {
  it('two texts of one length and one long prefix each get their own tree', () => {
    const prefix = 'x'.repeat(5000)
    const docs = corpusFromText({
      'a.md': `${prefix}\n\n# A\n`,
      'b.md': `${prefix}\n\n- A\n`,
    }).documents()
    expect(kinds(docAt(docs, 'a.md').root)).toEqual(['paragraph', 'heading'])
    expect(kinds(docAt(docs, 'b.md').root)).toEqual(['paragraph', 'list'])
  })

  it('a file rewritten to other text of the same length and the same mtime is read anew', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eess-md-parse-memo-'))
    try {
      mkdirSync(join(dir, 'docs'))
      const file = join(dir, 'docs', 'a.md')
      const at = new Date('2020-01-01T00:00:00Z')
      writeFileSync(file, '# One\n')
      utimesSync(file, at, at)
      const first = corpus({ cwd: dir, roots: ['docs/**'] }).documents()
      writeFileSync(file, '- One\n')
      utimesSync(file, at, at)
      const second = corpus({ cwd: dir, roots: ['docs/**'] }).documents()
      expect(kinds(docAt(first, 'docs/a.md').root)).toEqual(['heading'])
      expect(kinds(docAt(second, 'docs/a.md').root)).toEqual(['list'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('a line-1 block that is not front matter is read as markdown in every document', () => {
    const text = '---\n- [ ] a\n---\n'
    const c = corpusFromText({ 'a.md': text, 'b.md': text })
    const open = taskItems(c).that().areOpen().should().notExist().violations()
    expect(open.map((v) => v.file?.split(/[\\/]/).pop()).sort()).toEqual(['a.md', 'b.md'])
  })

  it('a reader handed no tree reads the line-1 block as the corpus does, after the fallback', () => {
    const text = '---\n```\n**State:** Done\n```\n---\n'
    const doc = docAt(corpusFromText({ 'a.md': text }).documents(), 'a.md')
    expect(kinds(doc.root)).toEqual(['thematicBreak', 'code', 'thematicBreak'])
    expect(findState(text, ['Done'], doc.root)).toBeNull()
    expect(findState(text, ['Done'])).toBeNull()
    expect(findState('**State:** Done\n', ['Done'])?.state).toBe('Done')
  })

  it('two documents of one text get their own trees, and editing one changes nothing else', () => {
    const text = '# Title\n\n```js\ncode\n```\n'
    const docs = corpusFromText({ 'a.md': text, 'b.md': text }).documents()
    const a = docAt(docs, 'a.md')
    const b = docAt(docs, 'b.md')
    expect(a.root).not.toBe(b.root)
    const before = structuredClone(b.root)
    a.root.children.splice(1)
    const heading = a.root.children[0]
    if (heading?.type !== 'heading') throw new Error('the first block is not the heading')
    heading.depth = 3
    expect(b.root).toEqual(before)
    expect(docAt(corpusFromText({ 'c.md': text }).documents(), 'c.md').root).toEqual(before)
    expect(proseText(text, 'code-blocks')).toBe('# Title\n\n\n\n\n')
  })
})

describe('the memo', () => {
  it('hands the same master back for a text it holds, frozen to its leaves', () => {
    const memo = createParseMemo(1000, parseMarkdown)
    const tree = memo.master('# A *b*\n\n- [ ] [c](./c.md)\n')
    expect(memo.master('# A *b*\n\n- [ ] [c](./c.md)\n')).toBe(tree)
    expect(kinds(tree)).toEqual(['heading', 'list'])
    expect(unfrozen(tree)).toEqual([])
    expect(() => tree.children.push({ type: 'thematicBreak' })).toThrow(TypeError)
  })

  it('a key two texts share gives each text its own tree', () => {
    const memo = createParseMemo(1000, parseMarkdown, () => 'one key')
    expect(kinds(memo.master('# A\n'))).toEqual(['heading'])
    expect(kinds(memo.master('- A\n'))).toEqual(['list'])
    expect(kinds(memo.master('# A\n'))).toEqual(['heading'])
  })

  it('holds texts up to its bound exactly, and evicts the least recently used, not the oldest', () => {
    const memo = createParseMemo(20, parseMarkdown)
    const a = '# Aaaaaaa\n'
    const b = '# Bbbbbbb\n'
    const c = '# Ccccccc\n'
    const ta = memo.master(a)
    const tb = memo.master(b)
    expect(memo.master(a)).toBe(ta)
    expect(memo.master(b)).toBe(tb)
    expect(memo.master(a)).toBe(ta)
    const tc = memo.master(c)
    expect(memo.master(a)).toBe(ta)
    expect(memo.master(c)).toBe(tc)
    const again = memo.master(b)
    expect(again).not.toBe(tb)
    expect(again).toEqual(tb)
  })

  it('a reset memo forgets every text and holds a full bound again', () => {
    const memo = createParseMemo(20, parseMarkdown)
    const a = '# Aaaaaaa\n'
    const b = '# Bbbbbbb\n'
    const before = memo.master(a)
    memo.master(b)
    memo.reset()
    const ta = memo.master(a)
    expect(ta).not.toBe(before)
    const tb = memo.master(b)
    expect(memo.master(a)).toBe(ta)
    expect(memo.master(b)).toBe(tb)
  })

  it('parses a text longer than its bound whole, and does not keep it', () => {
    const memo = createParseMemo(8, parseMarkdown)
    const text = '# A heading longer than the bound\n\n- a list\n'
    const tree = memo.master(text)
    expect(kinds(tree)).toEqual(['heading', 'list'])
    expect(memo.master(text)).not.toBe(tree)
  })
})
