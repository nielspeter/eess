// Kernel — re-exported from @nielspeter/eess
export type {
  Predicate,
  Condition,
  ConditionContext,
  CodeFrameOptions,
  FormatOptions,
} from '@nielspeter/eess'
export {
  ArchRuleError,
  RuleBuilder,
  generateCodeFrame,
  formatViolations,
  formatViolationsPlain,
  definePredicate,
  defineCondition,
} from '@nielspeter/eess'
// The constructors a custom predicate needs to DECLARE its globs. eess-mermaid
// re-exported `definePredicate` without them, so the documented path (declare
// your globs or be permanently opaque to vacuity diagnosis) was unfollowable
// from a standalone install. eess-ts got these back in review; mermaid is the
// same case and was missed.
export { globNode, globAnyOf } from '@nielspeter/eess'
export type { DeclaredGlob, DeclaredGlobs, GlobKind, GlobBase } from '@nielspeter/eess'

// Mermaid dialect — violation adapter
export type { ArchViolation } from './violation.js'
export { createViolation } from './violation.js'
