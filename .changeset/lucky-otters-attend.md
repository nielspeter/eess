---
'@nielspeter/eess-crossvalidate': minor
---

New subpath `@nielspeter/eess-crossvalidate/gherkin-ts` — bind `.feature`
scenarios to the tests that prove them, and fail the build when they drift.

```ts
import { scenarioTestsResolve, scenariosCovered } from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'

const specs = features({ cwd: 'specs', roots: ['**/*.feature'] })
const tests = project('tsconfig.json')

scenarioTestsResolve(tests, specs) // every cited scenario exists
scenariosCovered(tests, specs) // every scenario is cited by some test
```

Two directions, because each catches a different drift. `scenarioTestsResolve`
fails when a test cites a scenario that has been renamed or deleted — the
citation still reads as proof while proving nothing. `scenariosCovered` fails
when a scenario has no test citing it at all, which is the gap that never
announces itself. `scenarioTestStats` returns the denominator
(`{ citations, scenarios }`) so a green is provably non-vacuous rather than an
empty glob.

This binding has been on `main` and gating this repo's own
`specs/scenario-binding.feature` since before `0.1.2`, but it shipped in no
released version: the commit that added it carried no changeset, so
`changeset version` never bumped the package and the subpath was absent from
every published `exports` map. Importing the documented path failed with
`ERR_PACKAGE_PATH_NOT_EXPORTED`. It is released now, and `npm run check:release`
gates the omission that hid it (bug 0106).
