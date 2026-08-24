import fs from 'node:fs'
import type { ArchViolation } from '@nielspeter/eess'
import {
  severityFor,
  disambiguateIdentities,
  byCodepoint,
  violationsEmittedCount,
} from '@nielspeter/eess/internal'
import type { CheckOptions, OutputFormat } from '@nielspeter/eess'
import type { RuleMetadata } from '@nielspeter/eess'
import { ArchRuleError } from '@nielspeter/eess'
import { formatViolations } from '@nielspeter/eess'
import { formatViolationsJson } from '@nielspeter/eess'
import { activeNotice } from '@nielspeter/eess/internal'
import { formatViolationsGitHub } from '@nielspeter/eess'
import { parseExclusionComments, isExcludedByComment } from './exclusion-comments.js'
import type { ExclusionWarning } from './exclusion-comments.js'
import { UNSUPPRESSABLE } from '@nielspeter/eess/internal'
import { recordCommentSuppression } from '@nielspeter/eess/internal'
import { writeStderr } from '@nielspeter/eess/internal'
import type { EdgeCoverage } from '@nielspeter/eess'

/**
 * Context for executing a rule's terminal methods.
 * Shared across all builder types (RuleBuilder, SliceRuleBuilder,
 * SchemaRuleBuilder, ResolverRuleBuilder, PairFinalBuilder, SmellBuilder).
 */
interface ExecuteRuleContext {
  reason?: string
  metadata?: RuleMetadata
  exclusions?: (string | RegExp)[]
  silentIndices?: Set<number>
}

/**
 * Complete each violation's identity, then apply `.excluding()` patterns and
 * inline exclusion comments.
 *
 * Extracted to eliminate terminal-method duplication across builders.
 *
 * **Not** baseline or diff filtering, despite what this said for several
 * releases — those run in `executeCheck` / `executeWarn`, after this returns.
 *
 * ## The invariant, for whoever adds the next filter
 *
 * **Enrichment runs first, so every filter sees a complete violation.** That is
 * the whole reason for the ordering, and it is easy to undo by accident because
 * enrichment looks like output formatting rather than identity. It is not: the
 * comment filter matches on `ruleId`, and when enrichment ran last that filter
 * saw `undefined` for every condition that did not stamp the field itself
 * (bug 0041) — a documented feature that silently did nothing.
 *
 * Enrichment is pure, idempotent, and writes a **disjoint field set** from
 * everything the filters read: it touches `ruleId`, `because`, `suggestion` and
 * `docs`; `.excluding()` matches on `element`/`file`/`message`, and the
 * `bypassFilters` refusal path reads a flag enrichment never writes. So
 * "identity is complete before anything reads it" is a simpler invariant to hold
 * than "each filter must know which fields exist yet". Add a filter that reads
 * one of those four fields and it will work; add a mutation of them below a
 * filter and you have reintroduced 0041.
 */
