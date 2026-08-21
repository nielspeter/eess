import type { ArchViolation } from '@nielspeter/eess'
import { isArchRuleError } from '@nielspeter/eess'
import { basename } from 'node:path'

/**
 * Attribute findings that have no source location of their own to the rule file
 * they came from.
 *
 * [ts-archunit Bug 0026](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0026-a-location-less-finding-does-not-say-which-rule-file-it-came-from.md):
 * a configuration finding carries `file: ''` because it reports a fault in the
 * rule rather than in the code, so two identical vacuous rules in two rule files
 * rendered as two identical paragraphs with nothing saying which to open. In a
 * test the frame comes free from vitest; in the CLI — the golden-path default —
 * nothing supplied it, even though this loop knows the file and was discarding it.
 *
 * `line: 1`, following `tsconfig()`'s precedent for a fault that belongs to a
 * file rather than to a position in it (`docs/config-rules.md` documents that
 * choice). The builders cannot know the line: a rule with no glob has no
 * position anywhere, and the assertion-gate findings are exactly the rules that
 * may have none. Not `line: 0` — `::error file=x,line=0` is not a valid GitHub
 * annotation and gets dropped or misplaced.
 *
 * **Safe against a `eess-exclude` comment only because these findings carry
 * `bypassFilters`.** `execute-rule.ts` filters comment exclusions with
 * `v.bypassFilters === true || !isExcludedByComment(...)`, and that first clause
 * is what stops a real path here from making the finding suppressible by a
 * comment in the rule file. It was written for this exact temptation, and until
 * this change nothing tested it, because no such finding had a readable path.
 * `tests/helpers/exclusion-comments.test.ts` now pins it.
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
 * [ts-archunit Bug 0025](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0025-a-non-archruleerror-from-one-rule-file-drops-every-other-finding.md):
 * `runCheck` and `runBaseline` caught `ArchRuleError` and rethrew everything
 * else, so any other error escaped the per-file loop and terminated the process
 * — no report written, no exit code returned, and every finding already
 * collected discarded. Measured: one malformed `crossProject()` in one file
 * silenced a second file's four real violations, and printed a raw Node stack
 * trace with `node_modules` paths in their place.
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
 * misplaced (the v0.22.0 defect), and only a `file` of `''` takes the run-level
 * branch that avoids it.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function ruleFileFailure(file: string, error: unknown, ruleFiles: number): ArchViolation {
  const raw = error instanceof Error ? error.message : String(error)
  // An error message may or may not end in punctuation, and the sentence after
  // it ran straight on: "…(reading 'config') The other rule files…". Measured on
  // the real CLI, which is the only place the two strings meet.
  const detail = /[.!?]$/.test(raw.trimEnd()) ? raw.trimEnd() : `${raw.trimEnd()}.`
  const others = ruleFiles > 1 ? ' The other rule files in this run were still checked.' : ''
  return {
    // The path goes in `file` and nowhere else it would be re-rendered. It used
    // to appear four times in one finding — in `rule`, in `element`, in the
    // location line, and in the remedy — and the location line renders it
    // through `path.relative(cwd, …)`, so a rule file outside the cwd printed as
    // `../../../../../../private/tmp/…`. Measured on the real CLI.
    rule: 'eess-ts: rule file',
    element: basename(file),
    file,
    line: 1,
    message: `This rule file could not be evaluated, so its rules enforced nothing in this run: ${detail}${others}`,
    // Conditional, never asserted — this fires for any error a rule file or a
    // builder can raise (a syntax error, a missing dependency, a misconfigured
    // builder), and naming one cause for all of them is the ADR-009 rule 2
    // defect. The error message above is the evidence; the builder sentence is
    // offered as the common case that is fixable without touching source code.
    suggestion: `Fix the error named above in this rule file. If it names a builder method — for example a crossProject() with the wrong number of .side(...) calls — the rule is misconfigured rather than violated, so the fix is in the rule file and not in the code it checks.`,
    bypassFilters: true,
  }
}

/**
 * What to collect when evaluating a rule file, or one rule in it, threw.
 *
 * An `ArchRuleError` already carries findings — those ARE the report, and this
 * is the pre-existing path for a rule file that self-executes a failing
 * `.check()` at import. Anything else becomes one configuration finding naming
 * the file. Never a rethrow: that discarded every finding already collected in
 * the run, including other files' (bug 0025).
 *
 * One definition, imported by both `runCheck` and `runBaseline`. They had a copy
 * each for the ArchRuleError half and the two had already diverged in what they
 * did with everything else.
 */
export function failureOrViolations(
  file: string,
  error: unknown,
  ruleFiles: number,
): ArchViolation[] {
  return isArchRuleError(error) ? error.violations : [ruleFileFailure(file, error, ruleFiles)]
}

