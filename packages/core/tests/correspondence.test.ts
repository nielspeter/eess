import { describe, it, expect } from 'vitest'
import { correspondence, type Selection } from '../src/index.js'

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