export function applyFilters(
  violations: ArchViolation[],
  ctx: ExecuteRuleContext,
): ArchViolation[] {
  // Identity uniqueness, BEFORE the enrichment below and before every filter — see
  // `disambiguateIdentities`. Two reasons for this position specifically:
  //
  // 1. This function's own contract is that identity is complete before anything reads it,
  //    and the baseline reads it after. A producer that emits two findings with one identity
  //    hands the baseline one entry for two findings, and accepting either accepts both —
  //    which is bugs 0028, 0063, 0064 and 0065, one per family that got reviewed.
  // 2. Ahead of the filters rather than after them, so a finding's identity is a property of
  //    what the RULE found, not of what a `--changed` or `.excluding()` run happened to keep.
  //    Suffixing after filtering would give the same finding different identities in CI and
  //    on a laptop, which is the defect `identity` exists to prevent.
  //
  // Enrichment does not touch `element`, `message` or `identity`, so the order between this
  // and the block below is free; it runs first to keep "identity is settled" the outermost
  // statement about this function.
  let result = disambiguateIdentities(violations)

  // Enrich FIRST, because a filter cannot match on a field that is not set yet.
  //
  // [ts-archunit Bug 0041](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0041-an-exclusion-comment-is-a-no-op-for-most-conditions.md):
  // this block used to run LAST, after the inline-comment filter below. That
  // filter's first statement is `if (!violation.ruleId) return false`
  // (`exclusion-comments.ts:262`), so an exclusion comment matched only
  // violations whose *producing condition* stamped `ruleId` itself. For every
  // condition that left it to this enrichment — the dependency, exports, slice,
  // reverse-dependency and module-body families, which is most of them — the
  // comment was inert: no suppression, no error, no warning. Measured, with a
  // documented comment and a rule carrying an id, `modules().notImportFrom()`
  // returned the violation unsuppressed, and it carried the matching `ruleId`,
  // stamped here a few lines too late.
  //
  // Ordering, not lookup, is the fix: giving `isExcludedByComment` a second
  // source for the id would leave two places that decide what a rule is called.
  //
  // Safe ahead of `.excluding()` as well, which matches on `element`/`file`/
  // `message` — none of which this touches. It costs a map over violations that
  // may later be filtered out; correctness beats that.
  const meta = ctx.metadata
  if (ctx.reason || meta?.id || meta?.because || meta?.suggestion || meta?.docs) {
    result = result.map((v) => ({
      ...v,
      ruleId: v.ruleId ?? meta?.id,
      because: v.because ?? ctx.reason ?? meta?.because,
      // A `bypassFilters` finding reports that the rule enforces NOTHING, so the
      // author's `suggestion` cannot be its remedy: that text describes how to fix
      // a real violation of the rule, and the formatter renders `suggestion` under
      // `Fix:` — the field an agent obeys. Pairing a configuration message with an
      // unrelated `Fix:` is a false remedy by juxtaposition (bug 0021), and it is
      // ADR-009 rule 2: a failure may not assert a cause it cannot verify.
      //
      // `SliceRuleBuilder.metaViolation` argued exactly this in a comment and
      // omitted both fields — and was overridden here, one layer up, so the
      // omission had no effect in any shipped version. Measured: a finding reading
      // "resolved no slices" printed "Split the cycle by extracting a shared
      // module." as its Fix:.
      //
      // This guard reaches only producers that LEAVE the fields unset. A producer
      // that assigns `context.suggestion` itself defeats it — bug 0042, where
      // `cross-layer.ts` did exactly that and shipped the author's remedy on an
      // empty-layer finding. Such a producer owns the discipline itself.
      //
      // `ruleId` and `because` stay. Neither asserts a remedy: the id says WHICH
      // rule enforces nothing, which is the first thing the reader needs, and
      // `because` states why the rule exists, which is context rather than a
      // claim about this finding's cause. A producer that wants a remedy sets its
      // own — `metaViolation` sets `docs: GLOB_DOCS`, which is about the fault.
      suggestion: v.bypassFilters ? v.suggestion : (v.suggestion ?? meta?.suggestion),
      docs: v.bypassFilters ? v.docs : (v.docs ?? meta?.docs),
    }))
  }

  // Apply .excluding() chain exclusions
  const exclusions = ctx.exclusions ?? []
  if (exclusions.length > 0) {
    const matchedPatterns = new Set<number>()
    /** Patterns that matched a meta-finding, which cannot be excluded. */
    const refusedPatterns = new Set<number>()
    // Per exclusion-pattern index, the DISTINCT `element` values it matched among
    // violations whose `identity` starts with `cycle-edge::` (plan 0104). A plain
    // string-prefix read of a field every violation already carries — no cycle-specific
    // import here, so this stays family-agnostic in spirit even though today only one
    // family sets that prefix. One pattern matching more than one distinct cycle edge is
    // the exact loophole a whole-component `.excluding()` waiver reopens: it silently
    // absorbs any FUTURE edge the pattern also happens to match, which is the same
    // fail-open shape plan 0104's `element`-per-edge change exists to close.
    const matchedCycleEdges = new Map<number, Set<string>>()
    result = result.filter((v) => {
      // Config-level meta-findings (empty selector / empty discovery) are never
      // excludable: they report that the rule checks NOTHING, so silencing one
      // silences the guard itself. Baseline and diff-aware already honor this
      // flag; `.excluding()` must too, or a rule that enforces nothing can be
      // made green — the exact false-green ADR-008 exists to prevent. This
      // matters more now that meta-messages quote the user's own globs/paths,
      // which an unrelated path exclusion can incidentally match.
      if (v.bypassFilters) {
        // Record a pattern that WOULD have matched, so the "unused exclusion" warning
        // below doesn't tell the caller their exclusion is stale after a rename. It
        // isn't stale — it is refused, which is a different instruction.
        const wouldMatch = exclusions.findIndex((pattern) =>
          typeof pattern === 'string'
            ? [v.element, v.file, v.message].includes(pattern)
            : [v.element, v.file, v.message].some((target) => pattern.test(target)),
        )
        if (wouldMatch >= 0) refusedPatterns.add(wouldMatch)
        return true
      }

      // Match against element, file, or message — so that custom conditions
      // using createViolation() can be excluded by file path or message content,
      // not just by element name (which may be a generic AST node kind).
      const targets = [v.element, v.file, v.message]
      const matchIndex = exclusions.findIndex((pattern) =>
        typeof pattern === 'string'
          ? targets.some((t) => t === pattern)
          : targets.some((t) => pattern.test(t)),
      )
      if (matchIndex >= 0) {
        matchedPatterns.add(matchIndex)
        if (v.identity?.startsWith('cycle-edge::') === true) {
          const set = matchedCycleEdges.get(matchIndex) ?? new Set<string>()
          set.add(v.element)
          matchedCycleEdges.set(matchIndex, set)
        }
        return false
      }
      return true
    })

    const ruleId = ctx.metadata?.id ?? 'unnamed'
    const silentIndices = ctx.silentIndices ?? new Set()
    exclusions.forEach((pattern, index) => {
      if (refusedPatterns.has(index)) {
        writeStderr(
          `[eess] Exclusion '${String(pattern)}' in rule '${ruleId}' matched a ` +
            `configuration finding, which cannot be excluded — that finding reports the ` +
            `rule enforces nothing. Fix the fault it names instead.`,
        )
      } else if (!matchedPatterns.has(index) && !silentIndices.has(index)) {
        writeStderr(
          `[eess] Unused exclusion '${String(pattern)}' in rule '${ruleId}'. ` +
            `It matched zero violations — it may be stale after a rename.`,
        )
      } else {
        // A pattern matching more than one distinct cycle edge silently absorbs any
        // future edge it also happens to match — the loose-regex loophole plan 0104's
        // per-edge `element` reopens for anyone matching on `file`/`message` instead of an
        // exact `element` string (an exact string can only equal one edge, by
        // construction). Advisory (`writeStderr`), not a `DiagnosticFinding` or a
        // second unsuppressable gate. Review flagged the asymmetry directly rather
        // than let it pass as settled: "Unused exclusion" above it warns about a
        // pattern that silences NOTHING (fail-closed — the finding still fires, CI is
        // still red), while this warns about a pattern that silences MULTIPLE real
        // findings and every future one on the same edges (fail-open — a green
        // `check()`, one stderr line). ADR-008 states the primary consumer does not
        // read warnings. Kept advisory here, matching plan 0104's own review
        // resolution — but the asymmetry is real and worth re-litigating if this
        // loophole is measured firing in practice, not settled by the precedent
        // alone.
        const edges = matchedCycleEdges.get(index)
        if (edges !== undefined && edges.size > 1) {
          // byCodepoint, not the default comparator — this is user-facing (the
          // suggested `.excluding(...)` line) and the same determinism class
          // bug 0010 named for every other sorted, filesystem-adjacent output
          // in this family (review: architect).
          const sorted = [...edges].sort(byCodepoint)
          writeStderr(
            `[eess] Exclusion '${String(pattern)}' in rule '${ruleId}' matched ${String(sorted.length)} ` +
              `distinct cycle edges (${sorted.join(', ')}). A pattern matching more than one edge silently ` +
              `absorbs any future cycle among the edges it matches — name each edge separately: ` +
              `.excluding(${sorted.map((e) => `'${e}'`).join(', ')}).`,
          )
        }
      }
    })
  }

  // Scan source files for inline exclusion comments (when rule has an ID)
  if (ctx.metadata?.id && result.length > 0) {
    const undocumented: ExclusionWarning[] = []
    const filePaths = new Set(result.map((v) => v.file))
    const allComments = [...filePaths].flatMap((filePath) => {
      // Two EXPECTED shapes never reach the read, so that the catch below is
      // left holding only the surprising one.
      //
      // `file: ''` is a configuration finding — there is no source and no
      // comment to find. This used to be expressed by letting `readFileSync('')`
      // throw into the catch: control flow by exception, on a NORMAL path.
      //
      // A path not on disk is an in-memory ts-morph project or a test fixture's
      // synthetic file. Same story — no file, so no exclusion comments. Measured:
      // without this clause a warning fires once per file for every in-memory
      // project (it broke two cases in `excluding-matching.test.ts`).
      //
      // Together these are what made the catch unreportable — it could not tell
      // either expected case from a file we genuinely failed to read, so it had
      // to stay silent about all three.
      if (filePath === '' || !fs.existsSync(filePath)) return []
      try {
        const sourceText = fs.readFileSync(filePath, 'utf-8')
        const parseResult = parseExclusionComments(sourceText, filePath)
        for (const warning of parseResult.warnings) {
          // An undocumented exclusion is well-formed and APPLIES, so a stderr
          // line is the wrong weight: it silences a real finding and the build
          // goes green (bug 0039). It becomes a configuration finding below.
          // The malformed shapes are different — two of the three decline to
          // create the exclusion at all, so the original violation still fires
          // and the build is already red. A line on stderr is right for those.
          if (warning.kind === 'undocumented') {
            undocumented.push(warning)
            continue
          }
          writeStderr(`[eess] ${warning.message}`)
        }
        return parseResult.exclusions
      } catch (err) {
        // On disk, and still unreadable — a permission or I/O failure, not a
        // shape eess expects. That is NOT silent: every `// eess-exclude` in
        // this file stops applying, so a violation the author believes is
        // waived fires again with no stated cause. Naming the file and the
        // reason is the difference between "your waiver broke" and "eess
        // started reporting something new" (ADR-009 rule 2).
        writeStderr(
          `[eess] could not read ${filePath} to apply its exclusion comments ` +
            `(${err instanceof Error ? err.message : String(err)}) — any ` +
            `\`// eess-exclude\` directives in it were NOT applied.\n`,
        )
        return []
      }
    })

    if (allComments.length > 0) {
      // `v.bypassFilters` explicitly, not by accident. These findings are
      // immune today only because they carry `file: ''`, which the guard above
      // returns no exclusions for, so `comment.file === ''` can never hold.
      // The moment one carries a real path this clause becomes the only
      // protection — and bug 0026 is that moment: configuration findings now
      // carry the rule file they came from, so this file IS read and its
      // `// eess-exclude` comments ARE parsed. Without the first clause
      // a comment in a rule file would silence the finding that says the rule
      // enforces nothing. Pinned by tests/helpers/exclusion-comments.ts.
      result = result.filter((v) => {
        if (v.bypassFilters === true) return true
        if (!isExcludedByComment(v, allComments)) return true
        // Disclose it. Silently dropping is what made this the only filter in
        // the pipeline a reader could not see — see `comment-suppression.ts`.
        recordCommentSuppression(v.ruleId ?? ctx.metadata?.id ?? '(unnamed rule)', v.file)
        return false
      })
    }

    // The exemption stands; what fails is the missing justification. That is
    // deliberate and it is what makes the remedy remediable: add a reason and
    // this finding clears while the exclusion keeps working. Refusing to apply
    // the exclusion instead would make the remedy "add a reason" produce a
    // DIFFERENT failure — the violation itself — which is a remedy that does
    // not remediate (ADR-009 rule 2).
    //
    // Unsuppressable, because a suppression mechanism that can suppress the
    // complaint about itself is not a mechanism.
    for (const warning of undocumented) {
      result.push({
        rule: ctx.metadata.id,
        ruleId: ctx.metadata.id,
        element: `${ctx.metadata.id}@${warning.file}:${String(warning.line)}`,
        file: warning.file,
        line: warning.line,
        message:
          `This exclusion states no reason, so nothing records why the rule is ` +
          `waived here — and it is silently suppressing a real finding.`,
        suggestion:
          `Add a reason: // eess-exclude ${ctx.metadata.id}: <why>. ` +
          `A reason is prose and nothing verifies it, so this raises the cost of a ` +
          `suppression rather than preventing one — the audience is the reviewer ` +
          `reading the diff. If the exemption is not justifiable, delete it and fix ` +
          `the finding instead. ${UNSUPPRESSABLE}`,
        // No explicit `severity`. `bypassFilters` already forces `error` through
        // `severityFor`, which every consumer path runs — `violations()`
        // (`terminal-builder.ts:229`), `executeCheck` and `executeWarn`. Setting
        // it here was dead: a sabotage row that flipped it to `warn` left the
        // suite green, because the flag overrode it downstream. A line that
        // reads load-bearing and is not is worse than no line.
        bypassFilters: true,
      })
    }
  }

  return result
}

