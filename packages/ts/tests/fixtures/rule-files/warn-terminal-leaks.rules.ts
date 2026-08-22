// A rule-level `.warn()` with a LIVE selector — the third emitter, and the one the
// leak detector could not see.
//
// `executeWarn` writes its advisory violations through `writeStderr` directly, not
// through `writeReport`, so neither emission counter moved. They ride no throw
// either (the throw carries only the configuration findings), so the CLI never
// collects them. Output leaked past every filter and `violationsWritten()` said
// nothing had been written.
//
// NOT `recommended(p, { report: 'warn' })` — that is the PRESET path, which emits
// through the kernel's counted `reportViolations`. Its sibling fixture
// `warn-leaks-under-changed.rules.ts` used that shape while claiming to exercise
// `executeWarn`, which is why this hole stayed open.
//
// The `.check()` after it throws, so the CLI's catch runs and the notice is due.
import path from 'node:path'
import { project, functions, classes } from '../../../src/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

functions(p)
  .that()
  .haveNameMatching(/^parse/)
  .should()
  .notExist()
  .warn()

classes(p).that().haveNameMatching(/./).should().notExist().check()
