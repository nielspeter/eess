// The array twin of `enforcing-inline.rules.ts` — same rule, same violations, so
// a baseline generated from this file holds exactly the entries the inline
// version emits. Used to build the baseline in the bug 0199 test.
import path from 'node:path'
import { project, functions } from '../../../src/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

export default [
  functions(p)
    .that()
    .haveNameMatching(/^parse/)
    .should()
    .notExist(),
]
