import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { correspondence, ArchRuleError, type Selection, type ArchViolation } from '@nielspeter/eess'
import { corpus, docs, links, pointers } from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/corpus')

/** Run a checking chain and return the violations it raises (empty if none). */
function violationsFrom(fn: () => void): ArchViolation[] {
  try {
    fn()
    return []
  } catch (err) {
    if (err instanceof ArchRuleError) return err.violations
    throw err
  }
}

/**
 * `.select()` is inherited from the kernel `RuleBuilder` base class, so every
 * md builder already produces a `Selection` consumable by `correspondence()`.
 * These tests prove that end-to-end — the capability existed but was untested.
 */
describe('md builders → .select() → correspondence()', () => {
  it('docs().select() yields a Selection of documents', () => {
    const c = corpus({ roots: ['docs/good.md', 'docs/bad.md'], cwd: fixtureRoot })
    const sel = docs(c).select({
      label: 'doc',
      identify: (d) => ({ name: d.relPath, file: d.file }),
    })
    expect(sel.label).toBe('doc')
    expect(sel.elements).toHaveLength(2)
    expect(sel.elements.map((d) => d.relPath).sort()).toEqual(['docs/bad.md', 'docs/good.md'])
  })

  it('a docs() selection binds to a code side via correspondence()', () => {
    const c = corpus({ roots: ['docs/good.md'], cwd: fixtureRoot })
    const docSel = docs(c).select({
      label: 'doc',
      identify: (d) => ({ name: d.relPath, file: d.file }),
    })
    // Right side claims a doc the corpus does not contain → completeness fails.
    const claimed: Selection<{ name: string }> = {
      elements: [{ name: 'docs/good.md' }, { name: 'docs/ghost.md' }],
      label: 'index entry',
      identify: (e) => ({ name: e.name }),
    }
    const violations = violationsFrom(() =>
      correspondence({
        left: docSel,
        right: claimed,
        keyBy: (e) => ('name' in e ? e.name : e.relPath),
      })
        .should()
        .beComplete({ direction: 'both' })
        .check(),
    )
    expect(violations.some((v) => v.element === 'docs/ghost.md')).toBe(true)
  })

  it('links().select() and pointers().select() yield Selections', () => {
    const c = corpus({ roots: ['docs/links.md', 'docs/pointers.md'], cwd: fixtureRoot })
    const linkSel = links(c).select({
      label: 'link',
      identify: (l) => ({ name: l.url, file: l.doc.file, line: l.line }),
    })
    const pointerSel = pointers(c).select({
      label: 'pointer',
      identify: (p) => ({ name: p.raw, file: p.doc.file, line: p.line }),
    })
    // Both fenced links are excluded already by the parser; at least the real
    // ones surface as selectable elements.
    expect(linkSel.elements.length).toBeGreaterThan(0)
    expect(pointerSel.elements.length).toBeGreaterThan(0)
    expect(linkSel.elements.every((l) => typeof l.url === 'string')).toBe(true)
  })
})
