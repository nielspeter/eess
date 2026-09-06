// GREEN only when named in `ruleFiles` — the gate-script shape this repo ships
// five of. It calls an emitter legitimately, and it is not a *.rules.ts file.
import { finishPreset } from '@nielspeter/eess'
import { docs } from '@nielspeter/eess-md'

const violations = docs('work/**')
finishPreset(violations)
