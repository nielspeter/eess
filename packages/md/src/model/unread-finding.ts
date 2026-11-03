import type { ArchViolation } from './violation.js'

/**
 * One unread finding (ADR-021 rule 5): it carries `bypassFilters`, so `.excluding()`, `.warn()`, an
 * exclusion comment and a baseline cannot hide it. The one constructor for every reader that reports
 * what it cannot read (`mentions()`, `links()`, `sections().haveLink()`, `beLinkedBack()`), so none
 * writes the field by hand and forgets it. In `model/`, below the conditions and the builders.
 */
export function unreadFinding(f: {
  readonly ruleId: string
  readonly element: string
  readonly file: string
  readonly line: number
  readonly message: string
  readonly suggestion: string
}): ArchViolation {
  return { rule: f.ruleId, bypassFilters: true, ...f }
}
