// Core — project loader
export { project, workspace, resetProjectCache } from './core/project.js'
export { checkAll } from './core/check-all.js'
export type { ArchProject } from './core/project.js'

// Core — predicate interface & combinators
export type { Predicate } from '@nielspeter/eess'
export { not, and, or } from './core/combinators.js'

// Core — condition interface & violation model
export type { Condition, ConditionContext } from '@nielspeter/eess'
export type { ArchViolation } from '@nielspeter/eess'
export {
  createViolation,
  getElementName,
  getElementFile,
  getElementLine,
} from './core/violation.js'
// Violation semantics an external renderer or aggregator cannot re-derive from
// the `ArchViolation` type alone. `formatViolationsPlain`'s docstring invites
// callers that aggregate violations themselves, and without these two such a
// caller reprints a remedy that is already in the message (the defect 0.23.0
// fixed in our own three renderers) and grades a configuration finding by the
// rule's requested severity (which `severityFor` exists to refuse).
// Re-exported from the kernel since plan 0165 Phase 2 — they are pure, so they
// live in `@nielspeter/eess`, and eess-ts forwards them so a standalone
// installation still sees them (`tests/standalone-surface.test.ts`).

// Core — rule builder, error & metadata
export { RuleBuilder } from './core/rule-builder.js'
export { TerminalBuilder } from './core/terminal-builder.js'
export {
  ArchRuleError,
  isArchRuleError,
  ArchConfigError,
  isArchConfigError,
} from '@nielspeter/eess'
export type { RuleMetadata } from '@nielspeter/eess'
export type { RuleDescription } from '@nielspeter/eess'

// Core — code frame & formatting
export { generateCodeFrame } from '@nielspeter/eess'
export type { CodeFrameOptions } from '@nielspeter/eess'
export { formatViolations, formatViolationsPlain } from '@nielspeter/eess'
export type { FormatOptions } from '@nielspeter/eess'

// Core — custom predicate/condition factories
export { definePredicate, defineCondition } from '@nielspeter/eess'

// Glob declaration model (plan 0069). Exported because a user-written
// predicate must be able to declare its globs — otherwise it is permanently
// opaque, and any `or()` containing it can never be diagnosed.
//
// The two CONSTRUCTORS belong here as much as the types do. ADR-011's first cut
// moved them behind `@nielspeter/eess/internal` and left this comment standing
// over types alone — so the documented path (`definePredicate` + declare your
// globs) required the internal entry point. Found in review.
export { globNode, globAnyOf } from '@nielspeter/eess'
export type {
  DeclaredGlob,
  DeclaredGlobs,
  GlobBase,
  GlobKind,
  GlobNode,
  GlobPosition,
  GlobSite,
  GlobTree,
  OpaqueGlob,
} from '@nielspeter/eess'

// In-process diagnostics (plan 0069 R2a). The vitest-facing half of `doctor`:
// rules written inside tests are a co-equal documented path, and a CLI-only
// diagnostic would leave half the users unable to measure before R3.
export type { DiagnosableRule, DiagnosticFinding } from './core/diagnose.js'
export { diagnose } from './core/diagnose.js'

// Identity predicates
export type { Named, Located, Exportable } from './predicates/index.js'
export {
  haveNameMatching,
  haveNameStartingWith,
  haveNameEndingWith,
  resideInFile,
  resideInFolder,
  havePathMatching,
  areExported,
  areNotExported,
} from './predicates/index.js'

// Structural conditions
export {
  resideInFile as conditionResideInFile,
  resideInFolder as conditionResideInFolder,
  haveNameMatching as conditionHaveNameMatching,
  beExported,
  notExist,
} from './conditions/structural.js'

// Module predicates
export {
  importFrom,
  notImportFrom as predicateNotImportFrom,
  exportSymbolNamed,
} from './predicates/module.js'

// Dependency conditions
export type { ImportOptions } from './core/import-options.js'
export { isTypeOnlyImport } from './core/import-options.js'
export {
  onlyImportFrom,
  notImportFrom as conditionNotImportFrom,
  onlyHaveTypeImportsFrom,
  notHaveAliasedImports,
  dependOn,
} from './conditions/dependency.js'

