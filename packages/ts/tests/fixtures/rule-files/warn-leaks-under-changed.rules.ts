// The one path that still legitimately leaks, exercised under `--changed`.
//
// `executeWarn` writes its advisory (warn-severity) violations directly, and it
// MUST: unlike `.check()`'s, they do not ride the thrown error — the throw carries
// only the configuration findings — so suppressing the write would lose them
// entirely. So a `.warn()` at module scope prints output no CLI-side filter can
// reach, and the notice is genuinely owed.
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
