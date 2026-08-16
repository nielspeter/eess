import { basename } from 'node:path'
import type { ArchViolation } from '@nielspeter/eess'
import { ArchRuleError } from '@nielspeter/eess'

/**
 * Attribute findings that have no source location of their own to the rule file
 * they came from.
 *
 * A configuration finding carries `file: ''` because it reports a fault in the
 * rule rather than in the code, so two identical vacuous rules in two rule files
 * render as two identical paragraphs with nothing saying which to open. In a
 * test the frame comes free from vitest; in the CLI — the golden-path default —
 * nothing supplies it, even though the per-file loop knows the file and would
 * otherwise discard it.
 *
 * `line: 1`, following `tsconfig()`'s precedent for a fault that belongs to a
 * file rather than to a position in it (`docs/config-rules.md` documents that
 * choice). The builders cannot know the line: a rule with no glob has no
 * position anywhere, and the assertion-gate findings are exactly the rules that
 * may have none. Not `line: 0` — `::error file=x,line=0` is not a valid GitHub
 * annotation and gets dropped or misplaced.
 *
 * Safe against an `eess-ts-exclude` comment only because these findings carry
 * `bypassFilters` — the comment-exclusion filter checks `v.bypassFilters ===
 * true` first, which is what stops a real path here from making the finding
 * suppressible by a comment in the rule file.
 */
export function attributeToRuleFile(
  violations: readonly ArchViolation[],
  file: string,
): ArchViolation[] {
  return violations.map((v) => (v.file === '' ? { ...v, file, line: 1 } : v))
}

/**
 * A rule file, or one rule in it, that could not be evaluated at all.
 *
 * A non-`ArchRuleError` throw from one rule file used to escape the per-file
 * loop and terminate the process — no report written, no exit code returned,
 * and every finding already collected from other files discarded. One
 * malformed rule file silenced every other file's real violations, and printed
 * a raw Node stack trace with `node_modules` paths in their place.
 *
 * Reported as a **configuration finding** (`bypassFilters`): a rule that could
 * not run enforced nothing, which is not a violation of the rule and is not
 * something to accept into a baseline. Same reasoning as the assertion gate,
 * and it inherits the same treatment — `error` severity whatever the rule
 * asked for, refused by `.excluding()`, skipped by diff and baseline.
 *
 * `line: 1` with the rule file as `file`, following `tsconfig()`'s precedent for
 * a fault that belongs to a file rather than to a position in it. Not `line: 0`:
 * `::error file=x,line=0` is not a valid GitHub annotation and gets dropped or
 * misplaced, and only a `file` of `''` takes the run-level branch that avoids
 * needing a line at all.
 *
 * Not exported — reached only through `failureOrViolations`, its one caller.
 */
function ruleFileFailure(file: string, error: unknown, ruleFiles: number): ArchViolation {
  const raw = error instanceof Error ? error.message : String(error)
  // An error message may or may not end in punctuation, and the sentence after
  // it would otherwise run straight on: "…(reading 'config') The other rule
  // files…" — the only place the two strings meet.
  const detail = /[.!?]$/.test(raw.trimEnd()) ? raw.trimEnd() : `${raw.trimEnd()}.`
  const others = ruleFiles > 1 ? ' The other rule files in this run were still checked.' : ''
  return {
    // The path goes in `file` and nowhere else it would be re-rendered — not in
    // `rule`, `element`, or the remedy, all of which would otherwise repeat it,
    // and the location line renders it through `path.relative(cwd, …)`, so a
    // rule file outside the cwd would print as `../../../../../../private/tmp/…`.
    rule: 'eess-ts: rule file',
    element: basename(file),
    file,
    line: 1,
    message: `This rule file could not be evaluated, so its rules enforced nothing in this run: ${detail}${others}`,
    // Conditional, never asserted — this fires for any error a rule file or a
    // builder can raise (a syntax error, a missing dependency, a misconfigured
    // builder), and naming one cause for all of them would misdirect the fix.
    // The error message above is the evidence; the builder sentence is offered
    // as the common case that is fixable without touching source code.
    suggestion: `Fix the error named above in this rule file. If it names a builder method — for example a correspondence() with the wrong number of .side(...) calls — the rule is misconfigured rather than violated, so the fix is in the rule file and not in the code it checks.`,
    bypassFilters: true,
  }
}

/**
 * What to collect when evaluating a rule file, or one rule in it, threw.
 *
 * An `ArchRuleError` already carries findings — those ARE the report. Anything
 * else becomes one configuration finding naming the file. Never a rethrow: that
 * would discard every finding already collected in the run, including other
 * files'.
 */
export function failureOrViolations(
  file: string,
  error: unknown,
  ruleFiles: number,
): ArchViolation[] {
  return error instanceof ArchRuleError
    ? error.violations
    : [ruleFileFailure(file, error, ruleFiles)]
}

/**
 * A rule file stopped evaluating partway, so the rules after that point never ran.
 *
 * In a **self-executing** rule file — every rule calls its own terminal at
 * module scope — a throw there aborts the module, so every rule declared after
 * it is never evaluated. Folding the thrown finding into the run without this
 * makes the output look entirely ordinary: someone fixes the reported finding,
 * moves on, and never learns the rest of the file was skipped.
 *
 * **What this can and cannot say.** The module never finished, so the CLI
 * cannot know *what* was lost — only that anything after the throw did not
 * run. Naming a count or a rule would be invention.
 *
 * `bypassFilters` because it reports missing coverage: nothing to grade,
 * exclude, or accept into a baseline.
 */
export function ruleFileTruncated(file: string, ruleFiles: number): ArchViolation {
  const others = ruleFiles > 1 ? ' The other rule files in this run were still checked.' : ''
  return {
    rule: 'eess-ts: rule file',
    element: basename(file),
    file,
    line: 1,
    message:
      `This rule file stopped evaluating at the finding above, so any rule declared after ` +
      `that point never ran and its violations are not in this report. Rules that had already ` +
      `run are reported normally.${others}`,
    suggestion:
      `Fix the finding above, then re-run to see the rest of this file. If you would rather the ` +
      `file always evaluate in full, move its rules into \`export default [rule1, rule2]\` — an ` +
      `array export builds every rule before any of them runs, so one finding cannot hide the ` +
      `others.`,
    bypassFilters: true,
  }
}
