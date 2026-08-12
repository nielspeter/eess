import { describe, it, expect } from 'vitest'
import { correspondence, formatViolationsJson, type Selection } from '../src/index.js'

interface Named {
  name: string
}
const idName = (x: Named): { name: string } => ({ name: x.name })
const sel = <T>(
  elements: T[],
  label: string,
  identify: (el: T) => { name: string },
): Selection<T> => ({
  elements,
  label,
  identify,
})

describe('correspondence()', () => {
  // Bugs 0122 and 0113: `TerminalBuilder` subclasses build violations directly,
  // with no `ConditionContext` to carry the rule's own metadata. Before the
  // stamp in `applyFilters`, `.violations()` returned them bare — so the
  // caller-owns-emission path (ADR-008) lost the rationale in every format, and
  // `.rule({ suggestion })` on a two-sided rule could never render a `Fix:` line.
  it('carries because, suggestion, docs and ruleId onto EVERY violation from .violations()', () => {
    // Two ghosts, asserted by identity rather than by count: stamping only
    // `result[0]` survives a single-violation test, and every correspondence in
    // this repo happens to emit one violation per fixture, so nothing else here
    // could have caught it.
    const left = sel([{ name: 'A' }, { name: 'GHOST-1' }, { name: 'GHOST-2' }], 'index row', idName)
    const right = sel([{ name: 'A' }], 'file', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .because('an index row that names no file is a spec pointing at nothing')
      .rule({ id: 'spec/index-matches-files', suggestion: 'remove the row', docs: 'adr/001.md' })
      .violations()

    expect(v.map((x) => [x.element, x.ruleId, x.because, x.suggestion, x.docs])).toEqual([
      [
        'GHOST-1',
        'spec/index-matches-files',
        'an index row that names no file is a spec pointing at nothing',
        'remove the row',
        'adr/001.md',
      ],
      [
        'GHOST-2',
        'spec/index-matches-files',
        'an index row that names no file is a spec pointing at nothing',
        'remove the row',
        'adr/001.md',
      ],
    ])
  })

  it('carries the rationale into --format json, which returned null before', () => {
    const left = sel([{ name: 'GHOST' }], 'index row', idName)
    const right = sel<Named>([], 'file', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .because('the rationale')
      .rule({ id: 'r', suggestion: 'the remedy' })
      .violations()

    const parsed: unknown = JSON.parse(formatViolationsJson(v))
    expect(parsed).toMatchObject({
      violations: [{ ruleId: 'r', because: 'the rationale', suggestion: 'the remedy' }],
    })
  })

  it('stamps because without .rule() — .because() alone is enough', () => {
    const left = sel([{ name: 'GHOST' }], 'index row', idName)
    const right = sel<Named>([], 'file', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .because('the rationale')
      .violations()

    expect(v[0]?.because).toBe('the rationale')
    expect(v[0]?.ruleId).toBeUndefined()
  })

  // Named for what it pins, after review measured that its previous name — "does
  // not overwrite metadata a violation already carries" — described a property it
  // could not test (the rule sets no `suggestion`, so nothing is stamped and the
  // assertion is vacuous). The real non-overwrite guard is exercised directly
  // against `applyFilters` in execute-rule.test.ts. What this DOES pin is worth
  // keeping: the two remedy routes occupy different places and do not merge.
  it('suggest folds into the message and never becomes v.suggestion', () => {
    const left = sel([{ name: 'GHOST' }], 'index row', idName)
    const right = sel<Named>([], 'file', idName)
    const v = correspondence({
      left,
      right,
      keyBy: (e: Named) => e.name,
      suggest: { left: (info) => `drop the row for ${info.name}` },
    })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .because('why')
      .rule({ id: 'r' })
      .violations()

    expect(v[0]?.message).toContain('drop the row for GHOST')
    expect(v[0]?.suggestion).toBeUndefined()
  })

  // Pins a known limitation rather than a desired behaviour (bug 0124). A
  // rule-level `suggestion` is stamped onto every branch, so on a two-directional
  // rule the same remedy is shown for opposite causes: "no matching file" wants
  // the row removed, "no matching row" wants one added. Documented in the
  // changeset; per-side `suggest` is the correct tool when the remedy differs.
  // This test exists so the day it is fixed, it fails and says why.
  it('stamps one rule-level suggestion onto every branch, including opposite ones', () => {
    const left = sel([{ name: 'ONLY-LEFT' }], 'index row', idName)
    const right = sel([{ name: 'ONLY-RIGHT' }], 'file', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'both' })
      .rule({ id: 'r', suggestion: 'remove the row from the index' })
      .violations()

    expect(v.map((x) => [x.element, x.suggestion])).toEqual([
      ['ONLY-LEFT', 'remove the row from the index'],
      // ← the remedy for this one is "add a row", not "remove" it
      ['ONLY-RIGHT', 'remove the row from the index'],
    ])
  })

  it('beComplete passes when both sets match by key', () => {
    const left = sel([{ name: 'A' }, { name: 'B' }], 'diagram class', idName)
    const right = sel([{ name: 'A' }, { name: 'B' }], 'TS class', idName)
    expect(() =>
      correspondence({ left, right, keyBy: (e: Named) => e.name })
        .should()
        .beComplete()
        .check(),
    ).not.toThrow()
  })

  it('flags a left element with no right counterpart', () => {
    const left = sel([{ name: 'A' }, { name: 'Extra' }], 'diagram class', idName)
    const right = sel([{ name: 'A' }], 'TS class', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'both' })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/Extra.*no matching TS class/)
  })

  it('flags a right element with no left counterpart', () => {
    const left = sel([{ name: 'A' }], 'L', idName)
    const right = sel([{ name: 'A' }, { name: 'B' }], 'R', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete()
      .violations()
    expect(v.some((x) => x.message.includes('"B"'))).toBe(true)
  })

  it('direction left-to-right ignores unmatched right elements', () => {
    const left = sel([{ name: 'A' }], 'L', idName)
    const right = sel([{ name: 'A' }, { name: 'B' }], 'R', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .violations()
    expect(v).toHaveLength(0)
  })

  it('detects ambiguous many-to-one matches', () => {
    const left = sel([{ name: 'A' }], 'L', idName)
    const right = sel([{ name: 'A' }, { name: 'A' }], 'R', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete({ direction: 'left-to-right' })
      .violations()
    expect(v.some((x) => /ambiguous/.test(x.message))).toBe(true)
  })

  it('matchBy fallback works when there is no shared key', () => {
    const left = sel([{ name: 'x', n: 1 }], 'L', idName)
    const right = sel([{ name: 'y', m: 1 }], 'R', idName)
    expect(() =>
      correspondence({ left, right, matchBy: (l, r) => l.n === r.m })
        .should()
        .beComplete()
        .check(),
    ).not.toThrow()
  })

  it('preserveRelations flags a relation missing on the counterpart', () => {
    const left = sel([{ name: 'A', deps: ['B'] }], 'L', idName)
    const right = sel([{ name: 'A', imports: [] as string[] }], 'R', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .preserveRelations({ left: (l) => l.deps, right: (r) => r.imports })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/relates to "B"/)
  })

  it('is a TerminalBuilder — because/rule/excluding/warn available', () => {
    const left = sel([{ name: 'Extra' }], 'L', idName)
    const right = sel([], 'R', idName)
    const v = correspondence({ left, right, keyBy: (e: Named) => e.name })
      .should()
      .beComplete()
      .because('diagram must match code')
      .rule({ id: 'crossval/test' })
      .excluding('Extra')
      .violations()
    expect(v).toHaveLength(0) // excluded
  })

  // --- keyBy shapes (plan 0062) ---

  it('keys by each side identify().name when keyBy is omitted', () => {
    const left = sel([{ name: 'A' }, { name: 'Ghost' }], 'L', idName)
    const right = sel([{ name: 'A' }], 'R', idName)
    const v = correspondence({ left, right }) // no keyBy
      .should()
      .beComplete({ direction: 'both' })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.element).toBe('Ghost')
  })

  it('accepts a { left, right } pair — each side keyed by its own type, no union code', () => {
    // Two genuinely different element types with different key shapes.
    interface Row {
      cell: string
    }
    interface Pkg {
      pkgName: string
    }
    const left = sel<Row>([{ cell: 'core' }, { cell: 'md' }], 'row', (r) => ({ name: r.cell }))
    const right = sel<Pkg>([{ pkgName: 'core' }], 'pkg', (p) => ({ name: p.pkgName }))
    const v = correspondence({
      left,
      right,
      keyBy: { left: (r) => r.cell, right: (p) => p.pkgName },
    })
      .should()
      .beComplete({ direction: 'both' })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.element).toBe('md') // in the table, no package
  })

  it('joins on the key even when it differs from the display name', () => {
    // Display "ADR 001" / "ADR 002"; join on the bare number.
    interface Indexed {
      display: string
      num: string
    }
    const left = sel<Indexed>(
      [
        { display: 'ADR 001', num: '001' },
        { display: 'ADR 002', num: '002' },
      ],
      'index row',
      (x) => ({ name: x.display }),
    )
    const right = sel<Indexed>([{ display: 'file 001', num: '001' }], 'file', (x) => ({
      name: x.display,
    }))
    const v = correspondence({
      left,
      right,
      keyBy: { left: (x) => x.num, right: (x) => x.num },
    })
      .should()
      .beComplete({ direction: 'both' })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.element).toBe('ADR 002') // element uses the display name from identify()
  })
})
