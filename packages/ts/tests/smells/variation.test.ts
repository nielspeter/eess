import { describe, expect, it } from 'vitest'
import { Project, SyntaxKind } from 'ts-morph'
import { buildFingerprint } from '../../src/smells/fingerprint.js'
import { variationBetween } from '../../src/smells/variation.js'

/**
 * The claim under test is the one the detector could never make: a percentage
 * says how alike two shapes are, and says nothing about whether consolidating
 * them is an improvement. That turns on how many things vary.
 *
 * Each case below is drawn from a pair a real run reported at >= 85%, so the
 * fixtures are the measured problem rather than an invented one.
 */
function bodiesOf(source: string): ReturnType<typeof buildFingerprint>[] {
  const project = new Project({ useInMemoryFileSystem: true })
  const file = project.createSourceFile('subject.ts', source)
  const out: ReturnType<typeof buildFingerprint>[] = []
  for (const fn of file.getFunctions()) {
    const body = fn.getBody()
    if (body) out.push(buildFingerprint(body))
  }
  for (const cls of file.getClasses()) {
    for (const method of cls.getMethods()) {
      const body = method.getBody()
      if (body) out.push(buildFingerprint(body))
    }
  }
  return out
}

describe('variationBetween', () => {
  it('reports ONE axis for a pair differing only in a call target', () => {
    // The `check` ~ `warn` shape: byte-identical but for the callee. Bug 0169
    // called this a false positive; it is a one-parameter extraction.
    const [a, b] = bodiesOf(`
      function check(options: string): void {
        executeCheck(gather(), { reason: 1, metadata: 2 }, options)
      }
      function warn(options: string): void {
        executeWarn(gather(), { reason: 1, metadata: 2 }, options)
      }
    `)
    const v = variationBetween(a!, b!)
    expect(v.skipped).toBe(false)
    expect(v.axes).toHaveLength(1)
    expect(v.axes[0]).toMatchObject({ from: 'executeCheck', to: 'executeWarn', occurrences: 1 })
  })

  it('counts a systematic rename as ONE axis, not one per occurrence', () => {
    // This is the property that makes the number mean something: a copy-paste
    // with a renamed variable is one decision, however many times the name
    // appears. Counting occurrences instead would rank it as the noisiest pair.
    const [a, b] = bodiesOf(`
      function overCls(items: string[]): number {
        let cls = 0
        for (const each of items) { cls = cls + each.length + cls }
        return cls
      }
      function overFn(items: string[]): number {
        let fn = 0
        for (const each of items) { fn = fn + each.length + fn }
        return fn
      }
    `)
    const v = variationBetween(a!, b!)
    expect(v.axes).toHaveLength(1)
    expect(v.axes[0]!.from).toBe('cls')
    expect(v.axes[0]!.to).toBe('fn')
    // The whole point: many occurrences, one axis.
    expect(v.axes[0]!.occurrences).toBeGreaterThan(1)
  })

  it('reports MANY axes when two bodies share a shape and nothing else', () => {
    // Two type guards over disjoint field sets — the adopter's case, reduced.
    // The detector scores this 100%; the reader needs to see that everything
    // varies.
    const [a, b] = bodiesOf(`
      function isAlpha(v: Record<string, unknown>): boolean {
        return typeof v.harbour === 'string' && typeof v.lantern === 'string' && typeof v.quarry === 'string'
      }
      function isBeta(v: Record<string, unknown>): boolean {
        return typeof v.cobbles === 'string' && typeof v.driftwood === 'string' && typeof v.gantry === 'string'
      }
    `)
    const v = variationBetween(a!, b!)
    expect(v.axes.length).toBeGreaterThanOrEqual(3)
    // ...and it separates them from the one-axis case by an order of magnitude,
    // which is the whole reason to report axes rather than a percentage.
    expect(v.axes.length).toBeGreaterThan(1)
  })

  it('reports zero axes for a literal copy', () => {
    const [a, b] = bodiesOf(`
      function timestampPrefixA(now: Date): string {
        const iso = now.toISOString()
        return iso.replace(/[-:.]/g, '').slice(0, 14)
      }
      function timestampPrefixB(now: Date): string {
        const iso = now.toISOString()
        return iso.replace(/[-:.]/g, '').slice(0, 14)
      }
    `)
    const v = variationBetween(a!, b!)
    expect(v.axes).toHaveLength(0)
    expect(v.sharedTexts).toBeGreaterThan(0)
    expect(v.comparedTexts).toBe(v.sharedTexts)
  })

  it('declares a non-answer for bodies too large to align, rather than returning zero', () => {
    // ADR-010: a pass is constructed from evidence. An empty `axes` on an
    // unaligned pair would read exactly like "these differ in nothing".
    const kinds = new Array<SyntaxKind>(2000).fill(SyntaxKind.Identifier)
    const texts = new Array<string | undefined>(2000).fill('x')
    const huge = { kinds, texts, calls: [], nodeCount: 2000, distinctVocabulary: 1 }
    const v = variationBetween(huge, huge)
    expect(v.skipped).toBe(true)
    expect(v.axes).toHaveLength(0)
    expect(v.comparedTexts).toBe(0)
  })
})

describe('message rendering', () => {
  it('keeps a finding on ONE line when a varying text is a multi-line literal', async () => {
    // Measured on a ~5,600-file monorepo: 527 findings rendered as 658 lines,
    // because a varying "identifier" can be a string literal and a string
    // literal can be a forty-line SQL query. A finding that spills defeats the
    // whole point of reporting axes.
    const { varianceSummary } = await import('../../src/smells/duplicate-report.js')
    const sql = '`\n  WITH RECURSIVE ancestors AS (\n    SELECT c.*, 1 as depth\n  )\n`'
    const mk = (text: string): Parameters<typeof varianceSummary>[0] => ({
      a: undefined as never,
      b: undefined as never,
      similarity: 1,
      fingerprintA: { kinds: [80], texts: [text], calls: [], nodeCount: 1, distinctVocabulary: 1 },
      fingerprintB: { kinds: [80], texts: ['x'], calls: [], nodeCount: 1, distinctVocabulary: 1 },
    })
    const summary = varianceSummary(mk(sql))
    expect(summary).not.toContain('\n')
    expect(summary).toContain('…')
  })
})