// Module entry point
export { modules, ModuleRuleBuilder } from './builders/module-rule-builder.js'

// Class entry point
export { classes, ClassRuleBuilder } from './builders/class-rule-builder.js'

// Class predicates (standalone)
export {
  extend,
  implement,
  haveDecorator,
  haveDecoratorMatching,
  areAbstract,
  haveMethodNamed as classHaveMethodNamed,
  haveMethodMatching,
  havePropertyNamed,
} from './predicates/class.js'

// Class conditions (standalone)
export {
  shouldExtend,
  shouldImplement,
  shouldHaveMethodNamed,
  shouldNotHaveMethodMatching,
  acceptParameterOfType as classAcceptParameterOfType,
  notAcceptParameterOfType as classNotAcceptParameterOfType,
} from './conditions/class.js'

// Function entry point
export { functions, FunctionRuleBuilder } from './builders/function-rule-builder.js'
export type { ArchFunction } from './models/arch-function.js'
export {
  collectFunctions,
  fromFunctionDeclaration,
  fromFunctionInitializerDeclaration,
  fromArrowVariableDeclaration,
  fromMethodDeclaration,
} from './models/arch-function.js'
export type { FunctionCollectionOptions } from './models/arch-function.js'
export type { ObjectLiteralFunction } from './core/object-literal-functions.js'

// Function predicates
export {
  arePublic,
  areProtected,
  arePrivate,
  areAsync,
  areNotAsync,
  haveParameterCount,
  haveParameterCountGreaterThan,
  haveParameterCountLessThan,
  haveParameterNamed,
  haveReturnType,
  haveRestParameter,
  haveOptionalParameter,
  haveParameterOfType,
  haveParameterNameMatching,
} from './predicates/function.js'

// Function conditions
export {
  notExist as functionNotExist,
  beExported as functionBeExported,
  beAsync as functionBeAsync,
  haveNameMatching as functionHaveNameMatching,
  acceptParameterOfType as functionAcceptParameterOfType,
  notAcceptParameterOfType as functionNotAcceptParameterOfType,
  haveReturnTypeMatching as functionHaveReturnTypeMatching,
} from './conditions/function.js'

// Type entry point
export { types, TypeRuleBuilder } from './builders/type-rule-builder.js'

// Type predicates
export type { TypeDeclaration } from './predicates/type.js'
export {
  areInterfaces,
  areTypeAliases,
  haveProperty,
  havePropertyOfType,
  extendType,
} from './predicates/type.js'

// Type-level conditions
export { havePropertyType } from './conditions/type-level.js'

// Member property conditions (plan 0030)
export {
  havePropertyNamed as conditionHavePropertyNamed,
  notHavePropertyNamed as conditionNotHavePropertyNamed,
  havePropertyMatching as conditionHavePropertyMatching,
  notHavePropertyMatching as conditionNotHavePropertyMatching,
  haveOnlyReadonlyProperties,
  maxProperties,
} from './conditions/members.js'

// Re-export the PropertyBearingNode type for custom condition authors
export type { PropertyBearingNode } from './conditions/members.js'

// Type matchers
export type { TypeMatcher } from './helpers/type-matchers.js'
export {
  isString,
  isNumber,
  isBoolean,
  isUnionOfLiterals,
  isStringLiteral,
  arrayOf,
  matching,
  exactly,
} from './helpers/type-matchers.js'

// Body analysis helpers (plan 0011 + 0046)
export {
  call,
  access,
  newExpr,
  expression,
  property,
  comment,
  jsxElement,
  jsxText,
  typeAssertion,
  nonNullAssertion,
  STUB_PATTERNS,
} from './helpers/matchers.js'
export type { ExpressionMatcher, TypeAssertionOptions } from './helpers/matchers.js'

