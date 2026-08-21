// A SELF-EXECUTING rule file whose rule finds REAL violations and calls its own
// terminal — the shape a preset produces when called without `report: 'builders'`
// (`recommended(p)` runs its builders, emits, then throws). Bug 0199.
//
// The terminal emits the violations itself and then throws, so those findings
// never reach the CLI's collection — and therefore never reach `--baseline`.
//
// DO NOT convert this to an array export: enforcing at module scope is the
// property under test. `baselined-inline.rules.ts` next door is its array twin,
// used only to generate a baseline holding the same violations.
import path from 'node:path'
import { project, functions } from '../../../src/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

functions(p)
  .that()
  .haveNameMatching(/^parse/)
  .should()
  .notExist()
  .check()
