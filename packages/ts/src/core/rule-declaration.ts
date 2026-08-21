import type {
  Condition,
  DeclaredGlob,
  GlobNode,
  Predicate,
  RuleDescription,
} from '@nielspeter/eess'
import { countDeclaredGlobs, stampGlobs } from '@nielspeter/eess'

/**
 * Where a glob was written, for the message.
 *
 * The predicate's own description already names the API and the glob
 * (`reside in folder matching "**\/src/x/**"`), so the origin is that
 * description unless one predicate declared several globs — in which case the
 * glob is appended to tell them apart.
 */
function describeOrigin(description: string, glob: DeclaredGlob, siteCount: number): string {
  // Keyed on the COUNT, not on whether the description happens to contain the
  // glob. A variadic predicate's description contains every one of its globs
  // (`import from "**/a/**", "**/b/**"`), so a substring test collapsed the
  // one case this exists to separate.
  return siteCount > 1 ? `${description} ("${glob.glob}")` : description
}

/**
 * A rule as DECLARED — what was chained onto the builder, before anything runs.
 *
 * The description, the imperative and the assertion advice are all functions of
 * this and nothing else. Keeping them as methods only meant the class carried
 * them; they read no evaluation state and call nothing back.
 */
export interface DeclaredRule {
  readonly predicates: readonly Predicate<unknown>[]
  readonly conditions: readonly Condition<unknown>[]
  readonly misplaced: readonly string[]
  readonly reachedShould: boolean
  readonly metadata:
    | { id?: string; imperative?: string; suggestion?: string; docs?: string }
    | undefined
  readonly reason: string | undefined
}

/**
 * Advice for predicates that landed after `.should()`.
 *
 * Extracted from {@link assertionAdvice} so that method reads as its three
 * outcomes rather than as one of them. Two remedies live here, and the
 * distinction is the point: with conditions present the rule is not
 * "asserting nothing" — it asserts something over a set the misplaced
 * predicate silently shrank, which is a different fault and a different fix
 * (move it; do NOT add another condition). Telling that author to "add a
 * condition" names a fix that leaves the rule exactly as broken (ADR-008
 * rule 2).
 */
function misplacedPredicateAdvice(declared: DeclaredRule): string {
  const names = declared.misplaced.map((d) => `"${d}"`).join(', ')
  const one = declared.misplaced.length === 1
  const verb = one ? 'is a predicate, which filters' : 'are predicates, which filter'
  const it = one ? 'it' : 'them'
  if (declared.conditions.length > 0) {
    return (
      `this rule's ${names} ${verb} subjects rather than asserting anything about them, ` +
      `and ${one ? 'it comes' : 'they come'} after .should() — so ${it} narrowed the ` +
      "selection this rule's conditions are evaluated over, and if that narrowed it to " +
      `nothing the conditions hold vacuously. Move ${it} before .should(), where the ` +
      'filtering is explicit.'
    )
  }
  return (
    `this rule asserts nothing: ${names} ${verb} subjects rather than asserting ` +
    `anything about them. Move ${it} before .should(), then add a condition.`
  )
}

/**
 * Build the rule description from predicates and conditions.
 */
export function buildRuleDescription(declared: DeclaredRule): string {
  const predicateDesc = declared.predicates.map((p) => p.description).join(' and ')
  const conditionDesc = declared.conditions.map((c) => c.description).join(' and ')
  const parts: string[] = []
  if (predicateDesc) parts.push(`that ${predicateDesc}`)
  if (conditionDesc) parts.push(`should ${conditionDesc}`)
  return parts.join(' ')
}

/**
 * Build an imperative "Do NOT … / MUST …" sentence for AI-agent system
 * prompts (`explain --format agent`). Heuristic FALLBACK — a rule author's
 * `.rule({ imperative })` overrides it.
 */
function buildImperative(declared: DeclaredRule): string {
  // The Do-NOT/MUST transform only reads the polarity of a single condition.
  // For zero or multiple (`and`-joined) conditions, negating the joined string
  // would mis-handle mixed polarity ("not X and not Y"), so fall back to the
  // plain, always-correct rule description.
  const [only] = declared.conditions
  if (declared.conditions.length !== 1 || only === undefined) {
    return buildRuleDescription(declared) || 'Follow the architecture rule.'
  }
  const cond = only.description
  const isNegative = /^(not|no)\b/i.test(cond)
  const body = cond.replace(/^(not|no)\s+/i, '')
  const scope = declared.predicates.map((p) => p.description).join(' and ')
  const scopeSuffix = scope ? ` (in code that ${scope})` : ''
  return `${isNegative ? 'Do NOT' : 'MUST'} ${body}${scopeSuffix}`
}

/** The value behind `RuleBuilder.globs()`. */
export function globsOf(declared: DeclaredRule): readonly GlobNode[] {
  const trees: GlobNode[] = []
  for (const predicate of declared.predicates) {
    if (predicate.globs) {
      const count = countDeclaredGlobs(predicate.globs)
      trees.push(
        stampGlobs(
          predicate.globs,
          'selector',
          (g) =>
            // A preset's `originLabel` names the option the user wrote rather
            // than the calls it expanded into. Used VERBATIM, skipping
            // `describeOrigin`: that appends `("glob")` to disambiguate a
            // predicate holding several sites, and a label already names
            // exactly one option and one glob — left in, the finding read
            // `shared: "**/x/**" ("**/x/**")`.
            predicate.originLabel ?? describeOrigin(predicate.description, g, count),
        ),
      )
    }
  }
  for (const condition of declared.conditions) {
    if (condition.globs) {
      const count = countDeclaredGlobs(condition.globs)
      trees.push(
        stampGlobs(condition.globs, 'condition', (g) =>
          describeOrigin(condition.description, g, count),
        ),
      )
    }
  }
  return trees
}

/** The value behind `RuleBuilder.assertionAdvice()`. */
export function assertionAdviceOf(declared: DeclaredRule): string {
  if (!declared.reachedShould) {
    return (
      'this rule never reached .should(), so it asserts nothing and can never fail. ' +
      'Add .should() and a condition, or delete the rule.'
    )
  }
  if (declared.misplaced.length > 0) return misplacedPredicateAdvice(declared)
  return (
    'this rule reached .should() but no condition follows, so it asserts nothing and can ' +
    'never fail. Add a condition after .should() — or, if this rule is generated from ' +
    'configuration, skip generating it when there is nothing to assert; if it comes from ' +
    'a preset (ruleId "preset/..."), report it to the preset\'s author.'
  )
}

/** The value behind `RuleBuilder.describeRule()`. */
export function describeRuleOf(declared: DeclaredRule): RuleDescription {
  return {
    rule: buildRuleDescription(declared),
    id: declared.metadata?.id,
    because: declared.reason,
    suggestion: declared.metadata?.suggestion,
    docs: declared.metadata?.docs,
    imperative: declared.metadata?.imperative ?? buildImperative(declared),
  }
}
