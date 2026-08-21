// `enforcing-preset.rules.ts` with the remedy the finding names APPLIED — the same
// preset, same project, plus `report: 'builders'`. Paired with it so a test can
// assert the finding CLEARS, not merely that its text was printed.
//
// The census in `tests/core/every-config-finding-is-classified.test.ts` calls a
// `verified: 'behavioural'` claim one where the stated fix is applied and the
// finding goes away. Without this file the claim was a fire/no-fire pair over two
// different inputs, which is `stated-only`.
import path from 'node:path'
import { project } from '../../../src/index.js'
import { recommended } from '../../../src/presets/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

export default [...recommended(p, { report: 'builders' })]
