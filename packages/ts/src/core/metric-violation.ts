import type { Node } from 'ts-morph'
import type { ArchViolation } from '@nielspeter/eess'
import { createViolation, enclosingScopeName, getElementName } from './violation.js'

/**
 * A finding whose message states a **measurement** — bug-0012 class.
 *
 * Metric conditions write the measured value into the message:
 *
 *     Big has 10 methods (max: 5) — consider splitting into focused classes
 *
 * A baseline that hashes the message alone identifies a violation by text
 * that includes the measurement, so the identity moves whenever the
 * measurement moves — **in either direction**. Baseline a class at 10
 * methods, delete two, and the finding is reported as new:
 *
 *     10 → 10   green ✓
 *     10 → 12   red   ✓  (worse)
 *     10 → 8    RED   ✗  (better — the defect)
 *     10 → 5    green ✓  (under the threshold)
 *
 * Paying down the debt fails CI, and keeps failing on every incremental step
 * until the class drops under the threshold entirely.
 *
 * ## Why identity alone cannot fix it
 *
 * `ArchViolation.identity` is for messages that state a derived population,
 * and applying it naively here trades one failure for a worse one:
 *
 * | identity contains | improving to 8 | regressing to 12 |
 * | ------------------ | -------------- | ----------------- |
 * | the count           | **red** ✗      | red ✓             |
 * | no count             | green ✓        | **green** ✗       |
 *
 * Dropping the count turns the baseline into a mute button. Identity answers
 * "is this the same finding?", and a metric needs "is it **worse** than what
 * we accepted?" — a comparison, not an equality. So this carries both: a
 * stable identity that finds the entry, and `measured`, which the baseline
 * stores and ratchets against (`Baseline.isKnown` in `@nielspeter/eess`).
 */
export function metricViolation(
  node: Node,
  options: {
    /**
     * What is being measured — `methods`, `lines`, `parameters`, `properties`,
     * `named-exports`. Part of the identity, so one element can carry several
     * metric findings without them colliding.
     */
    metric: string
    /** The measurement now. Compared against the baselined value, not equated. */
    measured: number
    message: string
    /**
     * The element's qualified name, when `getElementName` would under-qualify
     * it.
     *
     * Members need this: `getElementName(member)` returns the bare `save`,
     * while the message already says `UserRepo.save`. Two classes with a
     * `save` method would otherwise be one entry.
     */
    qualifiedName?: string
  },
  context: {
    rule: string
    because?: string
    suggestion?: string
    ruleId?: string
    docs?: string
  },
): ArchViolation {
  const base = createViolation(node, options.message, context)
  return {
    ...base,
    // The qualified name reaches `element` too, not only `identity` —
    // `createViolation` derives it with `getElementName`, which resolves an
    // unnamed node up to its nearest named ancestor, so a finding ABOUT an
    // object-literal function would otherwise be labelled with the ENCLOSING
    // function's name while its own message names it correctly. `element` is
    // what the terminal prints and one of the fields `.excluding()` matches
    // by exact membership, so the disagreement would also make an exclusion
    // written against the printed name silently miss.
    element: options.qualifiedName ?? base.element,
    // File, element and metric — never the value. The value is the thing
    // being ratcheted, so putting it here makes every change a new finding,
    // which is the bug. Leaving the FILE out is the other half: two classes
    // sharing a name in different files must not share one identity, or the
    // baseline's last-write-wins would silently accept whichever ceiling it
    // saw last while the sibling sat at its own, different one.
    identity: `${node.getSourceFile().getFilePath()}::${identityName(node, options.qualifiedName)}::${options.metric}`,
    measured: options.measured,
  }
}

/**
 * The name segment of a metric identity: the subject's own name, **prefixed
 * by the name of whatever encloses it**, so that two subjects sharing a name
 * in one file are still two identities.
 *
 * Neither name alone is sufficient:
 *
 * | shape                              | own name                | enclosing scope | identity segment                 |
 * | ----------------------------------- | ------------------------ | ---------------- | --------------------------------- |
 * | two factories returning `{build}`   | `build`, `build`          | `makeBeta`, `makeGamma` | `makeBeta.build`, …        |
 * | an arrow inside a named function    | `errorResponseBuilder`    | `makeAlpha`      | `makeAlpha.errorResponseBuilder` |
 * | a top-level `function takesFive`    | `takesFive`               | none             | `takesFive` — unchanged           |
 * | a class method via `functions()`    | `Repo.save`               | `Repo`           | `Repo.save` — already carries it  |
 *
 * There is deliberately **no `own === scope` short-circuit**: a nested
 * function whose name equals its enclosing function's (`function save() {
 * return { save: … } }`) is exactly the case that needs the prefix, and
 * equality of strings cannot tell "the scope is me" from "the scope happens
 * to share my name".
 *
 * Known limit, stated rather than papered over: a literal in a **call
 * argument** at module level (`register({ handler: … })`) has no enclosing
 * named declaration, so two of them in one file still share an identity.
 * Nothing stable distinguishes them.
 */
function identityName(node: Node, qualifiedName: string | undefined): string {
  const own = qualifiedName ?? getElementName(node)
  const scope = enclosingScopeName(node)
  if (scope === undefined) return own
  // Already carries it — a class method's `Repo.save` under scope `Repo`.
  if (own.startsWith(`${scope}.`) || own.endsWith(`.${scope}`)) return own
  return `${scope}.${own}`
}
