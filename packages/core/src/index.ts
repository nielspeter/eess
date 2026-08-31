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

// Rule builder, terminal builder, error
export { RuleBuilder } from './rule-builder.js'
export { TerminalBuilder } from './terminal-builder.js'
export type { CollectResult } from './terminal-builder.js'
export { assertsCardinality } from './cardinality.js'
export { ArchRuleError, isArchRuleError, ArchConfigError, isArchConfigError } from './errors.js'
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
export { reportViolations, finishPreset } from './report.js'
export type { ReportMode, ReportOptions, PresetReportOptions } from './report.js'
export type { RuleSeverity, PresetBaseOptions } from './preset-dispatch.js'
// `dispatchRule`'s own parameter type. It was exported from neither entry point
// — callable, unnameable — which is the `correspondence`/`CorrespondenceOptions`
// defect again, on documented preset-authoring API (ADR-006). Found by widening
// the nameability test from "internal-only" to "unreachable from the root".
export type { Dispatchable } from './preset-dispatch.js'

// Cross-validation — bind two element Selections and assert they correspond
export { correspondence, CorrespondenceBuilder } from './correspondence.js'
export type { Selection, ElementInfo, Direction } from './correspondence.js'
// The options types of the two functions above. Behind `/internal` in ADR-011's
// first cut, which left both callable and neither nameable — found in review.
export type { RelationSpec, CorrespondenceOptions, KeyBy } from './correspondence.js'

// Exclusions
export { parseExclusionComments, isExcludedByComment } from './exclusion-comments.js'
export type {
  ExclusionComment,
  ExclusionWarning,
  ParseResult,
  MaskNonComment,
  ParseExclusionOptions,
} from './exclusion-comments.js'
export { silent } from './silent-exclusion.js'
export type { SilentExclusion } from './silent-exclusion.js'

// Baseline & diff-aware
export { withBaseline, generateBaseline, Baseline } from './baseline.js'
export type { BaselineEntry, BaselineFile } from './baseline.js'
export { collectViolations } from './baseline-generator.js'
export { diffAware, DiffFilter } from './diff-aware.js'

// Edge coverage — allowlist conditions disclose when they tested nothing
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
export type {
  ArchJsonViolation,
  ArchJsonSuppression,
  ArchJsonUntestedAllowlist,
  ArchJsonReport,
} from './format-json.js'
export type { CorrespondenceResult } from './correspondence-core.js'
export { setCorrespondence } from './correspondence-core.js'
export type { RuleBuilderLike } from './rule-builder-like.js'

// Glob declaration — the constructors a user-written `definePredicate` needs to
// declare what it matches on. The types are above; these build them. ADR-011's
// first cut moved them behind `/internal` and left `packages/ts/src/index.ts`'s
// comment about them standing over the types alone, so the documented extension
// path required the internal entry point.
export { globAnyOf, globNode } from './glob-site.js'
