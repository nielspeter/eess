import { describe, expect, it } from 'vitest'
import { zeroExaminedViolation } from '../src/vacuity-findings.js'

// Bug 0589, ADR-009 rule 2 and ADR-010 §4: the zero-examined finding fires for several causes, so it
// names each with its own remedy and offers `.expectEmpty()` only for the one it clears.
describe('the zero-examined message names each cause with its remedy (bug 0589)', () => {
  const message = zeroExaminedViolation({
    describeRule: () => ({ rule: 'r', id: 'x/y' }),
    ruleClass: class {},
    reason: undefined,
  }).message

  it('names a dead selector, an empty project, an unread form, an unreached seam and an empty source', () => {
    for (const cause of [
      'a dead selector',
      'an empty project',
      'written in a form this rule does not read',
      'never reaches its own examining seam',
      'legitimately empty',
    ])
      expect(message).toContain(cause)
  })

  it('offers .expectEmpty() only for a legitimately empty source', () => {
    expect(message.match(/\.expectEmpty\(\)/g)).toHaveLength(1)
    expect(message).toMatch(/legitimately empty[^.]*only then declare it with \.expectEmpty\(\)/)
  })
})
