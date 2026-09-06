// Deliberately NOT a violation itself: it re-exports a name, it does not import
// eess. The point of `wrapper-call.ts` is that the call leg catches what the
// import leg cannot see.
export function finishPreset(violations: unknown[]): void {
  if (violations.length > 0) throw new Error('violations')
}
