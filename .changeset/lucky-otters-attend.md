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

A test cites a scenario by its title, `<path>.feature › <Scenario title>`:

```ts
it('checkout.feature › Apply a valid discount code', () => { … })
```

Both `›` and `·` work as the separator. Nothing else is a citation — so if your
suite uses another convention, `scenarioTestsResolve` resolves zero citations and
passes vacuously. Check the denominator: `scenarioTestStats` returns
`{ citations, scenarios }`, and a citation count of zero means the convention did
not match, not that the specs are clean.

Two directions, because each catches a different drift. `scenarioTestsResolve`
fails when a test cites a scenario that has been renamed or deleted — the
citation still reads as proof while proving nothing. `scenariosCovered` fails
when a scenario has no test citing it at all, which is the gap that never
announces itself. Both throw on violations, so a bare call is a gate.

Requires `@nielspeter/eess-gherkin` and `@nielspeter/eess-ts` — optional peers of
this package, so install the ones you use. Coverage is all-or-nothing today:
narrow it with the `include` option (handy for `@wip` scenarios); there is no
baseline ratchet yet.

**This subpath existed in no earlier release.** It has been on `main` and gating
this repo's own `packages/crossvalidate/specs/scenario-binding.feature` since
before `0.1.2`, but a missing release declaration meant the package was never
bumped, so the subpath was absent from every published `exports` map and
importing the documented path failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
