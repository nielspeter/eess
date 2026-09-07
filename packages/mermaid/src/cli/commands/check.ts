import { collectResult, detectFormat, finishPreset, reportViolations } from '@nielspeter/eess'
import type { ArchViolation, CheckOptions, OutputFormat } from '@nielspeter/eess'
import { loadRuleFiles, type LoadOptions, type RuleBuilderLike } from '../load-rules.js'

export interface CheckArgs {
  ruleFiles: string[]
  format: OutputFormat | 'auto'
  fresh?: boolean
}

function isArchRuleError(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  // Duck-type: ArchRuleError class identity is unreliable across jiti boundaries
  // because the rule file may load its own copy of the kernel. Match by name.
  return 'name' in value && typeof value.name === 'string' && value.name === 'ArchRuleError'
}

/**
 * A rule file that loaded and contributed no rules — bug 0269.
 *
 * `eess-ts` has `ruleFileContributedNoRules` for this; the mermaid dialect had
 * no equivalent and simply counted zero. Unsuppressable, because a file that
 * enforces nothing is a configuration fault rather than a finding about a
 * diagram.
 */
function reportContributedNoRules(file: string, options: CheckOptions): void {
  const violation: ArchViolation = {
    rule: 'rule file: contributed no rules',
    ruleId: 'cli/rule-file-contributed-no-rules',
    element: file,
    file,
    line: 1,
    message:
      `${file} loaded but contributed no rules, so this run enforced nothing from it. ` +
      'Export the builders you meant to check from the default export — an array of ' +
      'them, or a single one. If the file is deliberately empty, delete it rather than ' +
      'leaving a rule file that enforces nothing.',
    because:
      'a rule file that contributes no rules cannot fail, and a gate that cannot fail is worth less than no gate',
    bypassFilters: true,
  }
  // No try/catch: `reportViolations` escalates to a throw only for the emitter's
  // own ids (ADR-014 §5), and this is not one of them. Swallowing a throw here
  // would hide a real defect, and the repo's own `every discarded error carries a
  // written reason` rule is right to refuse it.
  reportViolations(collectResult([violation], { examined: 0 }), options)
}

export async function runCheck(args: CheckArgs): Promise<number> {
  const started = Date.now()
  const format: OutputFormat = args.format === 'auto' ? detectFormat() : args.format
  const options: CheckOptions = { format }

  const loadOptions: LoadOptions = { fresh: args.fresh }

  // **Per rule file, and through the receipt** — bug 0269. This loop used to
  // call `builder.check(options)` and count the throws, which never looks at
  // what the rule examined: a hand-rolled `{ check: () => {} }` was a counted
  // rule and a green tick. It now reads `violations()` — the receipt every
  // builder already carries — and hands it to the kernel's gate, which is the
  // wiring `eess-ts` gained in plan 0263 Phase 2.
  //
  // Per file rather than over one flat array, so the finding can name the rule
  // file it came from. An emitter finding carries `file: ''` by construction (the
  // fault is the verdict, not a place in anyone's code), and "which rule file"
  // is the first thing the reader needs — bug 0026's seam, in the dialect that
  // had not learned it yet.
  // Rules that failed, and findings about a rule FILE, counted apart. A
  // file-level finding is not a failing rule, and folding them together printed
  // `1 of 0 rules failing` — the same nonsense `eess-ts` printed as `2 of 1 rule
  // failing` when it double-counted, caught there in review.
  let failures = 0
  let fileFindings = 0
  let ruleCount = 0
  for (const file of args.ruleFiles) {
    const builders: RuleBuilderLike[] = await loadRuleFiles([file], loadOptions)
    // A rule file that loads cleanly and contributes nothing enforces nothing.
    // Measured before this: `export default []` printed
    // `✓ eess-mermaid — 0 rules across 1 file · 0 failing` and exited 0 — the
    // zero denominator under a tick that `CLAUDE.md` calls a red flag.
    if (builders.length === 0) {
      fileFindings++
      reportContributedNoRules(file, options)
      continue
    }
    ruleCount += builders.length
    for (const builder of builders) {
      const receipt = builder.violations()
      const gated = finishPreset(receipt, { report: 'return' })
      if (gated.length === 0) continue
      failures++
      const attributed = gated.map((v) =>
        v.file === '' ? { ...v, file, line: v.line === 0 ? 1 : v.line } : v,
      )
      try {
        // `gated.examined`, not `receipt.examined`. A bare array has no
        // `examined` at all, so re-wrapping with the RAW receipt's value hands
        // `reportViolations` a receipt that claims no evidence — and its gate
        // appends a SECOND `emitter/no-receipt`, printing the same finding twice.
        // Measured: `[1 of 2]` and `[2 of 2]`, one attributed and one not. The
        // gated receipt already carries the corrected count.
        reportViolations(collectResult(attributed, { examined: gated.examined }), options)
      } catch (error: unknown) {
        // The gate's own finding escalates to a throw inside `reportViolations`
        // (ADR-014 §5). It is already counted and already printed.
        if (!isArchRuleError(error)) throw error
      }
    }
  }

  // Report the denominator so a fast green is provably non-vacuous, not silence.
  // Terminal only — JSON/GitHub-annotation output on stdout stays machine-clean.
  if (format === 'terminal') {
    const ms = Date.now() - started
    const time = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
    const rules = ruleCount
    const files = args.ruleFiles.length
    const scope = `${rules} rule${rules === 1 ? '' : 's'} across ${files} file${files === 1 ? '' : 's'}`
    const fileNote =
      fileFindings === 0
        ? ''
        : ` · ${fileFindings} rule-file finding${fileFindings === 1 ? '' : 's'}`
    // "0 of 0 rules failing" is noise: when nothing loaded, the finding IS the
    // denominator, so say that instead of dressing a zero as a ratio.
    const line =
      failures === 0 && fileFindings === 0
        ? `✓ eess-mermaid — ${scope} · 0 failing (${time})`
        : rules === 0
          ? `✗ eess-mermaid — ${scope}${fileNote} (${time})`
          : `✗ eess-mermaid — ${failures} of ${scope} failing${fileNote} (${time})`
    process.stderr.write(`\n${line}\n`)
  }

  return failures + fileFindings
}
