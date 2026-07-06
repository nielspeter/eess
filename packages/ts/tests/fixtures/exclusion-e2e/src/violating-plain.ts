// Fixture: a forbidden call with NO exclusion comment. The rule
// `functions().should().notContain(call('forbiddenFn'))` must report a
// violation here, so `.check()` throws.
export function handler(): void {
  forbiddenFn()
}
