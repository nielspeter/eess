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

// Mermaid dialect — violation adapter
export type { ArchViolation } from './violation.js'
export { createViolation } from './violation.js'
