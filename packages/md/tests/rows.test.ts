import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { correspondence, ArchRuleError, type Selection, type ArchViolation } from '@nielspeter/eess'
import { corpus, rows } from '../src/index.js'

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

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/rows')

describe('rows()', () => {
  const c = corpus({ roots: ['tables.md'], cwd: fixtureRoot })

  it('draws rows from every matching table (union), not just the first', () => {
    const sel = rows(c, { columns: { pkg: /^Package$/, status: /^Status$/ } }).select({
      label: 'row',
      identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
    })
    // core + ts (first table) + extra (second table)
    expect(sel.elements.map((r) => r.get('pkg'))).toEqual(['core', 'ts', 'extra'])
  })

  it('scopes to a section when given', () => {
    const sel = rows(c, {
      section: /^Packages$/,
      columns: { pkg: /^Package$/, status: /^Status$/ },
    }).select({ label: 'row', identify: (r) => ({ name: r.get('pkg') }) })
    expect(sel.elements.map((r) => r.get('pkg'))).toEqual(['core', 'ts'])
  })

  it('maps located columns via get(role)', () => {
    const sel = rows(c, {
      section: /^Packages$/,
      columns: { pkg: /^Package$/, ver: /^Status$/ },
    }).select({ label: 'row', identify: (r) => ({ name: r.get('pkg') }) })
    expect(sel.elements.map((r) => ({ pkg: r.get('pkg'), ver: r.get('ver') }))).toEqual([
      { pkg: 'core', ver: '1.0' },
      { pkg: 'ts', ver: '2.0' },
    ])
  })

  it('reports the exact source line of each row', () => {
    const sel = rows(c, { columns: { pkg: /^Package$/, status: /^Status$/ } }).select({
      label: 'row',
      identify: (r) => ({ name: r.get('pkg'), line: r.line }),
    })
    // core@9, ts@10 (first table), extra@16 (second table) — see the fixture
    expect(sel.elements.map((r) => r.line)).toEqual([9, 10, 16])
  })

  it('returns an empty selection when no table has the required columns', () => {
    const sel = rows(c, { columns: { nope: /^Nonexistent$/ } }).select({
      label: 'row',
      identify: (r) => ({ name: r.get('nope') }),
    })
    expect(sel.elements).toEqual([])
  })

  it('preserves options across fork() (.should())', () => {
    // .should() forks the builder; the RowMatchOptions must survive so the
    // forked builder still resolves the same rows.
    const builder = rows(c, {
      section: /^Packages$/,
      columns: { pkg: /^Package$/, status: /^Status$/ },
    })
    const forked = builder.should()
    const sel = forked.select({ label: 'row', identify: (r) => ({ name: r.get('pkg') }) })
    expect(sel.elements.map((r) => r.get('pkg'))).toEqual(['core', 'ts'])
  })

  it('feeds a kernel correspondence() — rows bind to code, drift fails', () => {
    const specRows = rows(c, {
      section: /^Packages$/,
      columns: { pkg: /^Package$/, status: /^Status$/ },
    }).select({
      label: 'spec row',
      identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
    })
    // "code" side missing 'ts' → right-to-left completeness fails for the spec.
    const codePackages: Selection<{ name: string }> = {
      elements: [{ name: 'core' }],
      label: 'package',
      identify: (p) => ({ name: p.name }),
    }
    const violations = violationsFrom(() =>
      correspondence({ left: specRows, right: codePackages })
        .should()
        .beComplete({ direction: 'left-to-right' })
        .check(),
    )
    expect(violations.some((v) => v.element === 'ts')).toBe(true)
  })
})