/**
 * Stamp any un-stamped violation with a default severity (per-violation wins),
 * except a configuration meta-finding, which is always `error`.
 *
 * This is the site that mattered most and read as the safest: `?? severity`
 * looks conservative, but five of the six `bypassFilters` producers set no
 * severity at all, so on the `executeWarn` path every one of them resolved to
 * `warn` — a finding saying "this rule enforces nothing", reported as advice.
 */
function stampSeverity(violations: ArchViolation[], severity: 'error' | 'warn'): ArchViolation[] {
  return violations.map((v) => ({ ...v, severity: severityFor(v, v.severity ?? severity) }))
}

/**
 * Write a severity-aware, single-document report for the given format.
 *
 * Shared by the CLI runner and the throwing `check` terminal so the three
 * format branches live in one place:
 * - `json` ALWAYS emits one valid document (even with zero violations) so
 *   consumers/agents can parse a clean run.
 * - `github` partitions by severity so warnings render as `::warning`, not
 *   `::error`.
 * - terminal (default) writes the rich format to stderr.
 *
 * Terminal/github emit nothing when there are no violations.
 */
export function writeReport(
  violations: ArchViolation[],
  format?: OutputFormat,
  reason?: string,
  /** Allowlist rules that tested no edges, for the JSON document (bug 0015). */
  untested: readonly EdgeCoverage[] = [],
): void {
  // Counted at the top, before the json early-return, so every path that writes
  // is counted once. See `violationsWritten()` for why this is an emission count
  // and not a suppression count.
  violationsWrittenHere += violations.length
  if (format === 'json') {
    process.stdout.write(formatViolationsJson(violations, reason, untested) + '\n')
    return
  }
  if (violations.length === 0) return
  if (format === 'github') {
    const errors = violations.filter((v) => (v.severity ?? 'error') === 'error')
    const warnings = violations.filter((v) => v.severity === 'warn')
    const parts: string[] = []
    if (errors.length > 0) parts.push(formatViolationsGitHub(errors, 'error'))
    if (warnings.length > 0) parts.push(formatViolationsGitHub(warnings, 'warning'))
    process.stdout.write(parts.join('\n') + '\n')
  } else {
    writeStderr(formatViolations(violations, reason))
  }
}

