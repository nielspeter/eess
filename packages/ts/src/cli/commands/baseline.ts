import { formatBaselineDelta, generateBaseline } from '../../helpers/baseline.js'
import type { ArchViolation } from '@nielspeter/eess'
import { finishPreset } from '@nielspeter/eess'
import { loadRuleFiles } from '../load-rules.js'
import { attributeToRuleFile, failureOrViolations } from '../rule-file-findings.js'

interface BaselineArgs {
  ruleFiles: string[]
  output: string
}

/**
 * Generate a baseline file from current rule violations.
 *
 * Wraps existing APIs: collectViolations + generateBaseline.
 */
export async function runBaseline(args: BaselineArgs): Promise<number> {
  // Per-file parity with runCheck: a user rule file that self-executes a
  // throwing `.check()` at import surfaces its own violations without discarding
  // the other files' rules. (Presets no longer throw at import — returning form.)
  const violations: ArchViolation[] = []
  const total = args.ruleFiles.length
  for (const file of args.ruleFiles) {
    // Same two boundaries as `runCheck`, for the same reason (bug 0025). Here it
    // matters twice over: a rethrow left NO baseline file at all, so one
    // malformed rule made the whole command unusable rather than producing a
    // partial baseline the user could finish.
    let builders
    try {
      builders = await loadRuleFiles([file])
    } catch (error: unknown) {
      violations.push(...failureOrViolations(file, error, total))
      continue
    }
    for (const builder of builders) {
      try {
        // Same attribution as `runCheck` (bug 0026): the findings this command
        // REFUSES to baseline are printed for the user to fix, and "which rule
        // file" is the first thing they need.
        // **The evidence gate, here too** — plan 0263 Phase 2, added after a
        // product review measured this door minting an artifact from nothing:
        // `eess-ts baseline` over a rule file exporting `{ violations: () => [] }`
        // wrote a baseline and exited 0. A baseline is a persisted verdict, so
        // accepting one from a builder that certified nothing is worse than
        // passing silently.
        //
        // The gate runs per builder, where the rule file is known, exactly as in
        // `runCheck`. Its finding carries `bypassFilters`, so `refused` below
        // catches it: the baseline is still written for what COULD be accepted,
        // the finding is printed with its rule file, and the command exits 1.
        //
        // **`collectViolations` is deliberately untouched, and that is a stated
        // residual.** It is public API (`packages/ts/src/index.ts`), documented
        // as not throwing, and typed to accept `{ violations: () => ArchViolation[] }`
        // — a bare array, by signature. Tightening it would move the break to
        // adopters' compilers without closing the runtime hole for JS callers,
        // and throwing from it would break the contract its own docstring makes.
        // So the gate sits here, at the command that mints the artifact. An
        // adopter calling `collectViolations` + `generateBaseline` by hand still
        // bypasses it; closing that is a public-API decision, not a wiring one.
        violations.push(
          ...attributeToRuleFile(finishPreset(builder.violations(), { report: 'return' }), file),
        )
      } catch (error: unknown) {
        violations.push(...failureOrViolations(file, error, total))
      }
    }
  }

  const delta = generateBaseline(violations, args.output)

  // Report what was actually WRITTEN, not what was collected. Config-level findings
  // are deliberately not baselineable (they report that a rule enforces nothing), so
  // printing the pre-filter count told users they had accepted findings that CI would
  // still fail on, with no hint why.
  const refused = violations.filter((v) => v.bypassFilters === true)

  // The delta first: it is the number the 0.28.0 upgrade recipe depends on, and a
  // reader who stops after one line should have read the one that matters (plan
  // 0071). The count comes from `delta`, not recomputed here: this used to be
  // `violations.length - refused.length`, which is the same number derived a
  // second way, and two derivations of one fact in two files drift. The
  // cross-check lives in the test instead, against the entry count of the file
  // that was actually written.
  process.stdout.write(`${formatBaselineDelta(delta)}\n`)
  process.stdout.write(`Written to: ${args.output}\n`)

  if (refused.length > 0) {
    process.stdout.write(
      `\n${String(refused.length)} finding(s) could NOT be baselined — each reports a rule ` +
        `that currently enforces nothing, so accepting it would hide the gap. Fix these:\n`,
    )
    for (const violation of refused) {
      // The rule file first when there is one. Attributing the finding
      // (bug 0026) is pointless if the command that prints it drops the field:
      // "which rule file" is the first thing the reader needs, and with two
      // files holding the same vacuous rule the description alone is the same
      // sentence twice.
      const where = violation.file === '' ? '' : `${violation.file}: `
      process.stdout.write(`  - ${where}${violation.rule}: ${violation.message}\n`)
    }
  }

  // Non-zero when something could not be baselined, for the same reason
  // `doctor` exits non-zero: an agent reads `exit 0` as "nothing to do", and
  // this command sits on the documented 0.23.0 upgrade path. Exiting 0 here
  // meant `npm run arch:baseline` reported the blocker, succeeded, got
  // committed, and the next `arch` job failed on findings the baseline was
  // supposed to have covered. The file is still written — the findings that
  // COULD be baselined are recorded, so re-running after the fix is cheap.
  return refused.length > 0 ? 1 : 0
}
