import { describe, expect, it } from 'vitest'
import { parseExclusionComments } from '../src/exclusion-comments.js'

/**
 * ADR-012's safety property, which is the whole reason the injection point is
 * safe to have at all.
 *
 * A dialect supplies a masker so the parser can be ACCURATE about its language.
 * It must not be able to supply one that makes the parser accept a directive the
 * kernel's own default would have refused — that direction is bug 0154, where a
 * directive written inside a string literal silently waives a real finding.
 *
 * The mechanism is composition: the kernel runs its own default over whatever
 * the injected masker returns, so an injected masker can only blank MORE. These
 * tests fail if that composition is removed.
 */
describe('an injected masker cannot widen what the parser accepts (ADR-012)', () => {
  // The directive is inside a string literal. It is data, not an instruction.
  const insideAString = [
    'const help = "write // eess-exclude demo/no-eval: because reasons"',
    'export const danger = 1',
  ].join('\n')

  it('the default refuses a directive inside a string literal', () => {
    const { exclusions } = parseExclusionComments(insideAString, 'probe.ts')
    expect(exclusions).toEqual([])
  })

  it('a masker that blanks NOTHING still cannot get that directive honoured', () => {
    // The most permissive masker possible — the identity function. If the kernel
    // REPLACED its default with this instead of composing, the string's contents
    // would reach the line scan and the directive would be honoured.
    const { exclusions } = parseExclusionComments(insideAString, 'probe.ts', {
      mask: (text) => text,
    })
    expect(exclusions).toEqual([])
  })

  it('a masker that blanks everything hides directives rather than inventing them', () => {
    // The opposite extreme. Over-masking is the SAFE failure: a waiver stops
    // applying, which is loud, rather than one appearing, which is silent.
    const real = ['// eess-exclude demo/no-eval: stated', 'export const x = 1'].join('\n')
    const withoutMask = parseExclusionComments(real, 'probe.ts')
    expect(withoutMask.exclusions).toHaveLength(1)

    const blanked = parseExclusionComments(real, 'probe.ts', {
      mask: (text) => text.replace(/[^\n]/g, ' '),
    })
    expect(blanked.exclusions).toEqual([])
  })

  it('an injected masker still lets a legitimate directive through', () => {
    // Non-vacuity: the two refusals above would also pass if injection broke the
    // parser entirely. This is the direction that proves it still works.
    const real = ['// eess-exclude demo/no-eval: stated', 'export const x = 1'].join('\n')
    const { exclusions } = parseExclusionComments(real, 'probe.ts', { mask: (text) => text })
    expect(exclusions.map((e) => e.ruleId)).toEqual(['demo/no-eval'])
  })
})
