/**
 * The one sentence that tells a reader a configuration finding has no escape
 * hatch — ADR-010's unsuppressable contract.
 *
 * Stated on the finding rather than inside each remedy so the per-shape
 * advice stays one sentence each and this stays one sentence in one place.
 * Without it, a reader given only the remedy tries `.asSeverity('warn')`,
 * `.excluding()`, the baseline and `--changed` in turn — several CI cycles —
 * because nothing told them those were refused.
 *
 * ## The list is a claim
 *
 * Keep it in sync with what `bypassFilters` actually refuses
 * (`applyFilters`/`Baseline.filterNew`/`DiffFilter.filterToChanged`, all in
 * `packages/core`) — naming a mechanism that does not refuse is as much a
 * defect as refusing by a mechanism this does not name.
 */
export const UNSUPPRESSABLE =
  "This finding cannot be suppressed: not by .warn(), .asSeverity('warn'), " +
  '.excluding(), an inline `// eess-exclude` comment, a baseline, or diff-aware mode.'
