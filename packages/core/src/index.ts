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
export { byCodepoint, severityFor, remedyRepeatsMessage } from './violation.js'
export { applyFixes } from './apply-fixes.js'
export type { ApplyResult } from './apply-fixes.js'
export { UNSUPPRESSABLE } from './unsuppressable.js'

// Rule builder, terminal builder, error
export { RuleBuilder } from './rule-builder.js'
export { TerminalBuilder } from './terminal-builder.js'
export type { CollectResult } from './terminal-builder.js'
export { marksAssertsCardinality, assertsCardinality } from './cardinality.js'
export { registerCacheReset, clearRegisteredCaches } from './cache-registry.js'
export { selectionMemo } from './selection-memo.js'
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
export {
  dispatchRule,
  validateOverrides,
  throwIfViolations,
  presetConstructsNothingViolation,
} from './preset-dispatch.js'
export { reportViolations, finishPreset } from './report.js'
export type { ReportMode, ReportOptions, PresetReportOptions } from './report.js'
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
export { discoverIdentityRoot, normalizeIdentityText } from './identity-root.js'
export { writeStderr } from './stderr.js'
export { bold, red, dim, yellow, cyan, gray } from './ansi.js'

// Exclusions
export { parseExclusionComments, isExcludedByComment } from './exclusion-comments.js'
export type { ExclusionComment, ExclusionWarning, ParseResult } from './exclusion-comments.js'
export { silent, isSilent } from './silent-exclusion.js'
export type { SilentExclusion } from './silent-exclusion.js'

// Baseline & diff-aware
export { withBaseline, generateBaseline, Baseline } from './baseline.js'
export type { BaselineEntry, BaselineFile } from './baseline.js'
export { collectViolations } from './baseline-generator.js'
export { diffAware, DiffFilter } from './diff-aware.js'

// Edge coverage — allowlist conditions disclose when they tested nothing
export {
  recordEdgeCoverage,
  untestedRules,
  edgeCoverageNotice,
  resetEdgeCoverage,
} from './edge-coverage.js'
export type { UntestedReason, EdgeCoverage } from './edge-coverage.js'

// Dead-glob diagnosis — declare a glob, and get a specific reason (not just
// "examined zero units") when it can never match. The pure declaration +
// evaluation algebra lives here; the ArchProject-typed materializers
// (pathUniverse()/diskSet()) live in each dialect that has a project type.
export type {
  GlobKind,
  GlobPosition,
  GlobBase,
  DeclaredGlob,
  GlobSite,
  OpaqueGlob,
  GlobLeaf,
  GlobTree,
  DeclaredGlobs,
  GlobNode,
} from './glob-site.js'
export {
  isFaultPosition,
  countDeclaredGlobs,
  isGlobNode,
  isOpaqueGlob,
  globAnyOf,
  globNode,
  stampGlobs,
  negateGlobs,
  combineGlobs,
} from './glob-site.js'
export type { PathUniverse } from './path-universe.js'
export { viewsFor } from './path-universe.js'
export type { OnDisk, DiskSet } from './disk-set.js'
export { isAnchored, isProjectRelative } from './project-relative.js'
export { isRecord, isNullaryCallable } from './type-guards.js'
export { shallowClone } from './shallow-clone.js'
export { suppressionNotice, activeNotice, resetDiffDisclosureForTests } from './diff-disclosure.js'
export {
  resetCommentSuppression,
  recordCommentSuppression,
  commentSuppressions,
  commentSuppressionNotice,
} from './comment-suppression.js'
export { dedupeConfigFindings } from './dedupe-config-findings.js'
export { assertionLessViolation } from './terminal-builder.js'
export { toPortablePath } from './identity-root.js'
export type { Describable } from './rule-description.js'
export { isDescribable } from './rule-description.js'
export { resetStderrGuardForTests } from './stderr.js'
export { DECLARE_INSTEAD } from './unsuppressable.js'
export { UNSUPPRESSABLE_MECHANISMS } from './unsuppressable.js'
export { subjectOf } from './violation.js'
export { identityCollisions } from './violation.js'
export { resetIdentityCollisions } from './violation.js'
export { disambiguateIdentities } from './violation.js'
export { isArchRuleError } from './errors.js'
export type {
  ArchJsonViolation,
  ArchJsonSuppression,
  ArchJsonUntestedAllowlist,
  ArchJsonReport,
} from './format-json.js'
export type { CorrespondenceResult } from './correspondence-core.js'
export { setCorrespondence } from './correspondence-core.js'
export { marksOwnEmptyDiscovery, ownsEmptyDiscovery } from './owns-empty-discovery.js'
export type { RuleBuilderLike } from './rule-builder-like.js'
