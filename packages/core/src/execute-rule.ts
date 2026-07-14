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

  // Scan source files for inline exclusion comments (when rule has an ID)
  if (ctx.metadata?.id && result.length > 0) {
    // Tag violations with the rule id so inline exclusion comments (which match
    // on ruleId) work for every condition — not just the few that stamp it
    // themselves. The id is a property of the rule, so this is its single
    // source of truth; conditions that already set it are left untouched.
    const ruleId = ctx.metadata.id
    for (const v of result) {
      if (v.ruleId === undefined) v.ruleId = ruleId
    }
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
