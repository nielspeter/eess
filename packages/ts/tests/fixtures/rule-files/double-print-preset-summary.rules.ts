// Twin of `double-print-preset.rules.ts`, for the summary-count test.
//
// Byte-distinct on purpose: a rule file module is not reliably re-executed between
// tests in one run, so two tests sharing a fixture means the second asserts over a
// run in which module scope never executed. Measured — sabotaging the fix reddened
// only one of the two tests until this file existed.
//
// A preset enforcing at module scope with NO options — the shape a rule file
// carried over from `@nielspeter/ts-archunit` has, since its `recommended()` took
// no `report` option at all. Bug 0203.
//
// Its own fixture rather than a shared one: a rule file module is not reliably
// re-executed between tests in a run, so a test whose assertion depends on module
// scope actually running needs a file nothing else loads.
import path from 'node:path'
import { project } from '../../../src/index.js'
import { recommended } from '../../../src/presets/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

export default [...recommended(p)]