/**
 * Whether a caller aggregates and reports every finding itself.
 *
 * The CLI does: it collects across all rule files and calls `writeReport` once, so a
 * per-rule terminal that also writes produces the finding twice — measured on the real
 * CLI as two `Architecture Violation [1 of 1]` blocks with identical content while
 * `--format json` said 1 (bug 0029).
 *
 * **Only the findings the aggregator can actually recover may be suppressed**, which
 * means only the ones that travel on the thrown `ArchRuleError`. A `.warn()` whose
 * violations are ordinary does not throw, and the CLI never calls `.violations()` on a
 * self-executing rule file — so those exist nowhere else and must always be written or
 * they are lost outright.
 *
 * Default false, because the in-test path has no aggregator: nothing catches the error
 * and re-renders it, so `ArchRuleError.message` — a one-line summary by design — would
 * be all a reader gets, losing the finding's message, its remedy and the sentence
 * saying it cannot be suppressed.
 */
let callerAggregatesReports = false
let violationsWrittenHere = 0

/**
 * Run `fn` with report aggregation on, restoring the previous value afterwards.
 *
 * **A dynamic extent, not a latch.** This replaced an exported
 * `setCallerAggregatesReports(on)` that the CLI called once and nothing ever set
 * back. Aggregation is a property of a RUN, and while `executeCheck` was the only
 * reader the difference was invisible — the CLI wanted suppression for its whole
 * life. It stopped being invisible the moment `deliver()` and `checkAll()` read it
 * too (bug 0203): measured, a preset called directly in a process that had already
 * run `runCheck` once emitted **6 violation blocks before and 0 after**. It still
 * threw, so nothing went falsely green — but the report, the `Why:` and the `Fix:`
 * were gone, with no signal that anything had been swallowed.
 *
 * Not an option on `CheckOptions`: a self-executing rule file writes `.check()`
 * with no arguments and a preset is called by the RULE FILE, not by the CLI, so
 * there is no per-call site the CLI could set. This is a property of who is
 * driving the run.
 *
 * Restores rather than clears, so nesting cannot switch a still-running outer
 * aggregation off.
 */
