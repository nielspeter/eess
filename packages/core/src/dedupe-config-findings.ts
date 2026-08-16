/**
 * One option, one finding.
 *
 * A preset generates rules combinatorially — a single misconfigured option
 * can produce one configuration finding per rule the preset fanned out, same
 * id, same glob, same cause, same remedy. Every one is *true*, which is why
 * exempting them is wrong. But a report shaped like that makes a one-line
 * fix look like a many-line disaster, and it contradicts this project's own
 * rule that findings are **identities, never totals**.
 *
 * So the fan-out collapses to the identity that matches the edit: the option
 * the caller actually wrote. The count survives as *context on that finding*
 * rather than as N rows — which is not the snapshot ADR-008 bars, because it
 * is attached to a named identity rather than standing in for one.
 *
 * ## What the key is, and why each part is in it
 *
 * `(rule file, rule id, offending glob/element)`.
 *
 * - **The element, not the message.** Two different misconfigurations that
 *   both produce the same wording are still two findings, because they are
 *   two edits. Keying on the message would merge them whenever the wording
 *   happened to coincide, and split them whenever it did not.
 * - **The rule id**, so two distinct config faults about the same element
 *   stay distinct: they may have different remedies.
 * - **The rule file.** Two rule files that instantiate the same preset with
 *   the same bad option are two edits in two places, and collapsing them
 *   would hide one. Empty in a test-file context, where every rule shares
 *   one origin, so the key degrades to `(id, element)` there rather than
 *   merging across files that were never distinguished.
 *
 * ## What is deliberately NOT deduplicated
 *
 * Ordinary violations. Each names a distinct element at a distinct position
 * and every one is a separate edit — collapsing them is the snapshot rule
 * ADR-008 bars, and it would hide real work. Only **configuration findings**
 * fan out from a single authored mistake, and `bypassFilters` is exactly the
 * flag that marks one.
 */
import type { ArchViolation } from './violation.js'

/** How the surviving finding states the fan-out it stands for. */
function affectedNote(count: number): string {
  return (
    ` This one option generated ${String(count)} rules that cannot enforce anything; they are ` +
    `not listed separately because they are one edit.`
  )
}

/**
 * Collapse each configuration finding that a preset fanned out.
 *
 * Order-preserving, keeping the **first** occurrence, so the report reads in
 * the order the rules were declared rather than in hash order.
 */
export function dedupeConfigFindings(violations: readonly ArchViolation[]): ArchViolation[] {
  // Count first, then emit. A single pass that appends the note on first
  // sight cannot know the total yet, and appending it on the last sight
  // would reorder the report.
  const counts = new Map<string, number>()
  for (const violation of violations) {
    const key = keyFor(violation)
    if (key === undefined) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const emitted = new Set<string>()
  const result: ArchViolation[] = []
  for (const violation of violations) {
    const key = keyFor(violation)
    if (key === undefined) {
      result.push(violation)
      continue
    }
    if (emitted.has(key)) continue
    emitted.add(key)
    const total = counts.get(key) ?? 1
    if (total === 1) {
      result.push(violation)
      continue
    }
    // The note goes on `message` AND `suggestion`. They are separate fields
    // with separate consumers — the terminal prints `Fix:` from
    // `suggestion`, and `--format json` carries both — and a reader who
    // sees only one of them otherwise learns a different number of
    // affected rules from each.
    result.push({
      ...violation,
      message: violation.message + affectedNote(total),
      suggestion:
        violation.suggestion === undefined ? undefined : violation.suggestion + affectedNote(total),
    })
  }
  return result
}

/**
 * The dedupe key, or `undefined` for a finding that must never be collapsed.
 *
 * `undefined` for anything that is not a configuration finding, and for a
 * configuration finding with no `element` to key on — a missing key must
 * mean "keep it", never "merge everything that lacks one".
 */
function keyFor(violation: ArchViolation): string | undefined {
  if (violation.bypassFilters !== true) return undefined
  const identity = violation.ruleId ?? violation.rule
  // `'unnamed'` is `TerminalBuilder.describeRule()`'s sentinel, not an
  // identity. A family that never overrides it gives every one of its
  // rules the same key, so distinct rules would merge and the survivor
  // would falsely claim they were "one edit". A missing key must mean
  // "keep it", never "merge everything that lacks one" — the same rule the
  // empty-string guard beside this already follows.
  if (identity === '' || identity === 'unnamed') return undefined
  if (violation.element === '' || violation.element === 'unnamed') return undefined
  return `${violation.file} ${identity} ${violation.element}`
}
