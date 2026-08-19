/**
 * The one place that says which kernel exports a dialect need NOT re-export.
 *
 * Two consumers read it and they must never disagree:
 *
 *  - `scripts/lib/family-re-exports.mjs`, behind `npm run check:family`;
 *  - `packages/ts/tests/standalone-surface.test.ts`.
 *
 * They used to hold the same list twice, synced by a comment that said "kept in
 * sync with that file by hand". Plan 0165 Phase 2 moved 30 modules into the
 * kernel and grew one list by 47 names, which is exactly when a hand-synced pair
 * drifts — so the pair became one module instead.
 */

/**
 * Kernel-internal plumbing, exempt on every package (plan 0088's own ratified
 * decision: "implementation detail, not part of the surface a standalone
 * consumer builds against").
 */
export const KERNEL_INTERNAL = new Set([
  'applyFilters',
  'escapeGitHub',
  'hashViolation',
  'writeStderr',
  'registerCacheReset',
  'clearRegisteredCaches',
  'selectionMemo',
])

/**
 * The dialect-family-only surface — plan 0088 Phase 4's named exception. Serves
 * crossvalidate/md's two-sided binding, not a standalone ts user.
 */
export const FAMILY_ONLY = new Set([
  'correspondence',
  'CorrespondenceBuilder',
  'matchSelections',
  'applyFixes',
])

/**
 * ANSI colour helpers — terminal-formatting internals, not programmatic surface.
 */
export const ANSI_INTERNAL = new Set(['bold', 'red', 'dim', 'yellow', 'cyan', 'gray'])

/**
 * Kernel exports that were **eess-ts-private before the split** (plan 0165 Phase 2).
 *
 * The rule: *moving a module's home must not change eess-ts's public API.* Every
 * name here lived in `packages/ts/src/core/` — never exported from
 * `src/index.ts`, so no consumer could reach it — and Phase 2 moved its file into
 * `@nielspeter/eess`. Publishing them now, because a file changed package, would
 * add 47 internals to a public surface that deliberately excluded them.
 *
 * Verified mechanically against `packages/ts/src/index.ts` at 119ba6d (the Phase 1
 * close): none of these was reachable from eess-ts before the move.
 *
 * A name that later becomes part of the standalone surface gets re-exported and
 * REMOVED from here, never left in both. `reportViolations` is the near-term
 * candidate: ADR-008's caller-owns-reporting API arrives on eess-ts's presets in
 * Phase 3.
 */
export const KERNEL_PRIVATE_BEFORE_THE_SPLIT = new Set([
  'DECLARE_INSTEAD',
  'UNSUPPRESSABLE',
  'UNSUPPRESSABLE_MECHANISMS',
  'activeNotice',
  'assertionLessViolation',
  'assertsCardinality',
  'byCodepoint',
  'commentSuppressionNotice',
  'commentSuppressions',
  'countDeclaredGlobs',
  'dedupeConfigFindings',
  'disambiguateIdentities',
  'discoverIdentityRoot',
  'dispatchRule',
  'edgeCoverageNotice',
  'finishPreset',
  'identityCollisions',
  'isAnchored',
  'isArchRuleError',
  'isDescribable',
  'isFaultPosition',
  'isGlobNode',
  'isNullaryCallable',
  'isOpaqueGlob',
  'isProjectRelative',
  'isRecord',
  'isSilent',
  'marksAssertsCardinality',
  'marksOwnEmptyDiscovery',
  'normalizeIdentityText',
  'ownsEmptyDiscovery',
  'presetConstructsNothingViolation',
  'recordCommentSuppression',
  'recordEdgeCoverage',
  'reportViolations',
  'resetCommentSuppression',
  'resetDiffDisclosureForTests',
  'resetEdgeCoverage',
  'resetIdentityCollisions',
  'resetStderrGuardForTests',
  'shallowClone',
  'subjectOf',
  'suppressionNotice',
  'throwIfViolations',
  'toPortablePath',
  'untestedRules',
  'viewsFor',
])