export async function withCallerAggregating<T>(fn: () => Promise<T>): Promise<T> {
  const previous = callerAggregatesReports
  callerAggregatesReports = true
  try {
    return await fn()
  } finally {
    callerAggregatesReports = previous
  }
}

/**
 * How many violations have actually been WRITTEN by either emitter, ever.
 *
 * Read as a delta across one rule file's evaluation, this answers the only
 * question the CLI's "your output was not filtered" notice may assert: *did
 * anything emit while that module was loading?*
 *
 * **This replaced an inverted signal, and the inversion was a measured defect.**
 * The first version counted the writes `executeCheck` SUPPRESSED and concluded
 * "then nothing leaked" from the absence of a suppression. That is a double
 * negative, and a rule file that suppresses one terminal while leaking through
 * another satisfies it while leaking — measured: a `report: 'warn'` preset plus a
 * silenced `.check()` in one file leaked 7 violation blocks and the notice stayed
 * silent. A silence built from a stale signal is worse than the false claim it was
 * introduced to fix, because the run says nothing at all.
 *
 * **Three emitters are counted, not two, and an earlier version of this docblock
 * got the list wrong.** It said `writeReport` was "used by `executeCheck`,
 * `executeWarn` and `check-all.ts`" — `executeWarn` does not call it. It writes
 * through `writeStderr` / `process.stdout.write` directly, with its own
 * json/github/terminal branching, so it moved neither counter and the leak
 * detector could not see it. Measured: a live `.warn()` beside a throwing
 * `.check()` under `--baseline` leaked its advisory findings in silence.
 *
 * The three: this module's `writeReport` (`executeCheck`, `check-all.ts`), this
 * module's `executeWarn` advisory write, and the kernel's `reportViolations`
 * (`finishPreset`). Missing any one reproduces the blind spot on that path — which
 * is exactly what happened, twice.
 *
 * That every emitter must be counted, and that nothing enforces it, is
 * [bug 0205](../../../../work/bugs/0205-four-emitters-restate-the-suppression-rule-and-disagree.md).
 */
