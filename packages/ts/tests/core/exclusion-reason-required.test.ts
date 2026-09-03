import { describe, it, expect } from 'vitest'
import * as tsParser from '../../src/core/exclusion-comments.js'
import * as kernelParser from '@nielspeter/eess'

/**
 * The two parsers of one grammar, and why they legitimately differ.
 *
 * `@nielspeter/eess` and `@nielspeter/eess-ts` both publish
 * `parseExclusionComments`, from two full implementations. Reviewing ADR-011
 * flagged the divergence as the kernel enforcing bug 0158's "a waiver must state
 * a reason" while the flagship did not — i.e. fail-open in the package that
 * matters most.
 *
 * That reading is wrong, and this test exists so nobody re-derives it. Both fail
 * CLOSED; they choose different mechanisms:
 *
 * - the kernel REFUSES the waiver — no exclusion, a warning, and the violation
 *   it would have hidden comes back;
 * - eess-ts APPLIES it and raises an unsuppressable configuration finding
 *   (`bypassFilters`, forced to `error`) saying the exclusion states no reason.
 *   That is bug 0039's design: keep the author's intent, refuse the silence, and
 *   red the build with a message that explains itself.
 *
 * Neither hides a finding. A change that makes one match the other is a design
 * decision about which mechanism the family wants, not a bug fix — and it would
 * break `exclusion-comments-reach-every-condition.test.ts`, which pins the
 * eess-ts contract deliberately.
 */
describe('reason-free waivers: one parser, one answer (ADR-012)', () => {
  const single = ['// eess-exclude demo/no-eval', 'const x = 1'].join('\n')

  // This block used to pin the two parsers DISAGREEING — the kernel refused the
  // waiver, eess-ts kept it and relied on `execute-rule` to promote the warning.
  // Its own docstring said resolving that "would be a decision about which
  // mechanism the family wants, not a bug fix". ADR-012 made the decision when
  // the parsers were unified: eess-ts's design wins, because it tells the author
  // their waiver needs a reason rather than showing them the violation they were
  // waiving. The other four dialects gained it, and the kernel's `execute-rule`
  // gained the promotion that makes it safe.
  it("the waiver applies, and a promotable warning takes the finding's place", () => {
    const { exclusions, warnings } = kernelParser.parseExclusionComments(single, 'probe.ts')
    expect(exclusions.map((e) => e.ruleId)).toEqual(['demo/no-eval'])
    expect(exclusions[0]?.reason).toBe('')
    expect(warnings.some((w) => w.kind === 'undocumented')).toBe(true)
  })

  it('eess-ts gives the same answer, because it is now the same parser', () => {
    const kernel = kernelParser.parseExclusionComments(single, 'probe.ts')
    const ts = tsParser.parseExclusionComments(single, 'probe.ts')
    expect(ts.exclusions.map((e) => e.ruleId)).toEqual(kernel.exclusions.map((e) => e.ruleId))
    expect(ts.warnings.map((w) => w.kind)).toEqual(kernel.warnings.map((w) => w.kind))
  })

  it('both agree a waiver WITH a reason suppresses', () => {
    const stated = ['// eess-exclude demo/no-eval: interop boundary', 'const x = 1'].join('\n')
    expect(
      kernelParser.parseExclusionComments(stated, 'probe.ts').exclusions.map((e) => e.ruleId),
    ).toEqual(['demo/no-eval'])
    expect(
      tsParser.parseExclusionComments(stated, 'probe.ts').exclusions.map((e) => e.ruleId),
    ).toEqual(['demo/no-eval'])
  })

  it('both keep the bracket, so an enclosing block is not closed early', () => {
    // The kernel regressed exactly here when bug 0158's two halves shipped
    // together: refusing the waiver must not refuse the FRAME.
    const nested = [
      '// eess-exclude-start outer/rule: stated',
      'a',
      '// eess-exclude-start inner/rule',
      'b',
      '// eess-exclude-end',
      'c',
      '// eess-exclude-end',
    ].join('\n')
    for (const [name, parse] of [
      ['kernel', kernelParser.parseExclusionComments],
      ['eess-ts', tsParser.parseExclusionComments],
    ] as const) {
      const { exclusions, warnings } = parse(nested, 'probe.ts')
      expect(exclusions.find((e) => e.ruleId === 'outer/rule')?.endLine, name).toBe(7)
      expect(
        warnings.filter((w) => /without matching start/.test(w.message)),
        name,
      ).toEqual([])
    }
  })
})
