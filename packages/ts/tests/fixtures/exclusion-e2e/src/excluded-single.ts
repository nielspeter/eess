// Fixture: the same forbidden call, sanctioned by an inline exclusion comment on
// the line directly above the function. This is the exact regression case —
// notContain() builds its violation without stamping ruleId, so before the
// applyFilters fix (which stamps the rule's id onto un-tagged violations) this
// comment matched nothing and the rule still threw.
// eess-exclude test/no-forbidden-call: sanctioned for the e2e test
export function handler(): void {
  forbiddenFn()
}
