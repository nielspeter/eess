// RED (call leg alone): the emitter alias an adopter on an OLDER kernel still
// has. Plan 0263 Phase 5 removed `throwIfViolations` from this kernel's public
// surface and deliberately KEPT it in `agentGuardrails`'s `EMITTERS` regex,
// because this preset runs against an adopter's code, not ours. That argument
// was made at length and nothing tested it: with the symbol absent from this
// repo, deleting the alternation changed no test. This file is that test.
import type { ArchViolation } from '@nielspeter/eess'
import { throwIfViolations } from './legacy-alias-wrapper.js'

export function report(violations: ArchViolation[]): void {
  throwIfViolations(violations)
}
