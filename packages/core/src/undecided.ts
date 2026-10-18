import type { ConditionContext } from './condition.js'
import { ArchConfigError } from './errors.js'
import type { Predicate, Undecided } from './predicate.js'
import { UNSUPPRESSABLE } from './unsuppressable.js'
import type { ArchViolation } from './violation.js'

/**
 * Whether predicates admit a subject, in three values (ADR-021): decided `true` or `false`, or the
 * causes that leave it undecided.
 */
export type Membership = boolean | readonly Undecided[]

function judge<T>(predicate: Predicate<T>, element: T): Membership {
  const causes = predicate.undecided?.(element) ?? []
  return causes.length > 0 ? causes : predicate.test(element)
}

/**
 * The one truth table, strong Kleene. `all`: false as soon as one input is decided false, otherwise
 * undecided if any input is. `any`: true as soon as one input is decided true, otherwise undecided
 * if any input is. An empty `all` is true and an empty `any` false, as `every` and `some` are.
 * Every combinator in the family and every builder's selection read it, so what a rule selects and
 * what it reports cannot disagree.
 */
export function membership<T>(
  predicates: readonly Predicate<T>[],
  op: 'all' | 'any',
  element: T,
): Membership {
  const causes: Undecided[] = []
  for (const p of predicates) {
    const m = judge(p, element)
    if (m === true || m === false) {
      if (m === (op === 'any')) return m
      continue
    }
    causes.push(...m)
  }
  return causes.length > 0 ? causes : op === 'all'
}

/**
 * The subjects every predicate definitely admits, and the causes of those it cannot decide.
 *
 * When no predicate declares `undecided` this is the two-valued filter it always was, so a rule that
 * never meets an undecided subject pays nothing for the third value.
 */
export function partition<T>(
  elements: readonly T[],
  predicates: readonly Predicate<T>[],
): { readonly elements: T[]; readonly undecided: readonly Undecided[] } {
  if (!predicates.some((p) => p.undecided)) {
    return { elements: elements.filter((e) => predicates.every((p) => p.test(e))), undecided: [] }
  }
  const kept: T[] = []
  const undecided: Undecided[] = []
  for (const e of elements) {
    const m = membership(predicates, 'all', e)
    if (m === true) kept.push(e)
    else if (m !== false) undecided.push(...m)
  }
  return { elements: kept, undecided }
}

const keyOf = (v: { file: string; line: number; message: string }): string =>
  `${v.file}\u0000${String(v.line)}\u0000${v.message}`

/**
 * The causes as findings with the rule's context: one per cause however many subjects share it
 * (ADR-009 rule 4), none already reported by `already`, and each `bypassFilters`, because it is about
 * what the rule's instrument could not read, not about the subject (ADR-021 clause 5).
 */
export function undecidedViolations(
  undecided: readonly Undecided[],
  context: ConditionContext,
  already: readonly ArchViolation[] = [],
): ArchViolation[] {
  const seen = new Set(already.map(keyOf))
  const out: ArchViolation[] = []
  for (const u of undecided) {
    const key = keyOf(u)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      rule: context.rule,
      ...(context.ruleId === undefined ? {} : { ruleId: context.ruleId }),
      element: u.element,
      file: u.file,
      line: u.line,
      message: u.message,
      ...(context.because === undefined ? {} : { because: context.because }),
      // Never the rule's own suggestion: that fixes what the rule asserts, and this finding is about
      // the cause, which the message names.
      suggestion: `Fix the cause the message names, so the rule can judge this subject. ${UNSUPPRESSABLE}`,
      ...(context.docs === undefined ? {} : { docs: context.docs }),
      bypassFilters: true,
    })
  }
  return out
}

/**
 * A door that hands no findings back refuses an undecided subject (ADR-021 clause 6, ADR-014's rule
 * for such doors): an `ArchConfigError` naming the first cause and how many there are.
 */
export interface Door {
  /** What the caller called, as the message names it: `select()`, `test()`. */
  readonly name: string
  /** What to do instead, beside fixing the cause. */
  readonly remedy: string
}

const REPORTING_TERMINALS = "or use the rule's check(), warn() or violations(), which report it"

export function refuseUndecided(undecided: readonly Undecided[], door: string | Door): void {
  const [first] = undecided
  if (first === undefined) return
  const { name, remedy } =
    typeof door === 'string' ? { name: door, remedy: REPORTING_TERMINALS } : door
  const more = undecided.length === 1 ? '' : ` (and ${String(undecided.length - 1)} more)`
  throw new ArchConfigError(
    name,
    `${name} cannot answer: a predicate cannot judge a subject, and ${name} hands back no ` +
      `findings to report it. ${first.element}: ${first.message}${more}. Fix the cause, ${remedy}.`,
  )
}

/**
 * `not`'s `test` for an input that can be undecided: it refuses rather than negating a guess, so a
 * hand-written wrapper around `not(p).test` cannot select a subject `p` could not judge, even when
 * `p`'s own `test` does not refuse.
 */
export function negatedTest<T>(input: Predicate<T>): (element: T) => boolean {
  return (element: T) => {
    refuseUndecided(input.undecided?.(element) ?? [], 'test()')
    return !input.test(element)
  }
}

/** A combinator's `test` and `undecided`, from the one truth table. */
export function kleene<T>(
  predicates: readonly Predicate<T>[],
  op: 'all' | 'any',
): Required<Pick<Predicate<T>, 'test' | 'undecided'>> {
  // The kernel asks `undecided` and then `test` of the same element, at every level of a nested
  // combinator; remembering the last answer keeps a nesting of depth d linear rather than 2^d
  // (measured in PR #243's review: 8 → 424 leaf calls from depth 1 to 6 without it, 6 → 18 with).
  // Sound because a predicate is pure: the same element always gets the same answer. The slot keeps
  // the last element reachable until the next one replaces it, and nothing longer.
  let last: { readonly element: T; readonly m: Membership } | undefined
  const of = (element: T): Membership => {
    if (last?.element !== element) last = { element, m: membership(predicates, op, element) }
    return last.m
  }
  return {
    undecided: (element: T) => {
      const m = of(element)
      return m === true || m === false ? [] : m
    },
    test: (element: T) => {
      const m = of(element)
      if (m === true || m === false) return m
      refuseUndecided(m, 'test()')
      return false
    },
  }
}
