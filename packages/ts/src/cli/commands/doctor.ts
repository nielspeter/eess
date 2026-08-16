import { writeStderr, ArchRuleError } from '@nielspeter/eess'
import type { DiagnosableRule, DiagnosticFinding } from '../../core/diagnose.js'
import { diagnose } from '../../core/diagnose.js'
import { loadRuleFiles } from '../load-rules.js'

// eess-exclude eess/no-unused-exports: parameter type of the exported runDoctor API (must stay exported for declaration emit)
export interface DoctorArgs {
  ruleFiles: string[]
  format: 'terminal' | 'json'
}

/**
 * Report what each rule cannot enforce, without evaluating any condition.
 *
 * The CLI-facing half of plan 0147 Phase 4's dead-glob-diagnosis port — the
 * in-process half is `diagnose()` itself, callable from a rule file's own
 * vitest suite. This command diagnoses rule files the CLI can **load**: the
 * `arch.rules.ts` shape `init` scaffolds. A rule hosted in a vitest/jest
 * file cannot be imported outside its runner; `diagnose()` is the answer
 * there, and reports the same findings.
 *
 * **Why this earns its own command, distinct from `check`:** a dead glob. A
 * rule whose selector can never match certifies nothing, and `check` never
 * calls `diagnose()` on a rule that is currently passing (vacuously) — `doctor`
 * and `diagnose()` are the only surfaces that see it before it's exercised by
 * a real regression. Once a rule with a dead glob DOES fail (examines zero
 * elements), Phase 4 Batch 2's `RuleBuilder.deadGlobDiagnosis()` already
 * reports the same fault at `.check()` time — this command is for catching
 * it before that failure, not instead of it.
 *
 * Not a build gate: `check` is the gate. This command's own exit code
 * reflects what it found, but nothing wires it into CI by default.
 *
 * See `diagnose()`'s own docstring for this port's scope: two of ts-archunit's
 * seven finding kinds (`dead-glob`, `project-empty`), the two eess's kernel has
 * the machinery for today.
 */
export async function runDoctor(args: DoctorArgs): Promise<number> {
  if (args.ruleFiles.length === 0) {
    writeStderr('Error: no rule files. Pass them as arguments or set `rules` in your config.\n')
    return 1
  }

  // Per file, not one flat array — this loop is the only place that knows
  // which file a rule came from, and `diagnose()`'s own findings carry no
  // file identity on their own.
  const findings: DiagnosticFinding[] = []
  const rules: DiagnosableRule[] = []
  const loadFailures: { file: string; error: string }[] = []
  for (const file of args.ruleFiles) {
    try {
      const loaded = await loadRuleFiles([file])
      rules.push(...loaded)
      findings.push(...diagnose(loaded).map((f) => ({ ...f, ruleFile: file })))
    } catch (error: unknown) {
      // A rule file that self-executes a throwing `.check()` at import is a
      // documented shape (`runCheck` already tolerates it — see
      // `rule-file-findings.ts`). Without this, `doctor` crashes on the
      // commonest legacy rule-file shape and abandons every remaining file —
      // exactly the silent, incomplete report this command exists to avoid.
      if (error instanceof ArchRuleError) {
        writeStderr(
          `Error: ${file} executes its rules at import and threw, so none of it could be ` +
            `diagnosed. Leave builders un-terminated in a rule file used with doctor/diagnose.\n`,
        )
      } else {
        // The remedy is CONDITIONAL — this branch fires for any load
        // failure (a syntax error, a missing dependency too), so asserting
        // "this imports a test runner" unconditionally would be a false
        // cause. The error message is the evidence; the test-runner
        // sentence is offered as the common case, not stated as the cause.
        writeStderr(
          `Error: ${file} could not be loaded (${error instanceof Error ? error.message : String(error)}), ` +
            `so none of it could be diagnosed. If this file imports a test runner (vitest/jest), ` +
            `doctor cannot load it — call diagnose() from inside that suite instead.\n`,
        )
      }
      loadFailures.push({ file, error: error instanceof Error ? error.message : String(error) })
    }
  }

  // A load failure is a REPORT, and this command's contract is "exits
  // non-zero when it reports anything" — a mixed run (one broken file, one
  // clean file, zero findings) must not print the error and then exit 0
  // with a clean bill of health.
  const emitJson = (findings: DiagnosticFinding[]): void => {
    if (args.format === 'json') {
      process.stdout.write(JSON.stringify({ findings, loadFailures }, null, 2) + '\n')
    }
  }

  if (loadFailures.length > 0 && rules.length === 0) {
    emitJson([])
    return 1
  }

  // Nothing to diagnose is not the same as nothing wrong — a file exporting
  // `[]` must not read as a clean bill of health.
  if (rules.length === 0) {
    writeStderr('Error: no rules found in the given files.\n')
    emitJson([])
    return 1
  }

  if (args.format === 'json') {
    emitJson(findings)
    return findings.length > 0 || loadFailures.length > 0 ? 1 : 0
  }

  if (findings.length === 0) {
    if (loadFailures.length > 0) {
      writeStderr(
        'No findings in the rules that loaded — but at least one file could not be ' +
          'loaded (see above), so this is not a clean bill of health.\n',
      )
      return 1
    }
    writeStderr('No rules that cannot enforce anything.\n')
    return 0
  }

  writeStderr(format(findings))
  return 1
}

/**
 * Which kinds carry a glob, and therefore render with origin/position/fault.
 *
 * A `Record` over the union rather than an if/else, so adding a kind fails
 * `tsc` until someone decides how it renders (the same device
 * `glob-diagnosis.ts`'s `FAULT_ADVICE`/`ON_DISK_ADVICE` use).
 */
const HAS_GLOB: Readonly<Record<DiagnosticFinding['kind'], boolean>> = {
  'dead-glob': true,
  // No glob: the fault is the project itself loading nothing, not any one
  // selector.
  'project-empty': false,
}

function format(findings: readonly DiagnosticFinding[]): string {
  const lines: string[] = ['']
  for (const finding of findings) {
    // The rule file first — with two identical vacuous rules in two files,
    // the rule's own description alone says the same sentence twice and
    // does not say which to open.
    lines.push(finding.ruleFile === undefined ? `  ${finding.rule}` : `  ${finding.ruleFile}`)
    if (finding.ruleFile !== undefined) lines.push(`    ${finding.rule}`)
    if (HAS_GLOB[finding.kind]) {
      lines.push(
        `    ${finding.origin ?? finding.glob ?? '(unknown)'}  [${finding.position ?? 'unknown'}]`,
        `    ${finding.fault ?? 'unknown'}: ${finding.advice}`,
      )
    } else {
      lines.push(`    ${finding.kind}: ${finding.advice}`)
    }
    lines.push('')
  }
  // Deliberately no total — a count is the snapshot ADR-008 rule 4 bars, and
  // it's the number people ratchet against instead of fixing the findings.
  return lines.join('\n')
}
