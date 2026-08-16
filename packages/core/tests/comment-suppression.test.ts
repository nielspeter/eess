import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetCommentSuppression,
  recordCommentSuppression,
  commentSuppressions,
  commentSuppressionNotice,
} from '../src/comment-suppression.js'

beforeEach(() => {
  resetCommentSuppression()
})

describe('commentSuppression', () => {
  it('returns undefined when nothing was suppressed', () => {
    expect(commentSuppressionNotice()).toBeUndefined()
    expect(commentSuppressions()).toEqual([])
  })

  it('records and reports a single suppression', () => {
    recordCommentSuppression('arch/no-cycles', 'src/legacy/gateway.ts')
    expect(commentSuppressions()).toEqual([
      { ruleId: 'arch/no-cycles', file: 'src/legacy/gateway.ts' },
    ])
    const notice = commentSuppressionNotice()
    expect(notice).toContain('1 finding')
    expect(notice).toContain('arch/no-cycles in src/legacy/gateway.ts')
  })

  it('deduplicates identical (ruleId, file) pairs into one line with a count', () => {
    recordCommentSuppression('arch/no-cycles', 'a.ts')
    recordCommentSuppression('arch/no-cycles', 'a.ts')
    recordCommentSuppression('arch/no-cycles', 'a.ts')
    const notice = commentSuppressionNotice()
    expect(notice).toContain('3 findings')
    expect(notice).toContain('arch/no-cycles in a.ts (3×)')
    // One line for the identity, not three.
    expect(notice?.split('\n')).toHaveLength(2)
  })

  it('caps the listed identities and discloses the cap rather than truncating silently', () => {
    for (let i = 0; i < 8; i++) {
      recordCommentSuppression(`rule-${String(i)}`, `file-${String(i)}.ts`)
    }
    const notice = commentSuppressionNotice()
    expect(notice).toContain('…and 3 more')
    // 1 header + 5 listed + 1 "and N more" = 7 lines.
    expect(notice?.split('\n')).toHaveLength(7)
  })

  it('reset() clears state for the next run', () => {
    recordCommentSuppression('r', 'f.ts')
    expect(commentSuppressionNotice()).toBeDefined()
    resetCommentSuppression()
    expect(commentSuppressionNotice()).toBeUndefined()
  })

  it('a file-less suppression prints "(no file)" rather than a blank identity', () => {
    recordCommentSuppression('r', '')
    expect(commentSuppressionNotice()).toContain('r in (no file)')
  })
})
