import {
  collectResult,
  type ArchViolation,
  type CollectResult,
  type ConditionContext,
  type Predicate,
  type Undecided,
} from '@nielspeter/eess'
import { membership, undecidedViolations, type Membership } from '@nielspeter/eess/internal'

/**
 * The one helper for what a builder reads but cannot judge (plan 0580, R5): `mentions()` uses it for
 * an unread mention, and `links()` will use it for an unread HTML link. Each builder gives an
 * "as seen" view of its unread item, which throws `UNKNOWN` from every field nobody knows.
 */

/** What reading an unknowable field of an "as seen" view throws. */
class UnknowableField extends Error {
  constructor() {
    super('an unread item has no known value for this field')
    this.name = 'UnknowableField'
  }
}
export const UNKNOWN = new UnknowableField()

/**
 * The unread items the rule must report (ADR-021 rule 4). Each predicate is asked about the item as
 * far as it is known; one that decides it out leaves it out, as false does in strong Kleene logic; one
 * that reads an unknowable field cannot judge it, so it is reported rather than dropped; a predicate
 * that is undecided reports it with its causes. Nothing about a predicate's shape is trusted.
 */
export function reachedUnread<E, U>(
  unread: readonly U[],
  predicates: readonly Predicate<E>[],
  asSeen: (u: U) => E,
): { readonly reached: U[]; readonly undecided: readonly Undecided[] } {
  const reached: U[] = []
  const undecided: Undecided[] = []
  for (const u of unread) {
    const seen = asSeen(u)
    let left = false
    const causes: Undecided[] = []
    for (const p of predicates) {
      let m: Membership
      try {
        m = membership([p], 'all', seen)
      } catch (e) {
        if (e === UNKNOWN) continue
        throw e
      }
      if (m === false) {
        left = true
        break
      }
      if (m !== true) causes.push(...m)
    }
    if (left) continue
    reached.push(u)
    undecided.push(...causes)
  }
  return { reached, undecided }
}

/**
 * The kernel's verdict with the unread findings added. Each reached item counts as undecided on the
 * receipt, so the terminal withholds the generic zero-examined finding and `declaredEmpty` beside them
 * (ADR-021 rule 7; bug 0602): the emptiness is theirs, not declared and not a dead selector.
 */
export function withUnread(
  base: CollectResult,
  findings: readonly ArchViolation[],
  undecided: readonly Undecided[],
  context: ConditionContext,
): CollectResult {
  if (findings.length === 0) return base
  const causes = undecidedViolations(undecided, context, base)
  return collectResult([...base, ...causes, ...findings], {
    examined: base.examined,
    sourceEmpty: base.sourceEmpty,
    declaredEmpty: base.declaredEmpty,
    notRun: base.notRun,
    deadGlob: base.deadGlob,
    undecided: (base.undecided ?? 0) + causes.length + findings.length,
  })
}
