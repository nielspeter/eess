// @nielspeter/eess/internal — family plumbing (ADR-011).
//
// NOT public API. These symbols exist so the sibling dialects can share the
// kernel's engine without each reimplementing it; a consumer writing rules never
// names them, and nothing here is taught by `docs/` or a package README.
//
// The boundary is enforced on this side of the line only: a dialect may import
// from here, and its barrel must never re-export what it finds. It cannot be
// enforced on the consumer's side — a subpath export is published and resolvable
// by anyone, which ADR-011's Enforcement table records as `manual` rather than
// pretending otherwise.
//
// Moving a symbol OUT of here and onto the root is additive. Moving one IN is a
// breaking change and needs a changeset that says so.

export type { ApplyResult } from './apply-fixes.js'
export type { Describable } from './rule-description.js'
export type { OnDisk, DiskSet } from './disk-set.js'
export type { Pair, MatchResult, MatchOptions } from './matching.js'
export { DECLARE_INSTEAD } from './unsuppressable.js'
export { UNSUPPRESSABLE } from './unsuppressable.js'
export { UNSUPPRESSABLE_MECHANISMS } from './unsuppressable.js'
export { applyFilters } from './execute-rule.js'
export { applyFixes } from './apply-fixes.js'
export { assertionLessViolation } from './terminal-builder.js'
export { bold, red, dim, yellow, cyan, gray } from './ansi.js'
export { byCodepoint, severityFor, remedyRepeatsMessage } from './violation.js'
export { dedupeConfigFindings } from './dedupe-config-findings.js'
export { disambiguateIdentities } from './violation.js'
export { discoverIdentityRoot, normalizeIdentityText } from './identity-root.js'
export { escapeGitHub } from './format-github.js'
export { hashViolation } from './baseline.js'
export { identityCollisions } from './violation.js'
export { isAnchored, isProjectRelative } from './project-relative.js'
export { isDescribable } from './rule-description.js'
export {
  isFaultPosition,
  countDeclaredGlobs,
  isGlobNode,
  isOpaqueGlob,
  stampGlobs,
  negateGlobs,
  combineGlobs,
} from './glob-site.js'
export { isRecord, isNullaryCallable } from './type-guards.js'
export { isSilent } from './silent-exclusion.js'
export { marksAssertsCardinality } from './cardinality.js'
export { marksOwnEmptyDiscovery, ownsEmptyDiscovery } from './owns-empty-discovery.js'
export { matchSelections } from './matching.js'
export { presetConstructsNothingViolation } from './preset-dispatch.js'
export {
  recordEdgeCoverage,
  untestedRules,
  edgeCoverageNotice,
  resetEdgeCoverage,
} from './edge-coverage.js'
export { registerCacheReset, clearRegisteredCaches } from './cache-registry.js'
export {
  resetCommentSuppression,
  recordCommentSuppression,
  commentSuppressions,
  commentSuppressionNotice,
} from './comment-suppression.js'
export { resetIdentityCollisions } from './violation.js'
export { resetStderrGuardForTests } from './stderr.js'
export { selectionMemo } from './selection-memo.js'
export { shallowClone } from './shallow-clone.js'
export { subjectOf } from './violation.js'
export { suppressionNotice, activeNotice, resetDiffDisclosureForTests } from './diff-disclosure.js'
export { toPortablePath } from './identity-root.js'
export { viewsFor } from './path-universe.js'
export { violationsEmittedCount } from './report.js'
export { writeStderr } from './stderr.js'

// Watch-mode scheduling and the watch loop, shared by every dialect CLI. Family
// plumbing rather than public API (ADR-011): a consumer writing rules never
// calls this; a dialect's `--watch` does. Unified here because the two copies
// drifted and one of them kept a bug the other had fixed — see `watch.ts`.
export { RunScheduler, watchAndRerun } from './watch.js'
export type { WatchOptions } from './watch.js'

// The dialect-independent halves of CLI config handling — finding the file,
// validating what a loaded module claims, and classifying Node's module-format
// refusal. Family plumbing (ADR-011): a consumer writing rules never calls
// these; every dialect's CLI does, and did so from its own copy until now.
export {
  findConfigFile,
  extractSharedConfig,
  isModuleFormatRefusal,
  requireRuleFiles,
} from './cli-config.js'
export type { SharedCliConfig } from './cli-config.js'

// Recursive file discovery for the dialects that read a directory tree rather
// than a TypeScript project (`eess-md`, `eess-crossvalidate`). Each carried its
// own copy at 99% similarity.
export { walkFiles, toPosix } from './file-walk.js'

// The globs a rule declares, stamped with their origin. Family plumbing — a
// dialect's own rule-declaration layer calls it; a consumer writing rules does not.
export { declaredGlobsOf } from './rule-builder.js'

// Recording exclusion patterns into a builder's state. Family plumbing: the
// dialects' builders call it, a consumer writing rules does not.
export { recordExclusions } from './silent-exclusion.js'

// Applying a rule's predicates to its elements. Family plumbing: the dialects'
// builders call it, a consumer writing rules does not.
export { selectMatching } from './correspondence.js'

// Recording a predicate on a builder, diagnosing one that arrived after
// `.should()`. Family plumbing.
export { recordPredicate } from './predicate.js'
