// `checkAll()` at module scope — the THIRD leaking path, and the one that made the
// ts-side emission counter unfalsifiable until this fixture existed.
//
// `core/check-all.ts` calls `writeReport` unconditionally, ignoring
// `callerAggregatesReports` — the same defect `executeCheck` was fixed for in bug
// 0201, three files away in the same package. It then throws, so the CLI's catch
// runs and the notice is owed.
//
// Sabotage-measured: with no test on this path, deleting the counter increment in
// `writeReport` left the whole suite green (margin 0).
import path from 'node:path'
import { project, functions, checkAll } from '../../../src/index.js'

const p = project(path.join(import.meta.dirname, '../poc/tsconfig.json'))

checkAll([
  functions(p)
    .that()
    .haveNameMatching(/^parse/)
    .should()
    .notExist(),
])
