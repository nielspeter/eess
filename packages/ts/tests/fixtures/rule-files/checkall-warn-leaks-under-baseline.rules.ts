// `checkAll()` of WARN rules beside a throwing `.check()`, under a CLI-side filter.
//
// The warn findings ride no throw, so `check-all.ts` must still write them — and
// that write is real unfiltered output the CLI cannot reach, so the "your filters
// did not apply" notice is owed. This is the one path that exercises the DIALECT's
// emission counter (`writeReport`); every other leak in the suite flows through the
// kernel's `reportViolations`, so without this fixture deleting the dialect
// counter's increment leaves the whole suite green.
import path from 'node:path'
import { project, functions, classes, checkAll } from '../../../src/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

checkAll([
  functions(p)
    .that()
    .haveNameMatching(/^parse/)
    .should()
    .notExist()
    .asSeverity('warn'),
])

// Throws, so the CLI's catch runs and the notice can be emitted.
classes(p).that().haveNameMatching(/./).should().notExist().check()
