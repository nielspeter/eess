# Bug 0356: `project()` memoizes for process lifetime, so one module-scope `export const` builds every project in the file

## Status

- **State:** Draft — measured by an adopter on their own tree, mechanism confirmed
  against our source.
- **Severity:** Medium — **no wrong verdict; a capacity footgun with no way to see
  it coming.** The documented, natural way to organise a monorepo's projects — a
  `projects.ts` exporting one named handle per package — constructs _every_ ts-morph
  Program the moment _any_ of them is imported, and nothing releases them for the
  rest of the process.
- **Origin:** inbound — an adopter, following up on
  [spike 0345](../spikes/0345-what-it-costs-to-load-a-monorepo.md). They diagnosed
  the mechanism themselves: "the module-scope `project()` calls in `projects.ts` ran
  on ANY import and filled eess's process-wide cache in the first file."
- **Reported:** 2026-09-28

## Symptom

An adopter's root architecture suite, fifteen `project()` handles plus one
`workspace()`, all as module-level `export const`. Peak RSS, `/usr/bin/time -l`,
macOS, eess-ts 0.8.0:

| configuration                                                             | peak RSS                       |
| ------------------------------------------------------------------------- | ------------------------------ |
| as written — module-scope `export const`                                  | 4.98 GiB / 6.29 GiB (two runs) |
| **lazy stand-ins + `resetProjectCache()` where the loops switch project** | **3.49 GiB**                   |

**1.49 GiB below the lower of their two baselines**, with the finding set identical,
compared per violation. It is the only change in their measurement series whose
effect exceeds their own run-to-run spread (1.31 GiB across two baseline runs), so
it is the only one that can be called a result rather than noise.

## Root cause

Two behaviours, each reasonable alone.

1. **`project()` memoizes on the resolved tsconfig path for the life of the
   process** (`packages/ts/src/core/project.ts`). A cache hit returns the same
   `ArchProject`, and the entry is never evicted; only `resetProjectCache()` clears
   it, and that is documented for watch mode and test isolation.
2. **A module-level `export const` is evaluated on import**, not on use. So a rule
   file importing `projects.ts` for one handle evaluates every `project()` call in
   it.

Together: importing the module for one package's rules constructs all fifteen
Programs, and the cache then holds them for the rest of the run. Under a single
vitest fork — which adopters are told to use so the module cache is reused — that
is the whole suite's peak, in the first file that imports anything.

Nothing in the API surface shows this. `project()` reads as a lookup, the
memoization reads as an optimisation, and the cost is paid by a file the author did
not write.

## Fix

Not decided. Candidates, cheapest first:

- **Document it.** One paragraph wherever a multi-package `projects.ts` is
  suggested, naming the lazy-getter shape and `resetProjectCache()`. Zero risk,
  and it only helps the adopter who reads it.
- **Make the natural spelling lazy.** A `projects({ api: '…/tsconfig.json', … })`
  helper returning lazy accessors, so the obvious way to write the file is also the
  cheap one. The footgun is that `export const x = project(p)` is the obvious
  spelling and it is the expensive one; moving the obvious spelling is the fix that
  does not depend on reading docs.
- **Evict.** A cache that releases a project nothing holds. Harder than it looks —
  the memoized element collections and module edges are keyed on the `ArchProject`
  identity (plan 0075/0076), so eviction has to be coordinated, and `resetProjectCache()`
  already exists as the coarse version.

**Not a candidate: removing the memoization.** It exists so that a rule file with
fifty rules pays for one Program rather than fifty, and that is the far commoner
shape.

## What this is not

It is **not** the memory finding in spike 0345's "decision this brings back" —
those are about what one Program costs. This is about how many Programs are alive
at once, it is adopter-side, and the adopter's own fix already takes it. The two
are additive: their 3.49 GiB still contains whatever a single Program costs.

## Related

- [spike 0345](../spikes/0345-what-it-costs-to-load-a-monorepo.md) — the measurement
  series this came out of, now carrying the adopter's numbers.
- [0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the other
  record about what a run can say for itself.

## Verification

- [x] the mechanism confirmed against `packages/ts/src/core/project.ts`: memoized on
      the resolved path, cleared only by `resetProjectCache()`.
- [x] the adopter's measurement, and the arithmetic that says it clears their noise
      floor while their other runs do not.
- [ ] a ruling on which candidate
- [ ] a reproduction in this repo's own suite — a fixture with several packages,
      asserting that importing one handle does not construct the others
- [ ] a changeset, or an explicit `none` if the fix is documentation
- [ ] `npm run validate` green.

Deferred: none.
