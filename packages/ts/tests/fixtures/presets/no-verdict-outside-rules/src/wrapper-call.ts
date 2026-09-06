// RED (call leg alone): type-only import, but it calls an emitter through a
// local re-export, so the specifier globs never see it.
import type { ArchViolation } from '@nielspeter/eess'
import { finishPreset } from './local-wrapper.js'

export function report(violations: ArchViolation[]): void {
  finishPreset(violations)
}
