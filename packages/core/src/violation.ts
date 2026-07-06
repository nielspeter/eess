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
}
