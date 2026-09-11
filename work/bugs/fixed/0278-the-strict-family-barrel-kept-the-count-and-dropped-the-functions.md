# Bug 0278: the strict-family barrel kept the count and dropped the functions

## Status

- **State:** Fixed — both functions restored to the `eess-ts` barrel, census rows
  added, red-first against the published `0.5.0`.
- **Severity:** High — it broke a real adopter's primary rule file at module
  load, in the release that shipped it.
- **Origin:** external · found upgrading a consuming project to `v0.5.0`.

## Symptom

`packages/ts/src/tsconfig/strict-family.ts` exports four things. The `v0.5.0`
barrel published two of them:

| export                    | on the 0.5.0 barrel |
| ------------------------- | ------------------- |
| `STRICT_FAMILY_SIZE`      | yes                 |
| `StrictFamilyFlag` (type) | yes                 |
| `isStrictFamily`          | **no**              |
| `resolveFlag`             | **no**              |

So a consumer could name a strict-family flag and count the family, and neither
test whether a key belongs to it nor resolve one against compiler options. The
type and the constant are only useful in the company of the two functions.

## Why it is High and not Medium

ESM resolves named imports at load. An adopter's rule file reading

```ts
import { isStrictFamily, resolveFlag, STRICT_FAMILY_SIZE } from '@nielspeter/eess-ts'
```

does not type-error; it fails to load:

```
SyntaxError: The requested module '@nielspeter/eess-ts'
does not provide an export named 'isStrictFamily'
```

Their `eess-ts check` stopped running entirely. A missing export is not a
degraded feature, it is a dead gate — which is the failure class this project
exists to prevent, shipped by this project.

## Root cause

**Not what this record first said.** The first version blamed applying the
removal criterion per symbol rather than per module, and credited the
published-surface census with catching it. An architecture review measured both
claims false.

**Per-symbol was deliberate and documented.** The removal changeset names
`isStrictFamily` and `resolveFlag` in its own list of nineteen, and states the
principle with an example: "`collectCalls` went while `fromCallExpression` from
the same module stayed … in both cases the survivor is reachable from a
documented path and the removed one was not." Six modules were split that way,
not one. A rule of "all exports of a module or none" would have forced
`buildDiskSet`, `registerProjectRoots` and `collectCalls` back onto the published
barrel, which is plumbing by any reading — it false-positives on most of the
population and would not have caught this case for the right reason.

**And the anomaly here is the survivors, not the casualties.**
`STRICT_FAMILY_SIZE` and `StrictFamilyFlag` are referenced nowhere outside the
package's own `src/` except two tests that reach past the barrel into the source
module, and no page taught them. Under the stated criterion they should have gone
too. Applied _consistently_, it yields none of the four — so restoring all four
is justified by what an adopter needs, not by a coherence property the module
never had.

**The actual root cause is that this is the third time.** `0.4.0` restored twenty
exports an earlier pass had dropped, "found by an adopter review that diffed
every subpath". Eight of those were removed again in `0.5.0`:

```
buildDiskSet, emptyProjectAdvice, globSitesOf, isDeadGlobTree,
isDeadSite, isTypeOnlyReExport, loadedNothing, splitGlobArgs
```

So the criterion — nothing outside this package's `src/` references it, no page
teaches it — has now been applied three times, and each time an adopter has had
to find what it took. It is measured entirely inside this repo, where no adopter
is visible, and it has no memory: a name restored because someone needed it
carries no mark saying so, and the next pass removes it again.

That is the thing worth fixing, and it is larger than this repair.

## Fix

Both functions restored to `packages/ts/src/index.ts` beside the constant, with
the two rows the published-surface census requires.

**The census did not catch the original removal, and cannot.** Its reverse
assertion fires on a _stale_ row — a classification entry with no matching
export. The removal edited both sides in one commit, so the two moved in
lockstep: measured, the census rows went 2 → 0 in the same diff as the export
line. What fired during this repair was the forward direction catching the
restore's own missing bookkeeping. Crediting it with the catch, as an earlier
draft of this record did, is a live gate claimed for a blind one — in a bug
record about a dead gate.

## Verification ledger

- [x] Red first against the **published** `@nielspeter/eess-ts@0.5.0`, not a
      local build: the named import throws `SyntaxError … does not provide an
export named 'isStrictFamily'`.
- [x] Both functions resolve from the barrel after the fix, checked by importing
      the built `dist` from outside the workspace.
- [x] Census rows added; the matrix goes 47/48 to 48/48. The failure it produced
      first — `expected [ '.:isStrictFamily', '.:resolveFlag' ] to deeply equal
[]` — is the reverse-direction assertion doing its job.
- [x] `docs/migrating-to-0.5.md` now lists all 54 removed names. A product review
      of that page predicted this exact failure before it merged, naming
      `resolveFlag` as the example, and the fix at the time was a pointer to the
      changelogs rather than the list. That was not enough.

Deferred: [bug 0279](../0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md)
— the criterion itself. Three passes, three adopter-found regressions, eight
names restored and then removed again. A per-module rule is not the answer;
measurement showed it would false-positive on most of the population. What is
missing is any signal from outside this repo, and any memory that a name was
restored because someone needed it.
