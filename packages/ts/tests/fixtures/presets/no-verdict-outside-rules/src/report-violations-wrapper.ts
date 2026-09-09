// Deliberately NOT a violation itself: it re-exports a name, it does not import
// eess. The call leg is what catches its consumer.
export function reportViolations(violations: unknown[]): void {
  if (violations.length > 0) throw new Error('violations')
}