// Body analysis conditions (for advanced composition)
export {
  classContain,
  classNotContain,
  classUseInsteadOf,
  classNotHaveEmptyBody,
} from './conditions/body-analysis.js'
export {
  functionContain,
  functionNotContain,
  functionUseInsteadOf,
  functionNotHaveEmptyBody,
} from './conditions/body-analysis-function.js'
export {
  moduleContain,
  moduleNotContain,
  moduleUseInsteadOf,
} from './conditions/body-analysis-module.js'
export type { ModuleBodyOptions } from './helpers/body-traversal.js'

// Export conditions (plan 0041 phase 3)
export { notHaveDefaultExport, haveDefaultExport, haveMaxExports } from './conditions/exports.js'

// Reverse dependency conditions (plan 0041 phase 4)
export {
  onlyBeImportedVia,
  beImported,
  haveNoUnusedExports,
} from './conditions/reverse-dependency.js'

// Slice model (plan 0012)
export type { Slice, SliceDefinition } from './models/slice.js'

// Slice conditions
export { beFreeOfCycles, respectLayerOrder, notDependOn } from './conditions/slice.js'

// Slice entry point
export { slices, SliceRuleBuilder } from './builders/slice-rule-builder.js'

// Check options
export type { CheckOptions, OutputFormat } from '@nielspeter/eess'

// Output formats
export { formatViolationsJson } from '@nielspeter/eess'
export type {
  ArchJsonReport,
  ArchJsonViolation,
  ArchJsonSuppression,
  ArchJsonUntestedAllowlist,
} from '@nielspeter/eess'
export { formatViolationsGitHub } from '@nielspeter/eess'
export { detectFormat, isCI } from '@nielspeter/eess'

// Baseline mode
export { withBaseline, generateBaseline, Baseline } from './helpers/baseline.js'
// The shape `generateBaseline` returns. Exported because `docs/setup-best-practices.md`
// teaches a ratchet gate that reads it, and a documented return type needs a name.
export type { BaselineDelta } from './helpers/baseline.js'
export type { BaselineEntry, BaselineFile, BaselineOptions } from './helpers/baseline.js'

// Diff-aware mode
export { diffAware, DiffFilter } from './helpers/diff-aware.js'

// Exclusion comments
export { parseExclusionComments, isExcludedByComment } from './core/exclusion-comments.js'
export type { ExclusionComment, ExclusionWarning, ParseResult } from './core/exclusion-comments.js'

// Silent exclusion wrapper
export { silent } from '@nielspeter/eess'
export type { SilentExclusion } from '@nielspeter/eess'

// Baseline generation helper
export { collectViolations } from './helpers/baseline-generator.js'

// Call entry point (plan 0014)
export { calls, CallRuleBuilder } from './builders/call-rule-builder.js'
export type { ArchCall } from './models/arch-call.js'
export { fromCallExpression } from './models/arch-call.js'

// Call predicates (standalone)
export { onObject, withMethod, withArgMatching, withStringArg } from './predicates/call.js'

// Call conditions (standalone)
export {
  haveCallbackContaining as callHaveCallbackContaining,
  notHaveCallbackContaining as callNotHaveCallbackContaining,
  notExist as callNotExist,
  haveArgumentWithProperty,
  notHaveArgumentWithProperty,
  haveArgumentContaining as callHaveArgumentContaining,
  notHaveArgumentContaining as callNotHaveArgumentContaining,
} from './conditions/call.js'

// Scoped rules --- within() (plan 0015)
export { within } from './builders/within.js'
export type { ScopedContext } from './builders/within.js'
export { ScopedFunctionRuleBuilder } from './builders/scoped-function-rule-builder.js'

// Callback extraction (plan 0015)
export { extractCallbacks } from './helpers/callback-extractor.js'
export type { ExtractedCallback } from './helpers/callback-extractor.js'

// Pattern templates (plan 0017)
export { definePattern } from './helpers/pattern.js'
export type { ArchPattern, PropertyConstraint } from './helpers/pattern.js'
export { followPattern } from './conditions/pattern.js'

