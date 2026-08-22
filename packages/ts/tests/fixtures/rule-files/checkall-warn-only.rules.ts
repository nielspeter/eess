// `checkAll()` at module scope with WARN-severity rules — the case that proves the
// aggregation guard must suppress only what rides the throw.
//
// `checkAll` throws only the ERROR-severity subset. So under an aggregating caller
// a guard that suppresses every violation loses the warn ones entirely: written by
// nobody, carried by nothing, under a green tick. Measured before the fix: 4
// findings produced and thrown away.
import path from 'node:path'
import { project, functions, checkAll } from '../../../src/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

checkAll([
  functions(p)
    .that()
    .haveNameMatching(/^parse/)
    .should()
    .notExist()
    .asSeverity('warn'),
])
