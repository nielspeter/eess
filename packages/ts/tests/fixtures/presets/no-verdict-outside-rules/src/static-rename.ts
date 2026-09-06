// PROBE for the narrower claim the source comment makes: a STATIC renamed
// import should still be caught by the import leg.
import { finishPreset as done } from '@nielspeter/eess'
export function report(violations: unknown[]): void {
  done(violations)
}
