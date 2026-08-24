import { describe, it, expect } from 'vitest'
import { parseExclusionComments } from '../src/exclusion-comments.js'

/**
 * Bug 0158 — two independent halves of the same grammar.
 *
 * 1. The grammar documents `// eess-exclude <rule-id>: <reason>`. A directive
 *    written WITHOUT the reason suppressed anyway and emitted only a stderr
 *    warning, so the documented requirement was not enforced: a waiver with no
 *    stated justification silenced a real finding and the build exited 0.
 *
 * 2. Nested block directives mangle. An inner `-end` closes the OUTER block, and
 *    an inner `-start` is dropped entirely — two wrong results from one input.
 */
const parse = (lines: string[]) => parseExclusionComments(lines.join('\n'), 'probe.ts')

describe('a waiver must state its reason', () => {
  it('does not suppress when the directive carries no reason', () => {
    const { exclusions } = parse(['// eess-exclude demo/no-eval', 'export const x = 1'])
    expect(exclusions).toHaveLength(0)
  })

  it('reports the reasonless directive rather than passing over it', () => {
    const { warnings } = parse(['// eess-exclude demo/no-eval', 'export const x = 1'])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('still suppresses when a reason is given', () => {
    const { exclusions } = parse(['// eess-exclude demo/no-eval: deliberate', 'export const x = 1'])
    expect(exclusions).toHaveLength(1)
  })
})

describe('nested block directives', () => {
  it('an inner block does not close the outer one', () => {
    const { exclusions } = parse([
      '// eess-exclude-start rule-a: outer',
      'const a = 1',
      '// eess-exclude-start rule-a: inner',
      'const b = 2',
      '// eess-exclude-end',
      'const c = 3',
      '// eess-exclude-end',
    ])
    // The outer block must cover line 7, not stop at the inner -end on line 5.
    const outer = exclusions.find((e) => e.line === 1)
    expect(outer?.endLine).toBe(7)
  })

  it('an inner block with a different rule id is not dropped', () => {
    const { exclusions } = parse([
      '// eess-exclude-start rule-a: outer',
      'const a = 1',
      '// eess-exclude-start rule-b: inner',
      'const b = 2',
      '// eess-exclude-end',
      'const c = 3',
      '// eess-exclude-end',
    ])
    expect(exclusions.map((e) => e.ruleId).sort()).toEqual(['rule-a', 'rule-b'])
  })
})

describe('a reason-free -start still occupies a frame (regression, review of ADR-011 branch)', () => {
  // The reason-required half of bug 0158 returned from `handleBlockStart` BEFORE
  // pushing, so a reason-free `-start` consumed no frame and the next `-end`
  // popped the OUTER block. That is the frame-mangling the nesting half of the
  // same bug was written to remove, reintroduced through the other half — and
  // the two halves shipped together, so nothing caught it.
  //
  // Balanced input, one bad directive in the middle. The outer waiver must still
  // run to ITS end, and a balanced file must not report an unmatched `-end`.
  const src = [
    '// eess-exclude-start rule-a: outer', // 1
    'code', // 2
    '// eess-exclude-start rule-b', // 3  <- no reason: refused, but it is still a frame
    'more', // 4
    '// eess-exclude-end', // 5  <- closes the REFUSED inner block
    'tail', // 6
    '// eess-exclude-end', // 7  <- closes rule-a
  ].join('\n')

  it('the outer block ends at its own -end, not the inner one', () => {
    const { exclusions } = parseExclusionComments(src, 'probe.ts')
    const outer = exclusions.find((e) => e.ruleId === 'rule-a')
    expect(outer?.endLine).toBe(7)
  })

  it('the reason-free block is still refused', () => {
    const { exclusions, warnings } = parseExclusionComments(src, 'probe.ts')
    expect(exclusions.map((e) => e.ruleId)).toEqual(['rule-a'])
    expect(warnings.some((w) => /Undocumented exclusion at probe\.ts:3/.test(w.message))).toBe(true)
  })

  it('a balanced file reports no unmatched -end', () => {
    const { warnings } = parseExclusionComments(src, 'probe.ts')
    expect(warnings.filter((w) => /without matching start/.test(w.message))).toEqual([])
  })
})

describe('a malformed -start occupies a frame and says so (review of ADR-011 branch)', () => {
  // The empty-frame fix reached the reason-free shape and not this one: a bare
  // `// eess-exclude-start` matched the regex not at all, so it pushed no frame
  // and emitted nothing — the enclosing waiver still closed early, and a balanced
  // file still reported an unmatched `-end`. Same two symptoms, a shape further
  // out. Found by review of the fix.
  const src = [
    '// eess-exclude-start rule-a: outer', // 1
    'code', // 2
    '// eess-exclude-start', // 3  <- no ids, no reason
    'more', // 4
    '// eess-exclude-end', // 5
    'tail', // 6
    '// eess-exclude-end', // 7
  ].join('\n')

  it('the outer block still ends at its own -end', () => {
    const { exclusions } = parseExclusionComments(src, 'probe.ts')
    expect(exclusions.find((e) => e.ruleId === 'rule-a')?.endLine).toBe(7)
  })

  it('a balanced file reports no unmatched -end', () => {
    const { warnings } = parseExclusionComments(src, 'probe.ts')
    expect(warnings.filter((w) => /without matching start/.test(w.message))).toEqual([])
  })

  it('the malformed directive is reported, not swallowed', () => {
    const { warnings } = parseExclusionComments(src, 'probe.ts')
    expect(warnings.some((w) => /names no rule id/.test(w.message))).toBe(true)
  })

  it('it suppresses nothing', () => {
    const { exclusions } = parseExclusionComments(src, 'probe.ts')
    expect(exclusions.map((e) => e.ruleId)).toEqual(['rule-a'])
  })
})
