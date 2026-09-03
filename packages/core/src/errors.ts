import type { ArchViolation } from './violation.js'

/**
 * Thrown by `.check()` when architecture violations are found.
 *
 * Integrates naturally with vitest/jest — the test fails with a readable
 * error message listing all violations and their locations.
 */
export class ArchRuleError extends Error {
  readonly #violations: ArchViolation[]

  constructor(violations: ArchViolation[], reason?: string) {
    const summary = `Architecture violation${violations.length === 1 ? '' : 's'} (${String(violations.length)} found)`
    const reasonLine = reason ? ` — ${reason}` : ''
    super(`${summary}${reasonLine}`)
    this.name = 'ArchRuleError'
    this.#violations = violations
  }

  /** The violations that failed the rule, in report order. */
  get violations(): ArchViolation[] {
    return this.#violations
  }
}

/**
 * Is this an `ArchRuleError` — including one thrown by a DIFFERENT copy of this
 * module?
 *
 * `instanceof` is an identity check, and a rule file does not necessarily load
 * through the same module registry as the CLI that loads it. `load-rules.ts`
 * uses jiti (bug 0074: a `.ts` rule file must load inside a `"type": "commonjs"`
 * consumer project), and jiti keeps its own registry — so the `ArchRuleError`
 * a self-executing rule file throws is a different class object from this one
 * and `instanceof` is FALSE for an error that is, in every way that matters,
 * an ArchRuleError.
 *
 * Measured: that made `check.ts` skip `ruleFileTruncated()`, so a rule file
 * whose first rule threw reported the finding and said nothing about the rules
 * after it that never ran — a silent gap in a red run, which is bug 0029
 * reopened by the loader. The same hazard exists for any consumer with two
 * copies of eess-ts on disk (a nested `node_modules`), where the loader is
 * irrelevant.
 *
 * Structural, therefore: the `name` this class stamps in its constructor plus
 * the `violations` array that is its whole reason to exist. Both are part of the
 * documented public shape (`ArchViolation[]` on a thrown error), so matching on
 * them is matching on the contract rather than on a coincidence.
 */
export function isArchRuleError(error: unknown): error is ArchRuleError {
  if (error instanceof ArchRuleError) return true
  return (
    error instanceof Error &&
    error.name === 'ArchRuleError' &&
    'violations' in error &&
    Array.isArray(error.violations)
  )
}

/**
 * Thrown when a RULE is misconfigured — bad arguments to a condition, a
 * malformed rule file — as opposed to {@link ArchRuleError}, which means the
 * architecture under test is wrong.
 *
 * The two are different faults with different audiences and the CLI already
 * wants to tell them apart: `rule-file-findings.ts` branches on
 * `isArchRuleError(error)` and routes everything else into one generic
 * "rule file failed" path. An untyped `Error` therefore arrives with its
 * category erased, and a rule author who mistyped an argument is shown the
 * same surface as an unhandled crash.
 *
 * `subject` names what was misconfigured — the condition, predicate or file —
 * so a caller can render the fault without parsing the message.
 *
 * **Why this class exists at all is worth recording.** eess ships an
 * `agentGuardrails` preset whose `no-generic-errors` rule says a bare `Error`
 * "loses the type/context callers need to handle it". This repo exempted itself
 * from running that preset, on a written rationale that the rule fired on
 * legitimate style. When the preset was finally run here it flagged 17 bare
 * `Error`s, and the rationale did not survive contact: the caller the rule
 * describes is real and lives in this package. Dogfooding produced this type.
 */
export class ArchConfigError extends Error {
  readonly #subject: string

  /**
   * `options` forwards `cause`, and that is not decoration. `schema-loader.ts`
   * distinguishes "the `graphql` package is missing" from "it is installed but
   * failed to load", and the second case is only actionable because the
   * underlying error travels with it — a fix whose own comment records that
   * discarding it "used to be reported as 'not installed' too, discarding the
   * one line that would have told the reader what actually happened". A typed
   * error that dropped the cause would undo that.
   */
  constructor(subject: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ArchConfigError'
    this.#subject = subject
  }

  /** What was misconfigured — a condition name, a predicate name, a file path. */
  get subject(): string {
    return this.#subject
  }
}

/**
 * Is this an `ArchConfigError` — including one thrown by a DIFFERENT copy of
 * this module?
 *
 * Structural for the same reason {@link isArchRuleError} is: jiti and nested
 * `node_modules` both put two copies of this class on disk, and `instanceof`
 * is an identity check. Matches on `name` plus the `subject` accessor that is
 * this class's whole reason to exist.
 */
export function isArchConfigError(error: unknown): error is ArchConfigError {
  if (error instanceof ArchConfigError) return true
  return (
    error instanceof Error &&
    error.name === 'ArchConfigError' &&
    'subject' in error &&
    typeof error.subject === 'string'
  )
}
