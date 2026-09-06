// RED (the anchor): `import * as eess` then `eess.finishPreset(...)`. The
// consuming project's own first version of this rule missed exactly this.
import type { ArchViolation } from '@nielspeter/eess'
import * as eess from './local-wrapper.js'

export function report(violations: ArchViolation[]): void {
  eess.finishPreset(violations)
}
