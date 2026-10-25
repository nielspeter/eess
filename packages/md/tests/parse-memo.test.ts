/**
 * Bug 0547: a text is parsed once per process. The memo is private to `model/prose.ts` and must change
 * no verdict: every document still gets its own tree, a changed text is read anew, the front-matter
 * fallback is what is kept, and a text over the bound still parses whole (spike 0546's decision).
 */
import { mkdtempSync, mkdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Root } from 'mdast'
import { describe, expect, it } from 'vitest'
import { corpus, corpusFromText, taskItems, type MdDocument } from '../src/index.js'
import { createParseMemo } from '../src/model/parse-memo.js'
import { parseMarkdown, proseText } from '../src/model/prose.js'

const kinds = (root: Root): string[] => root.children.map((n) => n.type)

function docAt(docs: readonly MdDocument[], relPath: string): MdDocument {
  const doc = docs.find((d) => d.relPath === relPath)
  if (doc === undefined) throw new Error(`no document ${relPath}`)
  return doc
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

  it('a file rewritten to other text of the same length is read anew', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eess-md-parse-memo-'))
    try {
      mkdirSync(join(dir, 'docs'))
      const file = join(dir, 'docs', 'a.md')
      writeFileSync(file, '# One\n')
      const { mtime } = statSync(file)
      const first = corpus({ cwd: dir, roots: ['docs/**'] }).documents()
      writeFileSync(file, '- One\n')
      utimesSync(file, mtime, mtime)
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

  it('two documents of one text get their own trees, and editing one changes nothing else', () => {
    const text = '# Title\n\n```js\ncode\n```\n'
    const docs = corpusFromText({ 'a.md': text, 'b.md': text }).documents()
    const a = docAt(docs, 'a.md')
    const b = docAt(docs, 'b.md')
    expect(a.root).not.toBe(b.root)
    const before = structuredClone(b.root)
    a.root.children.splice(1)
    const heading = a.root.children[0]
    if (heading?.type === 'heading') heading.depth = 3
    expect(b.root).toEqual(before)
    expect(docAt(corpusFromText({ 'c.md': text }).documents(), 'c.md').root).toEqual(before)
    expect(proseText(text, 'code-blocks')).toBe('# Title\n\n\n\n\n')
  })
})

describe('the memo', () => {
  it('hands the same frozen master back for a text it holds', () => {
    const memo = createParseMemo(1000, parseMarkdown)
    const tree = memo.master('# A\n\ntext\n')
    expect(memo.master('# A\n\ntext\n')).toBe(tree)
    expect(Object.isFrozen(tree)).toBe(true)
    expect(Object.isFrozen(tree.children)).toBe(true)
    expect(Object.isFrozen(tree.children[0])).toBe(true)
    expect(() => tree.children.push({ type: 'thematicBreak' })).toThrow(TypeError)
  })

  it('a key two texts share gives each text its own tree', () => {
    const memo = createParseMemo(1000, parseMarkdown, () => 'one key')
    expect(kinds(memo.master('# A\n'))).toEqual(['heading'])
    expect(kinds(memo.master('- A\n'))).toEqual(['list'])
    expect(kinds(memo.master('# A\n'))).toEqual(['heading'])
  })

  it('evicts the least recently used text past its bound, and an evicted text parses the same', () => {
    const memo = createParseMemo(20, parseMarkdown)
    const a = '# Aaaaaaa\n'
    const b = '# Bbbbbbb\n'
    const first = memo.master(a)
    memo.master(b)
    expect(memo.master(b)).toBe(memo.master(b))
    const c = '# Ccccccc\n'
    memo.master(c)
    const again = memo.master(a)
    expect(again).not.toBe(first)
    expect(again).toEqual(first)
  })

  it('parses a text longer than its bound whole, and does not keep it', () => {
    const memo = createParseMemo(8, parseMarkdown)
    const text = '# A heading longer than the bound\n\n- a list\n'
    const tree = memo.master(text)
    expect(kinds(tree)).toEqual(['heading', 'list'])
    expect(memo.master(text)).not.toBe(tree)
  })
})