/**
 * A rule file stopped evaluating partway, so the rules after that point never ran.
 *
 * [ts-archunit Bug 0029](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0029-a-throwing-warn-truncates-the-rest-of-the-rule-file.md),
 * and the half [ts-archunit plan 0069](https://github.com/nielspeter/ts-archunit/blob/main/plans/completed/0069-no-rule-may-certify-nothing.md)'s R3a
 * specified and did not build: *"R3a states the semantics, and the CLI **reports the
 * truncation rather than absorbing it**."* The semantics shipped in v0.23.0; this is
 * the reporting.
 *
 * In a **self-executing** rule file — the shape `init` scaffolds and `docs/cli.md`
 * documents — every rule calls its own terminal at module scope. A throw there aborts
 * the module, so every rule declared after it is never evaluated. The CLI then folds
 * the thrown finding into the run and the output looks entirely ordinary. Measured on
 * v0.28.0, the same two rules in each style:
 *
 * | rule file shape                  | findings reported |
 * | -------------------------------- | ----------------- |
 * | `export default [rule1, rule2]`  | **5** — the configuration finding and all four violations |
 * | self-executing                   | **1** — the four violations silently absent |
 *
 * Worse than a crash, because the run is **red for the other finding**: someone fixes
 * that, moves on, and never learns the rest of the file was skipped — or takes the
 * sanctioned remedy for a dead glob, which is to delete the rule, and still never
 * learns it.
 *
 * **What this can and cannot say.** The module never finished, so the CLI cannot know
 * *what* was lost — only that anything after the throw did not run. Naming a count or
 * a rule would be invention. It says the file stopped and what to do, which is all it
 * has.
 *
 * `bypassFilters` because it reports missing coverage: nothing to grade, exclude or
 * accept into a baseline.
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

/**
 * `--baseline` was passed, but the rule file printed findings the baseline never
 * filtered. Bug 0199.
 *
 * **The mechanism, corrected after measurement.** The bug was first written up as
 * "the preset throws before baseline filtering runs". That is wrong, and the wrong
 * version is recorded in 0199 because it would have sent the next reader to the
 * wrong layer. `runCheck` DOES collect a thrown terminal's violations off the error
 * (`failureOrViolations`) and DOES filter them — measured, the CLI's own collection
 * came back empty against a matching baseline, exactly as designed.
 *
 * What actually leaks is the **rule file's own printing**. `setCallerAggregatesReports`
 * is module-level state in `core/execute-rule.ts`, and a rule file loads through
 * jiti's separate module registry (see `isArchRuleError` for the same boundary biting
 * `instanceof`). So the rule file gets its own copy of that module with the flag
 * `false`, its terminal writes its own unfiltered report, and only then throws. The
 * user reads violations they have already accepted; the CLI silently agrees they were
 * accepted and says nothing.
 *
 * **Why a notice and not the root-cause fix.** Making the flag cross registries means
 * a `globalThis` singleton — a pattern this codebase does not currently use anywhere,
 * and a cross-cutting decision that belongs in an ADR rather than in a bug fix. Until
 * that is decided, the run must not be silent about output it could not filter. A
 * wrong-looking build that explains itself beats one that does not.
 *
 * **What this can and cannot say.** The leaked lines were written by another module
 * instance, so the CLI cannot know how many there were or which. Naming a count would
 * be invention. It says the output above went unfiltered, why, and the remedy.
 *
 * `bypassFilters` because it reports a gap in filtering — accepting it into a baseline
 * would suppress the notice that the baseline is not being applied.
 */
export function baselineNotApplied(file: string, baselinePath: string): ArchViolation {
  return {
    // NOT `eess-ts: rule file` — `dedupeConfigFindings` keys on
    // `file + rule + element`, so sharing that label merges this into
    // `ruleFileTruncated()` and the notice disappears. Measured: it did.
    rule: 'eess-ts: baseline',
    element: basename(file),
    file,
    line: 1,
    message:
      `This rule file reported findings itself, and \`--baseline\` was NOT applied to ` +
      `them — any violation printed above reached you unfiltered by ` +
      `\`${basename(baselinePath)}\`, so violations you have already accepted can appear ` +
      `here as failures. The rules the CLI collected were filtered normally.`,
    because:
      `A baseline can only suppress findings the CLI collects. A rule file that calls ` +
      `its own terminal at module scope prints them first, so the run you are reading ` +
      `is not the run the baseline describes.`,
    // The remedy is ordered generic-first ON PURPOSE. This finding fires for ANY
    // terminal throwing at module scope — a hand-written `.check()` with no preset
    // in sight reaches it too — so naming the preset fix alone would be the ADR-009
    // rule 2 defect its neighbour `ruleFileFailure` calls out by name.
    suggestion:
      `Move this file's rules into \`export default [rule1, rule2]\` and drop the ` +
      `terminal calls — an array export hands every rule to the CLI, which then owns ` +
      `reporting and applies the baseline to all of it. If the rules come from a ` +
      `preset, pass \`report: 'builders'\` instead — e.g. ` +
      `\`recommended(p, { report: 'builders' })\` — which returns the builders rather ` +
      `than running them. \`eess-ts init\` scaffolds both forms correctly.`,
    bypassFilters: true,
  }
}