// Smell detectors (plan 0018)
export { smells } from './smells/index.js'
export { SmellBuilder } from './smells/smell-builder.js'
export { tsconfig } from './tsconfig/index.js'
export { TsconfigBuilder } from './tsconfig/tsconfig-builder.js'
export { DuplicateBodiesBuilder } from './smells/duplicate-bodies.js'
export { InconsistentSiblingsBuilder } from './smells/inconsistent-siblings.js'
export type { Fingerprint } from './smells/fingerprint.js'
export { buildFingerprint, computeSimilarity } from './smells/fingerprint.js'
export { variationBetween } from './smells/variation.js'
export type { Variation, VariationAxis } from './smells/variation.js'

// Cross-layer validation (plan 0022)
export type { Layer, LayerPair } from './models/cross-layer.js'
export type { PairCondition } from './core/pair-condition.js'
export { crossLayer, CrossLayerBuilder } from './builders/cross-layer-builder.js'
export {
  haveMatchingCounterpart,
  haveConsistentExports,
  satisfyPairCondition,
} from './conditions/cross-layer.js'

// Correspondence / coverage primitive (proposal 017)
export {
  crossProject,
  CrossProjectBuilder,
  byName,
  byArg,
  byPropertyNames,
} from './builders/correspondence-builder.js'
export type { KeyFn, KeysSource } from './builders/correspondence-builder.js'
export { setCorrespondence } from '@nielspeter/eess'
export type { CorrespondenceResult } from '@nielspeter/eess'

// Metric predicates (plan 0028)
export {
  haveCyclomaticComplexity,
  haveMoreLinesThan,
  haveMoreMethodsThan,
  haveComplexity,
  haveMoreFunctionLinesThan,
} from './predicates/metrics.js'

// Complexity calculator (for custom rules)
export { cyclomaticComplexity, linesOfCode } from './helpers/complexity.js'

// Standard rules — security function/module variants (plan 0042)
export {
  noEval,
  noFunctionConstructor,
  noProcessEnv,
  noConsoleLog,
  noConsole,
  noJsonParse,
  functionNoEval,
  functionNoFunctionConstructor,
  functionNoProcessEnv,
  functionNoConsoleLog,
  functionNoConsole,
  functionNoJsonParse,
  moduleNoEval,
  moduleNoProcessEnv,
  moduleNoConsoleLog,
} from './rules/security.js'

// Standard rules — error function variants (plan 0042)
export {
  noGenericErrors,
  noTypeErrors,
  functionNoGenericErrors,
  functionNoTypeErrors,
  noSilentCatch,
  functionNoSilentCatch,
  moduleNoSilentCatch,
} from './rules/errors.js'

// Standard rules — architecture (plan 0042)
export { mustCall, classMustCall } from './rules/architecture.js'

// Standard rules — hygiene (plan 0042)
export { noDeadModules, noUnusedExports, noStubComments, noEmptyBodies } from './rules/hygiene.js'

// JSX entry point (proposal 010)
export { jsxElements, JsxRuleBuilder } from './builders/jsx-rule-builder.js'
export type { ArchJsxElement } from './models/arch-jsx-element.js'
export { collectJsxElements, STANDARD_HTML_TAGS } from './models/arch-jsx-element.js'

// JSX predicates (standalone)
export {
  areHtmlElements,
  areComponents,
  withAttribute as jsxWithAttribute,
  withAttributeMatching as jsxWithAttributeMatching,
} from './predicates/jsx.js'

// JSX conditions (standalone)
export {
  notExist as jsxNotExist,
  haveAttribute as jsxHaveAttribute,
  notHaveAttribute as jsxNotHaveAttribute,
  haveAttributeMatching as jsxHaveAttributeMatching,
  notHaveAttributeMatching as jsxNotHaveAttributeMatching,
} from './conditions/jsx.js'

// CLI config (plan 0020)
export { defineConfig } from './cli/config.js'
export type { CliConfig } from './cli/config.js'

export { orphanExclusions } from './core/orphan-exclusions.js'
export type { OrphanExclusion } from './core/orphan-exclusions.js'

