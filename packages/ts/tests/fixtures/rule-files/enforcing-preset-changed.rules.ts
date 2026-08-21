// Dedicated to the --changed test. A duplicate of `enforcing-preset.rules.ts`
// because a rule file MODULE is shared across tests that name the same fixture,
// and a second test re-importing it does not always re-execute module scope —
// so the preset does not emit, nothing throws, and the assertion silently tests
// a different run. Measured: the --changed test passed in isolation and failed
// in file order for exactly that reason.
//
// A self-executing rule file whose enforcement comes from a PRESET called without
// `report: 'builders'` — the shape a rule file carried over from a tool whose
// presets returned builders will have. Bug 0199.
//
// Its sibling `enforcing-inline.rules.ts` has no preset at all and reaches the same
// finding, which is why the remedy leads with the generic array-export fix and
// offers the preset option second. This fixture is what makes the preset half of
// that message assertable over a file it actually applies to.
import path from 'node:path'
import { project } from '../../../src/index.js'
import { recommended } from '../../../src/presets/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

export default [...recommended(p)]
