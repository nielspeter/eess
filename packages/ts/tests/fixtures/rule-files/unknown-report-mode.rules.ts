// A preset enforcing at module scope with a misspelt `report` mode — bug 0508.
//
// The shape a JavaScript rule file, or a mode read from config, reaches: nothing
// type-checks the value. Before the fix, `finishPreset` printed the violations,
// threw nothing, and `eess-ts check` exited 0 over them (measured before the fix).
//
// Its own fixture: a rule file module is not reliably re-executed between tests
// in one run (see `double-print-preset-summary.rules.ts`).
import path from 'node:path'
import { project } from '../../../src/index.js'
import { recommended } from '../../../src/presets/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))
const clean = project(path.join(import.meta.dirname, '../poc-clean/tsconfig.json'))

// @ts-expect-error — the misspelling TypeScript catches and a JavaScript caller does not.
recommended(p, { report: 'thorw' })

// A clean export, so the only thing that can fail the run is the misspelt mode.
export default [...recommended(clean, { report: 'builders' })]
