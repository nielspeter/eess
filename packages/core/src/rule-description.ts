import type { RuleMetadata } from './rule-metadata.js'

/**
 * Structured description of a rule, returned by `.describe()`.
 * Used by the `explain` CLI subcommand to dump active rules as JSON.
 */
export interface RuleDescription {
  rule: string
  id?: string
  because?: string
  suggestion?: string
  docs?: string
  /** Imperative "Do NOT … / MUST …" sentence for agent system prompts. */
  imperative?: string
}

/**
 * A rule that can describe itself.
 *
 * `RuleBuilderLike` declares only `violations()` — deliberately, so a caller can
 * pass a plain object — while every builder in `src/` implements `describeRule()`.
 * So reading a rule's id or remedy needs a narrowing, and that narrowing existed
 * in **three** places with two different implementations: `cli/commands/explain.ts`
 * and two test files.
 *
 * One owner, because a duplicated predicate is not a style problem here:
 * [ts-archunit bug 0044](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0044-an-inline-exclusion-comment-has-no-feedback-channel.md)
 * was a measurement error caused by exactly that, and the fix was to delete the
 * duplicate rather than to test both copies.
 *
 * `DiagnosableRule` and `orphanExclusions` are NOT copies of this: they declare
 * `describeRule?` as an optional structural member of their own input type, which
 * is a different mechanism and correct where it is used.
 */
export interface Describable {
  describeRule: () => RuleDescription
}

/**
 * Does this value describe itself?
 *
 * Cast-free, and that is the point: the version in `explain.ts` read
 * `(value as Record<string, unknown>)['describeRule']`, an ADR-005 breach in
 * shipped source with no `eslint-disable` and no interop boundary to justify it.
 * It was also unnecessary — once `value` is narrowed to `object`, `'describeRule'
 * in value` narrows enough for the property access to compile, which is what the
 * two test copies already did.
 */
export function isDescribable(value: unknown): value is Describable {
  if (typeof value !== 'object' || value === null) return false
  if (!('describeRule' in value)) return false
  return typeof value.describeRule === 'function'
}

/**
 * The metadata half of a rule's description — one projection, four callers.
 *
 * `id`, `because`, `suggestion` and `docs` are read off `RuleMetadata` the same
 * way everywhere. `rule` and `imperative` are the two axes that genuinely vary,
 * so they are parameters rather than something this function guesses:
 *
 * - `rule` — the base `TerminalBuilder` says `id ?? 'unnamed'` (a SENTINEL that
 *   `dedupe-config-findings.ts` keys on, not an identity), a `RuleBuilder` says
 *   the assembled `ruleDescriptionOf(...)` sentence, and several `eess-ts`
 *   subclasses override it again on top of `...super.describeRule()`.
 * - `imperativeFallback` — what to say for an agent prompt when the author
 *   declared no `imperative`. `eess-ts`'s `RuleDeclaration` falls back to the
 *   reason and its `describeRuleOf` to a derived Do-NOT/MUST sentence; the
 *   kernel has no fallback, and that is not an oversight this extraction
 *   quietly fixed — `imperative` is read only by `eess-ts`'s
 *   `explain --format agent`, and `eess-mermaid`'s `explain` does not project
 *   the field at all. The kernel has no consumer to be wrong for.
 *
 * The four bodies were otherwise identical, which `no-copy-paste` reported as a
 * 93% cluster.
 */
export function ruleDescriptionFrom(opts: {
  metadata: RuleMetadata | undefined
  reason: string | undefined
  rule: string
  imperativeFallback?: string
}): RuleDescription {
  return {
    rule: opts.rule,
    id: opts.metadata?.id,
    because: opts.reason,
    suggestion: opts.metadata?.suggestion,
    docs: opts.metadata?.docs,
    imperative: opts.metadata?.imperative ?? opts.imperativeFallback,
  }
}

/**
 * A rule's English description, assembled from what it declared.
 *
 * `subject` is the noun the rule opens with when its builder has one — the
 * GraphQL builders say `schema that ... should ...` and
 * `resolvers that ... should ...`; the general builders open with `that`. That
 * one word was the only difference between four copies of this function, which
 * `no-copy-paste` reported as a cluster at 100%.
 *
 * An empty predicate or condition list contributes nothing rather than an empty
 * clause, so a rule that never reached `.should()` reads `that X` and not
 * `that X should ` — the missing half is what `assertionAdvice` then reports.
 *
 * `slice-rule-builder.ts` is deliberately NOT a caller: its description is a
 * different sentence (`slices [a, b] should ...`), not this one with a prefix.
 */
export function ruleDescriptionOf(
  predicates: readonly { description: string }[],
  conditions: readonly { description: string }[],
  subject?: string,
): string {
  const predicateDesc = predicates.map((p) => p.description).join(' and ')
  const conditionDesc = conditions.map((c) => c.description).join(' and ')
  const parts: string[] = subject === undefined ? [] : [subject]
  if (predicateDesc) parts.push(`that ${predicateDesc}`)
  if (conditionDesc) parts.push(`should ${conditionDesc}`)
  return parts.join(' ')
}