// Kernel types that appear in eess-ts's OWN public signatures, re-exported so a
// standalone install can name them (plan 0165 Phase 2, `check:family`):
// `Selection`/`ElementInfo` are `RuleBuilder.select()`'s param and return types,
// `RuleBuilderLike` is what `loadRuleFiles` and every preset returns, and
// `EdgeCoverage`/`GlobLeaf` surface through the diagnostic types below.
export type {
  Selection,
  ElementInfo,
  RuleBuilderLike,
  EdgeCoverage,
  GlobLeaf,
  // `report` on every preset's options (ADR-008, restored in plan 0165 Phase 3).
  ReportMode,
} from '@nielspeter/eess'

// ─── Restored published surface — plan 0165 Phase 3 ──────────────────────────
//
// Every name below was exported by `@nielspeter/eess-ts` before the engine copy
// and stopped being exported by it. Removing a published export is a BREAKING
// change; re-exporting is additive, so the burden of justification sits on the
// removal, not on keeping them. Verified against `packages/ts/src/index.ts` at
// 3b851d2 — the last commit before the copy — rather than against the baseline
// the copy had already damaged. (Phase 2's exclusion list made exactly that
// mistake, and its record says so.)
export { rootFromTsConfigPath, rootOf, relativeToRoot } from './core/project-relative.js'
export { syntacticFault } from './core/glob-diagnosis.js'
export { dispatchRule, throwIfViolations, finishPreset } from '@nielspeter/eess'
export type {
  RuleSeverity,
  PresetBaseOptions,
  PresetReportOptions,
  ReportOptions,
} from '@nielspeter/eess'
// The remainder of the pre-copy surface (same rule as the block above): these
// were public in eess-ts before the engine copy, so their absence is a break,
// not a cleanup.
export { assertsCardinality, reportViolations } from '@nielspeter/eess'

// ─── Restored published surface, round 2 — PR #72 review ─────────────────────
//
// 22 names exported by `@nielspeter/eess-ts` on `main` stopped being exported by
// it on this branch. Found independently by the product and devops reviewers of
// PR #72, and confirmed by parsing this file at both refs.
//
// My own parse initially said 23 and included `ReportMode`, which is a false
// positive: it is re-exported above, inside a multi-line `export type` block
// whose `//` comment broke the comma-split my throwaway parser used. `tsc` caught
// it as a duplicate identifier. Recorded because the reviewers did NOT claim that
// name — the tool did, and a review that inherits a tool's error is worse than
// no tool.
//
// The block above claims this was already "verified against 3b851d2". That
// verification was real but narrower than its wording: it restored the KERNEL
// names eess-ts used to forward, and never covered eess-ts's own local exports
// or kernel TYPE-only exports. `standalone-surface.test.ts` could not catch the
// difference — it uses `import * as ns`, so it sees values only, and its own
// docstring names `CollectResult` and `Matcher` as blind spots. Both are here.
//
// Same rule as the block above, applied consistently: removing a published
// export is breaking, re-exporting is additive, so the burden sits on the
// removal. TWO are not restored because their implementations were deleted, not
// merely unexported: `GlobDiagnosis` and `diagnoseDeadGlobs` (its whole module,
// `core/dead-glob.ts`). Those are a real break, declared as one in the changeset
// rather than papered over here.
//
// (An earlier draft of this comment said "three of the 23" and then named two.
// The 23rd was `ReportMode`, which my parse wrongly reported as removed — see
// above — so the population is 22 and the unrestored count is 2.)
export type { BaselineFilter, DiffFilterLike, Matcher, UntestedReason } from '@nielspeter/eess'
export type { CollectResult } from './core/terminal-builder.js'
export type { DiskSet, OnDisk } from './core/disk-set.js'
export { diskSet } from './core/disk-set.js'
export type { GlobFault } from './core/glob-diagnosis.js'
export { pathUniverse } from './core/path-universe.js'
export { validateOverrides } from './presets/shared.js'
export { STRICT_FAMILY_SIZE } from './tsconfig/strict-family.js'
export type { StrictFamilyFlag } from './tsconfig/strict-family.js'

// The preset delivery mode, so an adopter writing `report: 'builders'` can name
// the type. Deliberately a dialect type rather than a widening of the kernel's
// `ReportMode`: `'builders'` suppresses the run instead of choosing an emission
// mode, and the kernel's `finishPreset` must never receive it.
export type { PresetDelivery } from './presets/shared.js'
