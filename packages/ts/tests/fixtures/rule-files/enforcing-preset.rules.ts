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
