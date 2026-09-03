# Bug 0239: a cluster finding carries one file, so `--changed` drops the duplicate that was just introduced

## Status

- **State:** Draft — measured against the merged source and confirmed by
  sabotage in an isolated worktree; no red test yet.
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

Options, in the order that keeps the collapse's win:

1. **Emit the cluster once per member file**, sharing the `duplicate-cluster::`
   identity so the baseline still dedupes. Volume goes from N²/2 back to N, not
   to N²/2 — the eight largest groups were 49% of the old output at N²/2, and N
   is far below that.
2. Teach `diffAware()` to read a violation's member files when it has them,
   which needs a field on `ArchViolation` and touches every dialect.

Option 1 is local to the smell family and is the recommendation. Whichever
lands, the invariant to state is: **a finding that concerns several files must
survive a filter that only knows about one of them.**

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

- [ ] Red first: a cluster spanning two files, with only the non-anchor file in
      the changed set, reports under `--changed`. Today it does not.
- [ ] The baseline still dedupes the cluster to one entry — the collapse's win
      is not given back.
- [ ] `clusterRank` returning a constant reds a test.
- [ ] `peakSimilarity` hard-coded reds a test that asserts the number.
- [ ] The changeset describes the containment rejection; `docs/smell-detection.md`
      describes what ships.

## Related

- [0169](./0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md) — the record
  this whole branch was named for, and the arc's origin.
- [0238](./0238-the-kernels-reason-free-waiver-promotion-is-untested.md) — sibling
  finding from the same post-merge review round.
