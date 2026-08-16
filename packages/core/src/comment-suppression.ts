/**
 * What inline exclusion comments suppressed, said out loud.
 *
 * Every other filter in the pipeline discloses itself: `.excluding()` warns
 * on a pattern that matched nothing (`execute-rule.ts`), diff-aware mode has
 * `diff-disclosure.ts`, the edge-coverage allowlist family has
 * `edgeCoverageNotice`. The inline comment filter drops violations and
 * returns no count — the widest filter in the pipeline (it applies to every
 * condition family with a rule id) and the only silent one.
 *
 * *A run with every finding suppressed is indistinguishable from a clean
 * run.* That is the false green ADR-008/ADR-010 exist to prevent, and it is
 * worse here than for `--changed`, because a comment is written once and
 * then read by nobody. A CLI flag at least appears in the invocation.
 *
 * ## Identities, not a total
 *
 * The notice names **which rule in which file**, not just how many. A count
 * is a snapshot: it moves when anything moves and tells the reader nothing
 * about what to look at. `arch/no-cycles in src/legacy/gateway.ts` is an
 * identity — it survives a renumbering and it is greppable.
 *
 * Capped, and the cap is disclosed rather than silent: a suite with hundreds
 * of exemptions should not print hundreds of lines on every green run, but
 * "and 47 more" is a very different statement from printing 3 and implying
 * that is all of them.
 *
 * ## Why module state
 *
 * `applyFilters` runs once per rule and has no view of the run. This is the
 * same shape `edge-coverage.ts` uses for the same reason: accumulate per
 * rule, reset at the run boundary, render once. An aggregating CLI surface
 * (`cli/commands/check.ts`) resets at the top and reads a notice at the end,
 * the same pattern already established for edge-coverage.
 *
 * A per-rule terminal (`.check()`/`.warn()` on a single rule) has no run
 * boundary, so it does not render this. Same honest limitation
 * `diff-disclosure.ts` documents and for the same reason: a per-rule count
 * presented as a run total would be wrong.
 */

/** One suppression, by identity. */
interface Suppression {
  readonly ruleId: string
  readonly file: string
}

let suppressions: Suppression[] = []

/** How many identities the notice lists before summarising the remainder. */
const LISTED = 5

/** Start a run. An aggregating surface calls this before evaluating. */
export function resetCommentSuppression(): void {
  suppressions = []
}

/** Record that a comment suppressed a finding. Called from `applyFilters`. */
export function recordCommentSuppression(ruleId: string, file: string): void {
  suppressions.push({ ruleId, file })
}

/** Every suppression recorded this run. */
export function commentSuppressions(): readonly { ruleId: string; file: string }[] {
  return suppressions
}

/**
 * One or more lines naming what inline comments suppressed, or `undefined`
 * when nothing was.
 *
 * `undefined` rather than `''` so a caller cannot print a blank line by
 * forgetting to check — the call site feeds this straight to `writeStderr`.
 */
export function commentSuppressionNotice(): string | undefined {
  if (suppressions.length === 0) return undefined

  const total = suppressions.length
  const findings = total === 1 ? 'finding' : 'findings'
  const head =
    `[eess] ${String(total)} ${findings} suppressed by inline ` +
    `// eess-exclude comments. They are exemptions, not passes:`

  // Deduplicate by identity so one rule silenced ten times in one file reads
  // as one line with a count, rather than ten lines that look like ten
  // problems.
  const byIdentity = new Map<string, number>()
  for (const s of suppressions) {
    const key = `${s.ruleId} in ${s.file === '' ? '(no file)' : s.file}`
    byIdentity.set(key, (byIdentity.get(key) ?? 0) + 1)
  }

  const entries = [...byIdentity.entries()]
  const shown = entries.slice(0, LISTED)
  const lines = shown.map(([key, n]) => `  - ${key}${n > 1 ? ` (${String(n)}×)` : ''}`)
  // The cap is stated. A silent truncation reads as "that is all of them",
  // which is the same lie as no disclosure at all.
  if (entries.length > LISTED) {
    lines.push(`  - …and ${String(entries.length - LISTED)} more`)
  }
  return [head, ...lines].join('\n')
}
