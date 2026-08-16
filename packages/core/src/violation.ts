/**
 * A single architecture rule violation.
 *
 * Represents one element that failed to satisfy a condition. This is the
 * kernel's central data type — dialect-independent. Each dialect provides its
 * own adapter that builds an `ArchViolation` from that dialect's element type
 * (e.g. the TS dialect builds one from a ts-morph `Node`).
 */
/**
 * A deterministic, unique text edit that repairs a violation (plan 0066). Emitted
 * by a condition ONLY when the fix is provably unambiguous (e.g. a broken link
 * whose target resolves to exactly one file); ambiguous or judgment cases carry
 * no fix and are reported instead. `applyFixes` writes these.
 */
export interface ArchFix {
  /** Absolute path of the file to edit. */
  file: string
  /** 0-based character offset of the start of the span to replace. */
  start: number
  /** 0-based character offset of the end of the span (exclusive). */
  end: number
  /** Replacement text for `[start, end)`. */
  replacement: string
  /** One-line human description, e.g. 'rewrite link → work/plans/completed/0009.md'. */
  describe: string
}

export interface ArchViolation {
  /** Human-readable rule description (from the fluent chain) */
  rule: string
  /** Unique rule identifier from .rule({ id }) */
  ruleId?: string
  /** Element identifier, e.g. "OrderService.getTotal()" or "parseConfig" */
  element: string
  /** Absolute file path where the violation occurs */
  file: string
  /** Line number where the violating element starts */
  line: number
  /** Human-readable description of what went wrong */
  message: string
  /** Optional rationale provided via .because() */
  because?: string
  /** Source code snippet around the violation line */
  codeFrame?: string
  /** Actionable suggestion for fixing the violation (e.g. "Replace parseInt() with this.extractCount()") */
  suggestion?: string
  /** Link to documentation — ADR, wiki, style guide */
  docs?: string
  /** A deterministic, unique text edit that repairs this violation (plan 0066). */
  fix?: ArchFix
  /**
   * ADR-010 — a configuration finding (the rule's own instrument is broken:
   * zero examined units, an expired `.expectEmpty()` declaration) rather than
   * an ordinary architectural finding. Unsuppressable: `.excluding()` and
   * inline exclusion comments never match it, because the thing it reports is
   * that the rule examined nothing, not that something is wrong with what it
   * examined — an exclusion aimed at the latter cannot correctly apply to the
   * former.
   */
  bypassFilters?: boolean
  /**
   * Stable identity for baseline matching, when the rendered message is not a
   * safe key on its own — most concretely, a message built from a line number.
   * Two matches in the same declaration report at different lines, and adding
   * a line above the second shifts its number without changing what it is;
   * hashing the message alone would then match the WRONG prior baseline entry
   * (accepting a genuinely new violation as already-known) rather than merely
   * missing one. Set this to a canonical, position-independent form and the
   * baseline survives edits above the match. Two distinct violations sharing
   * one identity are one entry — set it only when that's the intended effect.
   */
  identity?: string
  /**
   * A finding whose message states a measurement (e.g. "has 10 methods, max
   * 5"), so a baseline hashing the message alone would treat every change in
   * the count — including an improvement — as a brand-new violation: fixing
   * three of ten methods still fails CI, right up until the count crosses the
   * threshold. `identity` (a stable key naming *what* is measured, without
   * the number) answers "is this the same finding?"; `measured` answers "is
   * it worse than what a baseline already accepted?" — a comparison, not an
   * equality, so a baseline can compare the two and decide accordingly.
   */
  measured?: number
}

/**
 * Unicode codepoint order — the only comparator admissible anywhere a baseline
 * identity, an `element`, or a reported location is derived from a sort.
 *
 * `String.prototype.localeCompare` without an explicit locale reads the
 * **host** locale from `LANG`/`LC_ALL`, so a value sorted with it differs
 * between a developer's machine and CI. Measured on plain ASCII:
 * `['zebra','aardvark']` sorts to `aardvark,zebra` under `en-US` and to
 * `zebra,aardvark` under `da-DK`, because Danish collates `aa` as `å`, after
 * `z`. One finding, two baseline hashes, diverging only in the place hardest
 * to debug.
 */
export function byCodepoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The effective severity for one violation, given the caller's requested
 * fallback — `bypassFilters` outranks every token.
 *
 * A `bypassFilters: true` finding's own `UNSUPPRESSABLE` text promises "not
 * by .warn()", but before this nothing enforced that promise for it: `.warn()`
 * never throws (by design, for ordinary findings), and a preset's per-rule
 * `overrides: { id: 'warn' }` drops a rule's violations from the aggregated
 * throw entirely. Both paths silently swallowed a config-level finding whose
 * whole point is that it cannot be silenced — reproduced live during plan
 * 0147's reconciliation: `.warn()` on a rule examining zero elements printed
 * the "examined zero units" finding to stderr and exited 0.
 *
 * Applied at every severity-stamping site (`execute-rule.ts`'s `executeWarn`,
 * `preset-dispatch.ts`'s `dispatchRule`) so a `bypassFilters` finding stays
 * unsuppressable everywhere a caller can otherwise choose "don't fail the
 * build" — not just at `.check()`, which was never in question.
 */
export function severityFor(
  violation: ArchViolation,
  fallback: 'error' | 'warn',
): 'error' | 'warn' {
  return violation.bypassFilters === true ? 'error' : fallback
}

/**
 * True when a violation's remedy **is** its message, so a renderer that
 * already shows the message must not append a `Fix:` line repeating it.
 *
 * Every `bypassFilters` config finding (`zeroExaminedViolation`,
 * `presetConstructsNothingViolation`, and this session's own
 * `emptyLayerFinding`/`unusableLayersFinding`) sets `suggestion` to exactly
 * its own `message` — there is no author-supplied remedy to fall back to for
 * a finding about the rule's own instrument, so the fault and its remedy are
 * one sentence, deliberately duplicated onto both fields (the JSON payload
 * reads `suggestion` as a separate structured field; a human reading the
 * terminal output does not need the same paragraph twice). Measured before
 * this: every terminal-format producer printed it as both `What:` and `Fix:`.
 *
 * One definition, so the renderers that consult it cannot disagree about it.
 */
export function remedyRepeatsMessage(violation: ArchViolation): boolean {
  return violation.suggestion !== undefined && violation.suggestion === violation.message
}
