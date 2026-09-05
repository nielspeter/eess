import fs from 'node:fs'
import type { ArchViolation } from './violation.js'
import { severityFor } from './violation.js'
import type { CheckOptions } from './check-options.js'
import type { RuleMetadata } from './rule-metadata.js'
import { ArchRuleError } from './errors.js'
import { formatViolations } from './format.js'
import { formatViolationsJson } from './format-json.js'
import { formatViolationsGitHub } from './format-github.js'
import { reportViolations } from './report.js'
import { parseExclusionComments, isExcludedByComment } from './exclusion-comments.js'
import type { ExclusionComment } from './exclusion-comments.js'
import type { ExclusionWarning } from './exclusion-comments.js'
import { UNSUPPRESSABLE } from './unsuppressable.js'
import { writeStderr } from './stderr.js'
import { activeNotice } from './diff-disclosure.js'
import { recordCommentSuppression } from './comment-suppression.js'

/**
 * Context for executing a rule's terminal methods.
 * Shared across all builder types (RuleBuilder, SliceRuleBuilder,
 * SchemaRuleBuilder, ResolverRuleBuilder, PairFinalBuilder, SmellBuilder).
 */
export interface ExecuteRuleContext {
  reason?: string
  /**
   * This rule's own sentence, deferred (bug 0258).
   *
   * A thunk rather than a string because `filterContext()` runs on every
   * terminal call and this is only read when an id-less rule turns out to have
   * an exclusion comment it cannot honour — the same shape `facts()` already
   * uses for `describeRule` a few lines above it.
   */
  describe?: () => string
  metadata?: RuleMetadata
  exclusions?: (string | RegExp)[]
  silentIndices?: Set<number>
}

/**
 * Stamp rule metadata onto violations and apply the rule's exclusions.
 *
 * Extracted to eliminate terminal-method duplication across builders. Baseline
 * and diff filtering are NOT done here — `executeCheck`/`executeWarn` apply
 * those after calling this — and neither is the terminal action.
 *
 * **Mutates the violations it is given** and returns a filtered array of the
 * same objects. Every in-repo producer builds fresh violations per call, so this
 * is safe today; a caller that hands one array to two rules would see the first
 * rule's metadata stick. Stated because this is exported API.
 */
