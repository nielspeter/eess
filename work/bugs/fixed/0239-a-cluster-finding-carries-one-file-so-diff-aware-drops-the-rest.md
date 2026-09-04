# Bug 0239: a cluster finding carries one file, so `--changed` drops the duplicate that was just introduced

## Status

- **State:** Fixed — reproduced red, fixed, every half sabotage-verified, and
  independently reviewed on a different model, which reproduced all four
  sabotage claims and found two things this record now carries: the JSON stream
  dropped the new field, and the volume citation was an inert number.
  `Deferred: none` — the one thing left undone is a sibling in the suppression
  path, filed as [0242](./0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md)
  rather than carried here as an open box.
- **Severity:** High — **false green on the most realistic adoption path.** A
  developer copies a body into a second file, runs the gate with `--changed`,
  and is told nothing. Before the pair-to-cluster collapse the same edit
  reported. ADR-009 rule 1's subject: the finding cannot fire where it matters
  most.
- **Origin:** self-found · testing review of the `duplicateBodies` arc after it
  merged (PR #91, 2026-09-03). The arc shipped without a panel because an API
  outage killed every reviewer spawn.
- **Reported:** 2026-09-03

## Symptom

`smells.duplicateBodies()` now reports one violation per **cluster** of mutually
similar bodies instead of one per pair. That violation carries a single `file`:
the anchor's, which is `members[0]`, earliest in walk order
(`packages/ts/src/smells/duplicate-report.ts:101`).

`diffAware()` keeps a violation only when its file is in the changed set
(`packages/core/src/diff-aware.ts:47`):

```js
return violations.filter((v) => v.bypassFilters === true || files.has(v.file))
```

So for a cluster of bodies in files A, B and C, anchored at A:

| the edit                           | before the collapse                      | after                          |
| ---------------------------------- | ---------------------------------------- | ------------------------------ |
| paste the body into B, A untouched | pairs anchored at A **and** B; B reports | one finding, on A; **dropped** |
| edit A                             | reports                                  | reports                        |

The direction is the wrong one. The file a developer just touched is the file
whose duplicate is now invisible, and the anchor is chosen by walk order, so
which member keeps the finding is an accident of the filesystem.

## Reproduction

No test covers cluster output against the diff filter — `grep -c 'diffAware\|DiffFilter' packages/ts/tests/smells/*.ts`
returns zero across the directory. The behaviour is visible by inspection at the
two lines above, and by construction: one `file` field cannot satisfy a filter
keyed on three files.

## Root cause

The collapse was designed against the **output volume** problem (4770 pair
findings became 407 on a production monorepo, an 11.7x reduction — the change is
right) and not against the **filtering** consumers of a violation's `file`. A
pair finding was implicitly a two-file claim expressed as two findings; a cluster
finding is an N-file claim expressed as one, and every consumer that reads `file`
as "where this applies" now reads one member as if it were all of them.

`--baseline` is not affected the same way: the new `duplicate-cluster::`
identity is stable and path-qualified, which the changeset documents. It is
`--changed` that keys on `file`.

## Fix

The invariant, whichever option lands: **a finding that concerns several files
must survive a filter that only knows about one of them.**

**Taken: option 2, not the option this record recommended.** The record proposed
emitting the cluster once per member file (option 1) as "local to the smell
family". Two things found while fixing it moved the answer:

- **The defect is not cluster-only.** A two-body pair also carries one `file`,
  anchored at `pair.a`, which is walk order — so copying a body into one new
  file, the single most common real case and the one this record's Symptom
  describes, was already invisible under `--changed` before the collapse. Option
  1 scoped to clusters would not have fixed the reported scenario.
- **Option 1 gives back part of the win.** A full run would emit N findings per
  cluster instead of one, and this detector's entire recent history is about
  output inflation (4,770 pair findings to 407). Trading that away to fix a
  filter bug is the wrong direction.

So: `ArchViolation` gains `relatedFiles?: readonly string[]` — the other files a
finding concerns — `diffAware()` keeps a violation when its own file **or** any
related file changed, and the smell family populates it for pairs and clusters.
Additive on the kernel: existing producers keep compiling, a consumer that
ignores the field behaves exactly as before, and volume is unchanged.

It is worth noting what this makes possible beyond this bug: any finding about a
relationship — a correspondence, a cross-file rule — has the same shape and can
now say so.

**Every `--changed` path was covered by the one change**, verified: six call
sites (the two kernel terminals, the two `eess-ts` terminals, `checkAll` and the
CLI) all delegate to `filterToChanged`. Baselines key on `identity`, not `file`,
so they were never affected. Two sibling mechanisms still match on the finding's
own file alone — `.excluding()` patterns and comment suppression — and both fail
in the safe direction, reporting something the author tried to waive rather than
hiding something real. The suppression half is filed as
[0242](./0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md).

## What else this arc left unasserted

Found by the same review, same commits, and cheap to fix alongside — each
verified by sabotage in an isolated worktree against a green baseline of 97
tests:

| sabotage                                    | tests that red |
| ------------------------------------------- | -------------- |
| `clusterRank` returns `0` for every cluster | **none**       |
| `peakSimilarity` hard-coded to `0`          | **none**       |

`clusterRank` (`packages/ts/src/smells/clusters.ts:102-115`) is the ranking that
is headline claim two of a breaking changeset, and reversing or deleting it is
invisible to the suite. `peakSimilarity` (`:69`) is asserted only as
`toMatch(/\d+% similar/)` at `packages/ts/tests/smells/clusters.test.ts:69`,
which any number satisfies — the message reads "is up to 0% similar" and passes.
That is ADR-009 rule 5's corollary exactly: assert the value, not the shape.

Both rejections that arc added **are** non-vacuously tested, in both directions,
and the review confirmed it; this is not a blanket criticism of the arc's tests.

## Also owed, and not a defect

- **The nested-body rejection shipped with no changeset.** `a3bb53d` changed
  `packages/ts/src/smells/similar-pairs.ts` and a test; no `.changeset/*.md`
  mentions containment or nesting. `check:release` was satisfied by the cluster
  changeset already on the branch, so a strictly-fewer-findings behaviour change
  reaches adopters undocumented. Amend
  `.changeset/duplicate-bodies-reports-clusters-and-axes.md`.
- **`docs/smell-detection.md:16` states the old contract** — "Two functions are
  flagged when their AST similarity exceeds a threshold" — with no mention of
  clusters, ranking, variation axes, containment or the pairwise floor.

## Verification

- [x] Red first: `packages/ts/tests/smells/changed-files.test.ts` went **2 failed
      / 3 passed** before the fix. The three that passed are the cases that were
      already correct — anchor-file changed, unrelated file ignored, reported
      once — so the red was in exactly the two places the defect lived.
- [x] Each half sabotage-verified independently: removing `relatedFiles` from
      the filter reds 2 of 5; removing it from the pair producer reds 1 of 5;
      restored, 5 pass.
- [x] Volume is not given back: a finding naming three files stays one finding,
      asserted by the "reports once, not once per file" case. **That test is the
      whole evidence.** An earlier draft of this ledger also cited the dogfood
      count holding at 30 warnings, which proves nothing: `otherFiles()` only
      adds a field to a violation that already exists, so it cannot change how
      many there are, and the number would have held whether or not
      `relatedFiles` was populated correctly. A count that cannot move is not a
      measurement — the review caught the citation and it is corrected rather
      than dropped, because citing an inert number as proof is the shape this
      repo keeps finding.
- [x] `clusterRank` returning a constant reds a test — and the test is written so
      the high-ranking family sorts LAST naturally, because a stable sort would
      otherwise let the neutered rank pass.
- [x] `peakSimilarity` hard-coded to 0 reds a test that asserts `100% similar`
      rather than `/\d+% similar/`, which "0% similar" satisfied.
- [x] `docs/smell-detection.md` describes clusters, ranking, axes and both
      rejections; the changeset names the `relatedFiles` addition and tells a
      consumer who filters by file themselves to read it.
- [x] `npm run validate` green from a run that reached the last step
      (`check:surface`), 3590 tests.
- [x] The field reaches a consumer. `--format json` builds each violation from
      an explicit field list and dropped `relatedFiles`, so the changeset's own
      advice — read it if you filter by file yourself — was impossible to follow
      through the documented agent-actionable stream. Found by review, fixed,
      and sabotage-verified: removing the field reds that test alone.
- [x] The repo caught the fix's own tests. `check:vacuity`'s cardinality ratchet
      (plan 0079) refused five assertions that checked how many findings survived
      the filter rather than which — the same weakness this record found in the
      arc it fixes, written by the person fixing it. They compare identities now.

## Related

- [0169](../0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md) — the record
  this whole branch was named for, and the arc's origin.
- [0238](./0238-the-kernels-reason-free-waiver-promotion-is-untested.md) — sibling
  finding from the same post-merge review round.
