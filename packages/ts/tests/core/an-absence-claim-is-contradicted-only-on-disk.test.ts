/**
 * Bug 0355 — the policy behind `absenceClaimIsContradicted`, pinned exhaustively.
 *
 * A cardinality rule that examined zero reports only when the path it names **holds
 * TypeScript on disk**. That narrowing was stated in four places — `disk-set.ts`'s docstring,
 * `vacuity-diagnosis.ts`'s, both bug records' rulings, and the shipped changeset — and
 * enforced by nothing. Test review sabotaged it three ways (accept `not-determined`, accept
 * `no-typescript`, accept anything but `absent`) and **all three reddened nothing across
 * 3,884 tests**. This file is the falsifier.
 *
 * Why a table over the union rather than a case per fixture: `not-determined` is only
 * reachable by exhausting the walk's 50,000-entry budget, which no fixture can afford to
 * build. The policy is a total function on a four-value union, so enumerating the union tests
 * it completely and costs nothing — and adding a fifth classification stops this compiling
 * rather than silently leaving it uncovered.
 */
import { describe, expect, it } from 'vitest'
import { contradictsAbsence } from '../../src/core/disk-set.js'
import type { OnDisk } from '../../src/core/disk-set.js'

describe('an absence claim is contradicted only by TypeScript on disk', () => {
  it('answers for every classification, and only one of them reports', () => {
    // Written as an exhaustive `Record`, not a list of assertions: a `Record<OnDisk, …>` with
    // a missing key does not compile, so this cannot fall behind the union.
    const expected: Record<OnDisk, boolean> = {
      // The code being asserted away is right there and the rule did not see it.
      'holds-typescript': true,
      // The ratchet holding — the common case, and the one a false positive would destroy.
      absent: false,
      // No TypeScript means no modules, which is what the rule asserts.
      'no-typescript': false,
      // The walk could not answer. Blaming the author for that is the confidently-wrong
      // remedy `disk-set.ts` exists not to give — and it is why bug 0359 exists, because
      // above the entry budget this answer applies to the whole repository at once.
      'not-determined': false,
    }
    const actual = Object.fromEntries(
      (Object.keys(expected) as OnDisk[]).map((k) => [k, contradictsAbsence(k)]),
    )
    expect(actual).toEqual(expected)
  })

  it('exactly one classification contradicts an absence claim', () => {
    // The shape of the policy, independent of which value it is: widening it to two is the
    // sabotage that reddened nothing, and this is the assertion that now catches it.
    const all: OnDisk[] = ['holds-typescript', 'absent', 'no-typescript', 'not-determined']
    expect(all.filter((c) => contradictsAbsence(c))).toEqual(['holds-typescript'])
  })
})
