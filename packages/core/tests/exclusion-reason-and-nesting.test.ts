import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, it, expect } from 'vitest'
import { parseExclusionComments } from '../src/exclusion-comments.js'
import { applyFilters } from '../src/internal.js'
import type { ArchViolation } from '../src/violation.js'

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
  // Until ADR-012 this asserted `toHaveLength(0)` — the kernel REFUSED a
  // reason-free waiver, so the author saw the violation they were waiving and a
  // line on stderr about their directive. `eess-ts` had always done the
  // opposite (bug 0039) and it is the better design: apply the waiver, and let
  // `execute-rule` replace the suppressed finding with an unsuppressable one
  // naming the real fault. Unifying the two parsers made that the family's
  // single answer, so the kernel adopted it and the other four dialects gained
  // it. Both ways end red; this way tells the author what to fix.
  it('applies the waiver, so execute-rule can replace the finding it hid', () => {
    const { exclusions } = parse(['// eess-exclude demo/no-eval', 'export const x = 1'])
    expect(exclusions).toHaveLength(1)
    expect(exclusions[0]?.reason).toBe('')
  })

  it('marks it undocumented, which is what makes the promotion possible', () => {
    const { warnings } = parse(['// eess-exclude demo/no-eval', 'export const x = 1'])
    expect(warnings.some((w) => w.kind === 'undocumented')).toBe(true)
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
    '// eess-exclude-start rule-b', // 3  <- no reason: applies, and is promotable
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

  // Was `toEqual(['rule-a'])` — the reason-free inner block was refused outright.
  // ADR-012 unified the two parsers on eess-ts's answer: the waiver applies and
  // `execute-rule` promotes the `undocumented` warning into an unsuppressable
  // finding. What this test was really pinning — that a reason-free `-start`
  // still occupies its own frame, so the inner `-end` cannot close the OUTER
  // block (bug 0158's nesting half) — is unchanged and asserted above.
  it('the reason-free block applies and is reported as undocumented', () => {
    const { exclusions, warnings } = parseExclusionComments(src, 'probe.ts')
    expect(exclusions.map((e) => e.ruleId).sort()).toEqual(['rule-a', 'rule-b'])
    expect(warnings.some((w) => /Undocumented exclusion at probe\.ts:3/.test(w.message))).toBe(true)
    expect(warnings.some((w) => w.kind === 'undocumented')).toBe(true)
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

/**
 * Bug 0238 — the half that keeps ADR-012 fail-closed, asserted in the kernel.
 *
 * ADR-012 changed a reason-free waiver from REFUSED to applied-then-promoted:
 * the exemption takes effect, and `applyFilters` puts an unsuppressable finding
 * in the suppressed violation's place. Step one suppresses; step two is the only
 * thing that keeps the build honest.
 *
 * Everything above this line tests the parser — that the waiver applies and that
 * a warning is produced. That is step ONE, the fail-open half. Until this block,
 * no kernel test drove `applyFilters` with a reason-free directive at all, so
 * deleting the promotion left the whole kernel suite green while `eess-md`,
 * `eess-mermaid`, `eess-gherkin` and `eess-crossvalidate` — none of which fork
 * the filter — silently suppressed real findings at exit 0. `eess-ts` has its own
 * copy of this test against its own fork; that is why ADR-012's row could look
 * gated while the four dialects it exists for were uncovered.
 */
describe('a reason-free waiver becomes an unsuppressable finding (kernel)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0238-'))
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const RULE_ID = 'probe/no-eval'

  /** Write a source file and return the violation a rule would have produced in it. */
  const suppressed = (name: string, lines: string[]): ArchViolation => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, lines.join('\n'))
    return {
      rule: 'no eval',
      ruleId: RULE_ID,
      element: 'x',
      file,
      line: 2,
      message: 'eval is forbidden',
    }
  }

  const run = (v: ArchViolation): ArchViolation[] =>
    applyFilters([v], { metadata: { id: RULE_ID } })

  it('applies the exemption and puts a configuration finding in its place', () => {
    const out = run(suppressed('undocumented.ts', ['// eess-exclude probe/no-eval', 'const x = 1']))

    // The exemption applied — the original finding is gone.
    expect(out.filter((v) => v.bypassFilters !== true)).toHaveLength(0)

    // …and exactly one unsuppressable finding took its place. Asserted by
    // identity and severity, not by count alone: a promotion that produced the
    // wrong rule id, or a warn-severity one, would satisfy a bare length check
    // while failing to fail the build.
    const config = out.filter((v) => v.bypassFilters === true)
    expect(config).toHaveLength(1)
    expect(config[0]?.ruleId).toBe(RULE_ID)
    expect(config[0]?.severity).toBe('error')
    expect(config[0]?.message).toContain('states no reason')
    expect(config[0]?.file).toContain('undocumented.ts')
    // ADR-009 rule 3: it says there is no escape hatch.
    expect(config[0]?.suggestion).toContain('cannot be suppressed')
    // ADR-009 rule 2, honestly: it does not claim to prevent anything.
    expect(config[0]?.suggestion).toContain('raises the cost')
  })

  it('the remedy remediates: a reason clears the finding and keeps the exemption', () => {
    // Rule 2's behavioural corollary. Applying the stated fix must clear the
    // finding WITHOUT resurrecting the violation — otherwise "add a reason"
    // trades one failure for another.
    const out = run(
      suppressed('documented.ts', [
        '// eess-exclude probe/no-eval: deliberate, see 0238',
        'const x = 1',
      ]),
    )

    expect(out).toHaveLength(0)
  })

  it('CONTROL — an unwaived violation survives, so the two cases above are not vacuous', () => {
    // Without this, a filter that dropped everything would satisfy both tests
    // above: the first sees no plain violation, the second sees nothing at all.
    const out = run(suppressed('unwaived.ts', ['// nothing here', 'const x = 1']))

    expect(out).toHaveLength(1)
    expect(out[0]?.bypassFilters).toBeUndefined()
    expect(out[0]?.message).toBe('eval is forbidden')
  })
})
