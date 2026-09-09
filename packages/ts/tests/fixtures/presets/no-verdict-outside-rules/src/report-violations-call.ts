// RED (call leg alone): `reportViolations` is the LIVE emitter of the three the
// `EMITTERS` regex matches, and until this file existed it was the untested one.
// `wrapper-call.ts` covers `finishPreset` and `legacy-alias-call.ts` covers the
// removed `throwIfViolations`; dropping this alternation changed no test, which
// is the inverse of the gap that fixture was added to close. Found by a testing
// review of the round that added it.
import type { ArchViolation } from '@nielspeter/eess'
import { reportViolations } from './report-violations-wrapper.js'

export function report(violations: ArchViolation[]): void {
  reportViolations(violations)
}
