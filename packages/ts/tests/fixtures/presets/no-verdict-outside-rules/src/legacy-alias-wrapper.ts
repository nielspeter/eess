// Deliberately NOT a violation itself: it re-exports a name, it does not import
// eess. It stands in for the alias `@nielspeter/eess` published until plan 0263
// Phase 5 — this repo no longer ships `throwIfViolations`, so the only way to
// test that `EMITTERS` still matches the name is to declare one locally.
export function throwIfViolations(violations: unknown[]): void {
  if (violations.length > 0) throw new Error('violations')
}
