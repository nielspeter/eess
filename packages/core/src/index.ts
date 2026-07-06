// @nielspeter/eess — the dialect-independent kernel.
//
// RuleBuilder<T, P>, Predicate<T>, Condition<T>, the violation model, baseline
// and diff-aware machinery, exclusions, formatters, and the definePredicate /
// defineCondition extension points. Nothing here depends on ts-morph or any
// dialect-specific parser.

// Predicate & condition interfaces
export type { Predicate } from './predicate.js'
export type { Condition, ConditionContext } from './condition.js'
export { not, and, or } from './combinators.js'
export type { Matcher } from './combinators.js'

// Violation model
export type { ArchViolation, ArchFix } from './violation.js'
export { applyFixes } from './apply-fixes.js'
export type { ApplyResult } from './apply-fixes.js'

// Rule builder, terminal builder, error
export { RuleBuilder } from './rule-builder.js'
export { TerminalBuilder } from './terminal-builder.js'
export { ArchRuleError } from './errors.js'
export type { RuleMetadata } from './rule-metadata.js'
export type { RuleDescription } from './rule-description.js'

// Code frame & formatting
export { generateCodeFrame } from './code-frame.js'
export type { CodeFrameOptions } from './code-frame.js'
export { formatViolations, formatViolationsPlain } from './format.js'
export type { FormatOptions } from './format.js'
export { formatViolationsJson } from './format-json.js'
export { formatViolationsGitHub } from './format-github.js'

// Check options & environment
export type { CheckOptions, OutputFormat, BaselineFilter, DiffFilterLike } from './check-options.js'
export { detectFormat, isCI } from './environment.js'

// Custom predicate/condition factories
export { definePredicate, defineCondition } from './define.js'

// Preset dispatch — generic per-rule severity/override infrastructure for presets
export { dispatchRule, validateOverrides, throwIfViolations } from './preset-dispatch.js'
export type { RuleSeverity, PresetBaseOptions } from './preset-dispatch.js'

// Matching engine — shared by correspondence() and eess-ts's crossLayer
export { matchSelections } from './matching.js'
export type { Pair, MatchResult, MatchOptions } from './matching.js'

// Cross-validation — bind two element Selections and assert they correspond
export { correspondence, CorrespondenceBuilder } from './correspondence.js'
export type {
  Selection,
  ElementInfo,
  Direction,
  RelationSpec,
  CorrespondenceOptions,
  KeyBy,
} from './correspondence.js'

// Lower-level building blocks (used by dialects and covered by kernel tests)
export { applyFilters } from './execute-rule.js'
export { escapeGitHub } from './format-github.js'
export { hashViolation } from './baseline.js'
export { bold, red, dim, yellow, cyan, gray } from './ansi.js'

// Exclusions
export { parseExclusionComments, isExcludedByComment } from './exclusion-comments.js'
export type { ExclusionComment, ExclusionWarning, ParseResult } from './exclusion-comments.js'
export { silent } from './silent-exclusion.js'
export type { SilentExclusion } from './silent-exclusion.js'

// Baseline & diff-aware
export { withBaseline, generateBaseline, Baseline } from './baseline.js'
export type { BaselineEntry, BaselineFile } from './baseline.js'
export { collectViolations } from './baseline-generator.js'
export { diffAware, DiffFilter } from './diff-aware.js'
