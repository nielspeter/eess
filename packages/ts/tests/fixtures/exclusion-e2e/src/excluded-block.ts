// Fixture: two forbidden calls fenced by a block exclusion. Both function
// violations fall within the start/end line range, so with a matching rule id
// `.check()` passes.
// eess-exclude-start test/no-forbidden-call: sanctioned block for the e2e test
export function handlerA(): void {
  forbiddenFn()
}

export function handlerB(): void {
  forbiddenFn()
}
// eess-exclude-end