export function applyFilters(
  violations: ArchViolation[],
  ctx: ExecuteRuleContext,
): ArchViolation[] {
  let result = violations

  // Apply .excluding() chain exclusions — never against a bypassFilters
  // (ADR-010 configuration) finding: it reports the rule's own instrument is
  // broken, not a fault in what was examined, so an exclusion aimed at the
  // latter cannot correctly suppress the former.
  const exclusions = ctx.exclusions ?? []
  if (exclusions.length > 0) {
    const matchedPatterns = new Set<number>()
    result = result.filter((v) => {
      if (v.bypassFilters === true) return true
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
        return false
      }
      return true
    })

    const ruleId = ctx.metadata?.id ?? 'unnamed'
    const silentIndices = ctx.silentIndices ?? new Set()
    exclusions.forEach((pattern, index) => {
      if (!matchedPatterns.has(index) && !silentIndices.has(index)) {
        writeStderr(
          `[eess] Unused exclusion '${String(pattern)}' in rule '${ruleId}'. ` +
            `It matched zero violations — it may be stale after a rename.`,
        )
      }
    })
  }

  // Stamp rule-level metadata onto every violation that doesn't carry its own.
  //
  // `id`, `because`, `suggestion` and `docs` are properties of the RULE, so this
  // is their single source of truth; a condition that already set one is left
  // untouched. That guard is load-bearing, not decorative: `TsconfigBuilder`
  // computes a per-key `suggestion` ("required X, actual Y") that must survive a
  // rule-level generic one, and `spec.rules.ts` builds a per-row remedy the same
  // way. It is tested directly in `packages/core/tests/execute-rule.test.ts`,
  // because inverting it passed the whole suite and every gate.
  //
  // Most builders already carried these: `RuleBuilder`, the pair/slice/schema/
  // resolver builders and the ts dialect's `createViolation` all thread them
  // through `ConditionContext`. (An earlier version of this comment named the
  // pair builders as affected — measured false: dropping the stamp reddens only
  // the correspondence tests.) The ones that construct violations directly and
  // had no such path are `correspondence()` and `TsconfigBuilder`, which lost:
  //
  //   - `.because()` reached the terminal renderer only via the report-level
  //     `reason` that `.check()` passes separately, so the `.violations()` path
  //     — ADR-008's caller-owns-emission route — dropped it entirely, in every
  //     format (bug 0122). Two gates had already hand-written the same
  //     workaround, which is the signal it belongs here.
  //   - `.rule({ suggestion })` type-checked, ran, and could never render a
  //     `Fix:` line for a two-sided rule (bug 0113).
  //
  // Done before the exclusion-comment scan below, and outside its `metadata.id`
  // guard: `.because()` is usable without `.rule({ id })`.
  if (result.length > 0) {
    for (const v of result) {
      if (v.ruleId === undefined && ctx.metadata?.id !== undefined) v.ruleId = ctx.metadata.id
      if (v.because === undefined && ctx.reason !== undefined) v.because = ctx.reason
      if (v.suggestion === undefined && ctx.metadata?.suggestion !== undefined)
        v.suggestion = ctx.metadata.suggestion
      if (v.docs === undefined && ctx.metadata?.docs !== undefined) v.docs = ctx.metadata.docs
    }
  }

  // Scan source files for inline exclusion comments.
  //
  // **Not gated on `ctx.metadata?.id` any more (bug 0255).** It used to be, and
  // that made the worst case of an inert directive the quietest: with no
  // `.rule({ id })` a comment can never match — `isExcludedByComment` returns
  // false without a `ruleId` — and because the block was skipped, the file was
  // never even parsed, so nothing could notice. An adopter following the
  // documented sanction recipe got the same red build and no explanation.
  //
  // The cost is bounded the same way it always was: only files that already
  // produced a violation are read. A rule with no id now pays one parse per
  // violating file to be able to say why the sanction did nothing.
  if (result.length > 0) {
    const filePaths = new Set(result.map((v) => v.file))
    const undocumented: ExclusionWarning[] = []
    const allComments = [...filePaths].flatMap((filePath) => {
      try {
        const sourceText = fs.readFileSync(filePath, 'utf-8')
        const parseResult = parseExclusionComments(sourceText, filePath)
        for (const warning of parseResult.warnings) {
          // An undocumented exclusion is well-formed and APPLIES, so a stderr
          // line would let a waiver nobody justified pass with exit 0. It
          // becomes an unsuppressable finding below instead — ADR-009 rule 3's
          // corollary, and bug 0039's design, which until ADR-012 only `eess-ts`
          // implemented. The malformed shapes decline to create the exclusion at
          // all, so the original violation still fires and the build is already
          // red; stderr is the right weight for those.
          if (warning.kind === 'undocumented' && ctx.metadata?.id !== undefined) {
            // The promotion below builds an unsuppressable finding keyed on the
            // rule id. Without one there is nothing to key it on — and the
            // directive is inert anyway, which the inert report says with a
            // remedy the author can act on. So it falls through to stderr.
            undocumented.push(warning)
            continue
          }
          writeStderr(`[eess] ${warning.message}`)
        }
        return parseResult.exclusions
      } catch (err) {
        // Deliberate discard: violation paths may be virtual (synthetic
        // elements, fixtures) — an unreadable file simply has no exclusion
        // comments; warning here would spam every synthetic-element rule.
        void err
        return []
      }
    })

    const ruleId = ctx.metadata?.id
    if (allComments.length > 0 && ruleId !== undefined) {
      // Which comments actually did something, so the ones that did nothing can
      // be named. Reuses `isExcludedByComment` one comment at a time rather than
      // re-deriving the match, so this can never drift from the real rule.
      const spent = new Set<ExclusionComment>()
      result = result.filter((v) => {
        if (v.bypassFilters === true) return true
        const excluded = isExcludedByComment(v, allComments)
        if (excluded) {
          recordCommentSuppression(ruleId, v.file)
          for (const c of allComments) if (isExcludedByComment(v, [c])) spent.add(c)
        }
        return !excluded
      })

      // A directive naming THIS rule that suppressed nothing. Same shape and the
      // same weight as the `.excluding()` "Unused exclusion" line above — that
      // mechanism has warned about a stale pattern since bug 0044; the comment
      // form never did, which is bug 0255.
      //
      // **The wording is domain-neutral on purpose.** The first version explained
      // the next-line scope in terms of markdown table rows, because that is the
      // corpus bug 0255 was filed against. This function is the kernel's, and
      // `eess-mermaid` and `eess-gherkin` run it unforked — so a stale directive
      // in a `.mmd` or `.feature` file was told it sat "inside a markdown table".
      // Review caught it, and caught the tell: the hand-port into `eess-ts`
      // silently dropped the table clause because it made no sense there, which
      // is the evidence it never belonged at the shared layer. The table nuance
      // now lives in `docs/markdown.md`, where the dialect that has tables is
      // documented.
      //
      // Scoped to this rule's id on purpose: a file may carry directives for many
      // rules, and one naming another rule matched nothing here for a good
      // reason. Without that scope this would fire once per unrelated directive
      // per rule.
      for (const c of allComments) {
        if (c.ruleId !== ruleId || spent.has(c)) continue
        writeStderr(
          `[eess] Exclusion comment for '${ruleId}' at ${c.file}:${String(c.line)} ` +
            `suppressed nothing. It may be stale, or out of reach: a single-line ` +
            `directive covers only the NEXT line. eess-exclude-start/-end covers a ` +
            `region instead.`,
        )
      }
    } else if (allComments.length > 0) {
      // No rule id, so no comment here can ever match: `isExcludedByComment`
      // refuses without one.
      //
      // **This branch cannot say whose directive it is looking at, and the first
      // version pretended otherwise.** It named each comment's own rule id and
      // told the reader to add `.rule({ id: <that id> })` — but from inside one
      // rule's execution there is no way to know whether that id already belongs
      // to a different, working rule. Review reproduced the harm: a directive
      // correctly waiving `other/rule` in a file where an id-less rule also
      // fired produced advice to claim `other/rule` for the id-less one, which
      // nothing prevents and which would collide two rules on one id.
      //
      // So it states the fact and leaves the id to the author. One line per
      // file, not per comment, for the same reason its sibling scopes by id: a
      // file may carry directives for many rules and none of them is evidence
      // about this one.
      const byFile = new Map<string, number[]>()
      for (const c of allComments) {
        const lines = byFile.get(c.file)
        if (lines) lines.push(c.line)
        else byFile.set(c.file, [c.line])
      }
      // Name the rule by its `.because()` reason when it has one (bug 0258).
      // An id-less rule has no id to name, so several id-less chains over one
      // file printed byte-identical lines and a reader could not tell which
      // chain needed the id. The reason is a discriminator that already exists:
      // `.because()` works without `.rule({ id })`, and `ctx.reason` is stamped
      // onto violations a few lines above this. Whitespace is collapsed because
      // the reason is prose and may wrap, and this report is deliberately one
      // line per file. A rule with neither id nor reason is genuinely anonymous
      // and the message stays exactly as it was.
      // Name the rule, preferring its own sentence over its reason.
      //
      // The first version of this used `.because()` alone, on the premise that
      // no rule description was reachable here. Review measured that false:
      // every builder implements `describeRule()`, `filterContext()` is a method
      // on the class that has it, and the kernel already names an id-less rule
      // this way for its assertion-less finding a couple of hundred lines above.
      // `.because()` is optional prose — the chains this diagnostic targets
      // often have neither an id nor a reason — so leaning on it alone was a
      // weaker floor for the same cost.
      //
      // `'unnamed'` is `TerminalBuilder`'s own fallback for a rule with no id;
      // naming a rule "unnamed" tells the reader nothing, so it counts as absent
      // and the reason takes over. Whitespace is collapsed either way: both are
      // prose that may wrap, and this report is one line per file.
      const oneLine = (t: string): string => t.replace(/\s+/g, ' ').trim()
      const described = ctx.describe?.()
      const label =
        described !== undefined && described !== 'unnamed' && described !== ''
          ? oneLine(described)
          : ctx.reason === undefined
            ? undefined
            : oneLine(ctx.reason)
      const named = label === undefined || label === '' ? '' : ` ("${label}")`
      for (const [file, lines] of byFile) {
        const where = lines.length === 1 ? `line ${String(lines[0])}` : `lines ${lines.join(', ')}`
        writeStderr(
          `[eess] This rule${named} declares no id, so no exclusion comment can apply to it — ` +
            `a comment matches a violation by rule id. ${file} has a directive at ${where}. ` +
            `If one was meant for this rule, give the rule an id with .rule({ id: '<your-id>' }); ` +
            `directives naming other rules are not this rule's to honour.`,
        )
      }
    }

    // The waiver applied; this takes the suppressed finding's place, so the
    // author is told what to fix rather than shown the violation they waived.
    //
    // Unsuppressable, because a suppression mechanism that can suppress the
    // complaint about itself is not a mechanism.
    //
    // `undocumented` is only ever populated when the rule HAS an id (the push
    // above is guarded on it), so this loop is unreachable without one — the
    // local re-binding is what tells the compiler that after bug 0255 removed
    // the outer `ctx.metadata?.id` gate.
    for (const warning of undocumented) {
      if (ruleId === undefined) continue
      result.push({
        rule: ruleId,
        ruleId,
        element: `${ruleId}@${warning.file}:${String(warning.line)}`,
        file: warning.file,
        line: warning.line,
        message:
          `This exclusion states no reason, so nothing records why the rule is ` +
          `waived here — and it is silently suppressing a real finding.`,
        suggestion:
          `Add a reason: // eess-exclude ${ruleId}: <why>. ` +
          `A reason is prose and nothing verifies it, so this raises the cost of a ` +
          `suppression rather than preventing one — the audience is the reviewer ` +
          `reading the diff. If the exemption is not justifiable, delete it and fix ` +
          `the finding instead. ${UNSUPPRESSABLE}`,
        severity: 'error',
        bypassFilters: true,
      })
    }
  }

  return result
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
    const before = filtered.length
    filtered = options.diff.filterToChanged(filtered)
    const notice = activeNotice(before - filtered.length)
    if (notice !== undefined) writeStderr(`${notice}\n`)
  }

  if (filtered.length > 0) {
    // One emitter for both paths (plan 0070) — text/json/github, then throw.
    reportViolations(filtered, { format: options?.format, reason: ctx.reason })
    throw new ArchRuleError(filtered, ctx.reason)
  }
}

/**
 * Execute the terminal "warn" action: apply options, format, log to stderr.
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
    const before = filtered.length
    filtered = options.diff.filterToChanged(filtered)
    const notice = activeNotice(before - filtered.length)
    if (notice !== undefined) writeStderr(`${notice}\n`)
  }

  if (filtered.length > 0) {
    if (options?.format === 'json') {
      writeStderr(formatViolationsJson(filtered, ctx.reason))
    } else if (options?.format === 'github') {
      process.stdout.write(formatViolationsGitHub(filtered, 'warning') + '\n')
    } else {
      writeStderr(formatViolations(filtered, ctx.reason))
    }
  }

  // `bypassFilters` outranks `.warn()` (see `severityFor`) — a config finding
  // whose own text promises "not by .warn()" must still fail the build even
  // though the rest of this rule's findings are legitimately warn-only.
  const escalated = filtered.filter((v) => severityFor(v, 'warn') === 'error')
  if (escalated.length > 0) {
    throw new ArchRuleError(escalated, ctx.reason)
  }
}