/**
 * Is a caller aggregating reports for this run?
 *
 * Exposed so the two OTHER ts-side emitters can honour the same contract
 * `executeCheck` does: `presets/shared.ts`'s `deliver()` and `core/check-all.ts`.
 * Both used to emit unconditionally, so a preset or a `checkAll()` at module scope
 * printed its findings before the aggregating caller saw them — and the caller then
 * reported the same violations again off the throw. Bug 0203.
 */
export function callerAggregates(): boolean {
  return callerAggregatesReports
}

export function violationsWritten(): number {
  return violationsWrittenHere + violationsEmittedCount()
}

/**
 * Execute the terminal "check" action: apply options, format, throw on violations.
 */
export function executeCheck(
  violations: ArchViolation[],
  ctx: ExecuteRuleContext,
  options?: CheckOptions,
): void {
  let filtered = applyFilters(violations, ctx)

  if (options?.baseline) {
    filtered = options.baseline.filterNew(filtered)
  }
  if (options?.diff) {
    // Per rule, so no run total exists here — state the configuration once per
    // process instead of printing one line per rule (plan 0071,
    // `core/diff-disclosure.ts`).
    const before = filtered.length
    filtered = options.diff.filterToChanged(filtered)
    const notice = activeNotice(
      before - filtered.length,
      options.diff.size,
      options.diff.baseBranch,
    )
    if (notice !== undefined) writeStderr(notice)
  }

  if (filtered.length > 0) {
    const stamped = stampSeverity(filtered, 'error')
    // Bug 0201. `executeWarn` below has honoured this flag since it shipped;
    // `executeCheck` never did, so a `.check()` at module scope printed its
    // findings before the aggregating caller could filter them — which is the
    // whole of bug 0199 on this path. Measured: the leak goes 4 violations → 0.
    //
    // Safe for every other caller because the flag defaults to `false` and only
    // the CLI sets it: a `.check()` in a test file, where there is no aggregator,
    // still prints exactly as before.
    //
    // The violations are NOT lost when we stay quiet — they ride the throw, which
    // is the same reason `executeWarn` may suppress only its `bypassFilters`
    // entries and must still write the rest.
    if (!callerAggregatesReports) writeReport(stamped, options?.format, ctx.reason)
    throw new ArchRuleError(stamped, ctx.reason)
  }
}

