import fs from 'node:fs'
import type { ArchViolation } from './violation.js'
import type { CheckOptions } from './check-options.js'
import type { RuleMetadata } from './rule-metadata.js'
import { ArchRuleError } from './errors.js'
import { formatViolations } from './format.js'
import { formatViolationsJson } from './format-json.js'
import { formatViolationsGitHub } from './format-github.js'
import { reportViolations } from './report.js'
import { parseExclusionComments, isExcludedByComment } from './exclusion-comments.js'

/**
 * Context for executing a rule's terminal methods.
 * Shared across all builder types (RuleBuilder, SliceRuleBuilder,
 * SchemaRuleBuilder, ResolverRuleBuilder, PairFinalBuilder, SmellBuilder).
 */
// eess-exclude eess/no-unused-exports: parameter type of the exported applyFilters/executeCheck/executeWarn API (must stay exported for declaration emit)
export interface ExecuteRuleContext {
  reason?: string
  metadata?: RuleMetadata
  exclusions?: (string | RegExp)[]
  silentIndices?: Set<number>
}

/**
 * Apply exclusion patterns, inline exclusion comments, baseline,
 * and diff filtering to a set of violations, then execute the
 * terminal action (throw or warn).
 *
 * Extracted to eliminate terminal-method duplication across builders.
 */
export function applyFilters(
  violations: ArchViolation[],
  ctx: ExecuteRuleContext,
): ArchViolation[] {
  let result = violations

  // Apply .excluding() chain exclusions
  const exclusions = ctx.exclusions ?? []
  if (exclusions.length > 0) {
    const matchedPatterns = new Set<number>()
    result = result.filter((v) => {
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
        console.warn(
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
  // untouched. `RuleBuilder` also threads them through `ConditionContext`, which
  // is why most one-sided rules already carry them — but `TerminalBuilder`
  // subclasses (`correspondence()`, the pair builders) construct violations
  // directly and have no such path. Before this, they silently lost all four:
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

  // Scan source files for inline exclusion comments (when rule has an ID).
  // Matching is on ruleId, which the block above has just guaranteed is present.
  if (ctx.metadata?.id && result.length > 0) {
    const filePaths = new Set(result.map((v) => v.file))
    const allComments = [...filePaths].flatMap((filePath) => {
      try {
        const sourceText = fs.readFileSync(filePath, 'utf-8')
        const parseResult = parseExclusionComments(sourceText, filePath)
        for (const warning of parseResult.warnings) {
          console.warn(`[eess] ${warning.message}`)
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

    if (allComments.length > 0) {
      result = result.filter((v) => !isExcludedByComment(v, allComments))
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
    filtered = options.diff.filterToChanged(filtered)
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
    filtered = options.diff.filterToChanged(filtered)
  }

  if (filtered.length > 0) {
    if (options?.format === 'json') {
      console.warn(formatViolationsJson(filtered, ctx.reason))
    } else if (options?.format === 'github') {
      process.stdout.write(formatViolationsGitHub(filtered, 'warning') + '\n')
    } else {
      console.warn(formatViolations(filtered, ctx.reason))
    }
  }
}
