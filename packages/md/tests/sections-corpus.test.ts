/**
 * Plan 0496, ADR-009 rule 5: the section index checked against values derived another way, over this
 * repository's own corpus. The extents are read from mdast positions, not from `doc.sections`; the
 * enclosure is read from `contains`, not from the stack that built `sectionPath`.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { corpus, sections, type MdSectionElement } from '../src/index.js'

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const c = corpus({ cwd: repo, roots: ['work/**/*.md', 'docs/**/*.md', 'adr/**/*.md'] })
const all: readonly MdSectionElement[] = sections(c)
  .that()
  .satisfy({ description: 'all', test: () => true })
  .select({ label: 'section', identify: (s) => ({ name: s.name }) }).elements

describe('the section index, derived differently (ADR-009 rule 5)', () => {
  it('reads a corpus large enough to mean something', () => {
    expect(c.documents().length).toBeGreaterThan(400)
    expect(all.length).toBeGreaterThan(4000)
  })

  it('names, depths and lines equal doc.sections; each endLine is read from mdast positions', () => {
    for (const doc of c.documents()) {
      const mine = all.filter((s) => s.doc === doc)
      expect(mine.map((s) => [s.name, s.depth, s.line])).toEqual(
        doc.sections.map((s) => [s.name, s.depth, s.line]),
      )
      const headings = doc.root.children.flatMap((n) =>
        n.type === 'heading' ? [{ depth: n.depth, line: n.position?.start.line ?? 0 }] : [],
      )
      const last = doc.root.position?.end.line ?? 0
      // mdast's end is the line after a final newline only when the text ends with one; the last
      // line a section governs is the last line holding text or the newline that ends it.
      const lastLine = doc.text.endsWith('\n') ? last - 1 : last
      mine.forEach((s, i) => {
        const next = headings.slice(i + 1).find((h) => h.depth <= s.depth)
        expect(s.endLine, `${doc.relPath}:${String(s.line)}`).toBe(
          next === undefined ? lastLine : next.line - 1,
        )
      })
    }
  })

  it('each sectionPath equals the names of the other sections that contain its line', () => {
    for (const s of all) {
      const enclosing = all.filter(
        (o) => o !== s && o.doc === s.doc && o.line < s.line && s.line <= o.endLine,
      )
      expect(s.sectionPath, `${s.doc.relPath}:${String(s.line)}`).toEqual(
        enclosing.map((o) => o.name),
      )
    }
  })
})
