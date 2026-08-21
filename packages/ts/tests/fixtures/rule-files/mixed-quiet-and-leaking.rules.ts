// A rule file that BOTH silences a terminal and leaks through another — the case
// that defeated the first version of bug 0199's trigger.
//
// `report: 'warn'` is a public ReportMode: the preset emits its violations through
// the kernel and does NOT throw. The `.check()` below is silenced by bug 0201's fix
// and DOES throw. So the run has a suppressed write and a real leak at once.
//
// The first trigger read "a write was suppressed" as "nothing was written" and went
// silent over 7 leaked violation blocks. Nothing in the suite held that case, which
// is why this fixture exists.
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
