// A leak exercised under `--changed`, through the PRESET path.
//
// **This does not exercise `executeWarn`, and its first docblock said it did.** It
// uses `recommended(p, { report: 'warn' })`, which finishes through the kernel's
// `finishPreset` → `reportViolations` — a different emitter from the rule-level
// `.warn()` terminal. That mislabel is why `executeWarn`'s own emit stayed
// uncounted and untested: the fixture that appeared to cover it covered something
// else. The rule-level case is `warn-terminal-leaks.rules.ts`.
//
// What both shapes share, and why the notice is owed either way: warn-severity
// violations ride no throw — the throw carries only the configuration findings —
// so they must be written, and that write is output no CLI-side filter can reach.
//
// The `.check()` after it is what makes the file throw, so the CLI's catch runs.
import path from 'node:path'
import { project, functions } from '../../../src/index.js'
import { recommended } from '../../../src/presets/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

recommended(p, { report: 'warn' })

functions(p)
  .that()
  .haveNameMatching(/^parse/)
  .should()
  .notExist()
  .check()