/**
 * Execute the terminal "warn" action: apply options, format, log to stderr.
 *
 * Advisory for ordinary violations, which are logged exactly as before and
 * never throw. **A `bypassFilters` configuration finding throws**, carrying
 * only those findings.
 *
 * `.warn()` says "this rule's violations are advisory". A finding that the
 * rule enforces nothing is not a violation of the rule — it reports that the
 * rule cannot fire — and there is nothing advisory about that. Leaving the
 * hole open would make `.warn()` the documented escape hatch for exactly the
 * class of finding this release exists to surface, on exactly the
 * gradual-adoption audience the docs point at it.
 *
 * The payload matters as much as the throw: an error carrying 200 warn-level
 * violations plus one meta-finding would make "these findings are true" false
 * for 200 of 201 entries. `.violations()` remains the non-throwing
 * programmatic surface.
 */
export function executeWarn(
  violations: ArchViolation[],
  ctx: ExecuteRuleContext,
  options?: CheckOptions,
): void {
  let filtered = applyFilters(violations, ctx)

  if (options?.baseline) {
    filtered = options.baseline.filterNew(filtered)
  }
  if (options?.diff) {
    // Per rule, so no run total exists here — state the configuration once per
    // process instead of printing one line per rule (plan 0071,
    // `core/diff-disclosure.ts`).
    const before = filtered.length
    filtered = options.diff.filterToChanged(filtered)
    const notice = activeNotice(
      before - filtered.length,
      options.diff.size,
      options.diff.baseBranch,
    )
    if (notice !== undefined) writeStderr(notice)
  }

  if (filtered.length > 0) {
    const stamped = stampSeverity(filtered, 'warn')
    const configFindings = stamped.filter((v) => v.bypassFilters === true)

    // Write only what the throw will NOT carry.
    //
    // This used to write `stamped` in full and then throw the configuration
    // findings, so those were reported twice: once here and once by whoever
    // caught the error and reported `error.violations`. Measured on the CLI —
    // two `Architecture Violation [1 of 1]` blocks with identical content, while
    // `--format json` said 1 (bug 0029).
    //
    // Splitting rather than skipping the write entirely, because the ordinary
    // warn-level violations are NOT on the error — it deliberately carries only
    // the configuration findings, so that "these findings are true" stays true
    // for every entry. Dropping the write would lose them.
    // The configuration findings ride on the throw, so an aggregator re-reports them
    // and writing here would duplicate. Everything else exists only here.
    const advisory = callerAggregatesReports
      ? stamped.filter((v) => v.bypassFilters !== true)
      : stamped
    if (advisory.length > 0) {
      // Counted, because this is an EMISSION and an aggregating caller's leak
      // detector reads emissions. This function does not go through `writeReport`
      // — it has its own json/github/terminal branching, deliberately, so that a
      // json run's stdout document stays the caller's alone — and that made it
      // invisible: measured, a live `.warn()` beside a throwing `.check()` under
      // `--baseline` printed its advisory findings unfiltered while
      // `violationsWritten()` reported nothing written, so the "your filters did
      // not reach this" notice stayed silent. Bug 0199's false negative, reopened
      // through the one emitter this module's own docblock claimed was covered.
      violationsWrittenHere += advisory.length
      if (options?.format === 'json') {
        writeStderr(formatViolationsJson(advisory, ctx.reason))
      } else if (options?.format === 'github') {
        process.stdout.write(formatViolationsGitHub(advisory, 'warning') + '\n')
      } else {
        writeStderr(formatViolations(advisory, ctx.reason))
      }
    }

    if (configFindings.length > 0) throw new ArchRuleError(configFindings, ctx.reason)
  }
}
