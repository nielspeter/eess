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
