# Bug 0363: a `parent-dir` glob naming a file outside the project is told to widen an include that cannot help

## Status

- **State:** Fixed — the route has one owner, consulted by the admission gate and by both
  tools' messages, so the reason a finding exists and the reason it gives can no longer be two
  derivations. Fixed together with
  [0364](./0364-doctor-states-the-cause-and-never-the-remedy.md), because both records
  said the seam was the same and fixing one would have grown a second copy.
- **Severity:** Medium — **no wrong verdict; an impossible remedy on an unsuppressable
  finding.** The finding is correct and the `Fix:` line beside it cannot be carried out.
  ADR-009 rule 2: "a message whose stated fix is impossible on the path that produced it
  is worse than no message: the agent tries it, it fails, and the agent then does the
  forbidden thing."
- **Origin:** review of [0362](./0362-a-typod-ratchet-is-green-in-both-tools.md).
  Two independent lenses reached the same cell from opposite directions — one from the
  emitted text, one from the mechanism.
- **Reported:** 2026-09-29

## Symptom

A cardinality rule whose selector is a `parent-dir` glob naming a **file** that sits
outside the tsconfig:

```ts
modules(p).that().resideInFolder('**/apps/legacy/src/old**').should().satisfy(notExist())
```

`diskSet.classify` matches files as well as directories and is not kind-aware, so the
glob classifies `holds-typescript` and the finding takes the disk-contradicts branch:

> **Fix:** Widen the tsconfig include to cover this path, or correct the selector — do
> not delete this rule, it is what detected the gap.

Widening the include cannot make that glob match anything. `resideInFolder` reads the
directory portion of each path, and the glob names a file — so the fault survives any
`include`. The second half of the sentence ("or correct the selector") is achievable; the
first half, which is what an agent reads first, is not.

## Root cause

Two questions are being conflated at the boundary between `disk-set.ts` and
`vacuity-diagnosis.ts`:

- `classify` answers **"is there TypeScript at this path?"** — about paths, always.
- the remedy needs **"is the tsconfig the lever for this fault?"** — which depends on the
  glob's `kind` and on the fault, not only on what is on disk.

For the `no-match` fault those two coincide, which is why the branch was written as it
was. For `file-not-folder` they do not: the fault is decidable without the filesystem,
and 0362's second fix made the _in-project_ case correct by reading `diagnosis.onDisk`
(`undefined` for `file-not-folder`, because `diagnoseGlob` returns before consulting the
disk). The _out-of-project_ case reaches the same branch through the admission filter,
which calls `classify` directly and does get an answer.

So `cardinalityDeadSiteIsAtFault` admits the finding **because the disk contradicts the
absence claim**, and the message beside it — correctly — reports that the disk did not
decide. Both are right about their own question; the pair is what is wrong.

## Fix

**Built as proposed**, with one thing the proposal did not see.

`deadSiteRoute(diagnosis)` in `glob-diagnosis.ts` is the single owner — exhaustive over
`GlobFault`, returning `'syntactic' | 'names-a-file' | 'contradicted-by-disk' | undefined`.
`CARDINALITY_REMEDY` and `ROUTE_HOLDS_IN_ANY_PROJECT` key off it as `Readonly<Record<…>>`,
the idiom `FAULT_ADVICE` and `ON_DISK_ADVICE` already establish in that file. Three consumers
now read one value: `check`'s admission filter, `check`'s message, and `doctor`.
`cardinalityDeadSiteIsAtFault` is gone.

**What the proposal missed: the fault was not merely mis-remedied, it was undetectable.**
`diagnoseGlob` detects `file-not-folder` from `universe.filePaths` — the **project's** files.
A file OUTSIDE the project is not in that list, so the glob fell through to `no-match`, the
disk said `holds-typescript`, and the route was genuinely `contradicted-by-disk`. Keying the
remedy off the route would have changed nothing: the route itself was wrong.

So the fix completes the detection at its source. `DiskSet` gains `matchesOnlyFiles(glob)` —
the kind-aware question `classify` cannot answer, since `classify` is about paths and this is
about whether any **directory** matches — and `diagnoseGlob` consults it for the
out-of-project case. It answers `false` when the walk cannot say, so the fault is never
claimed without evidence.

**And a test caught an error in the new table.** The first draft set
`ROUTE_HOLDS_IN_ANY_PROJECT['names-a-file'] = true`. It is **false**: the fault is contingent
on the filesystem, because the same glob matches fine in a project where that name is a
directory. `doctor-and-check-agree-about-a-ratchet.test.ts`'s row for that route reddened —
the row that exists precisely because it is the one input separating that claim from a
constant.

## Related

- [0362](./0362-a-typod-ratchet-is-green-in-both-tools.md) — fixed the same class
  on the two routes it could reach without changing that boundary. This is the third.
- [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — where the disk became a discriminator at all.
- [0354](../0354-the-glob-view-doctrine-is-settled-in-three-bug-records-and-no-adr.md) —
  the same complaint one level up: this boundary's doctrine lives in bug records.

**An open question, recorded rather than answered.** Enforcement review asked whether a
cardinality rule can have a dead **discovery** glob, which would be silent in both paths
(`cardinalitySelectorMissedDisk` returns `deadSitesIn(...).selector` and discards
`.discovery`; `deadSelectorFindings` returns empty for cardinality outright). Measured so
far: the only construction of `position: 'discovery'` in the source is a hand-built site
inside `packages/ts/src/presets/agent-guardrails.ts:546`, a preset's internal diagnostic
over its own `ruleFiles` entries, not a shape a user chains `.satisfy(notExist())` onto.
So it may not be constructible — that is a measurement to take, not a defect to assume.

## The refactor was unpinned, and a stray `git checkout` is what revealed it

Worth recording because the mechanism is general. This fix has two halves: **detection**
(`matchesOnlyFiles`, so the fault is seen at all) and **one owner** (the route table, so
admission and message cannot disagree). The red test asserted
`suggestion` contains `Correct the selector` — and the **detection half alone produces that**,
because without the route table the old `isCardinality`/`onDiskContradicts` branch reaches the
same sentence once `diagnoseGlob` returns `file-not-folder`.

So the one-owner half — this bug's actual ruling — was asserted by nothing. It was found when a
sabotage script's cleanup ran `git checkout --` on `vacuity-diagnosis.ts` and reverted the
refactor: **the suite stayed green at 3,910 tests**, and only `check:arch`'s unused-export rule
noticed, by reporting `DeadSiteRoute` and `ROUTE_HOLDS_IN_ANY_PROJECT` as referenced by no
other file. A dead export was the only visible trace of a reverted design.

Fixed two ways. The `names-a-file` route now has its **own** sentence ("name the DIRECTORY you
mean"), which only the route table can produce, and the test asserts it — verified by
replacing the table with a hand-rolled equivalent, which reds. And the lesson about the tool:
`git checkout --` inside a sabotage script is the same hazard as `git stash`, which this
project already warns about — it silently discards the work under test rather than the
mutation.

## Verification

- [x] a red-first test driving a `parent-dir` glob naming a file **outside** the project —
      `one-owner-for-the-route-and-the-remedy.test.ts` ·
      `it('a glob naming a FILE is not offered the tsconfig')`, measured red before the fix
      (`expected 'this path exists and contains TypeScript…' not to contain 'tsconfig'`).
- [x] a CONTROL that the FOLDER case still IS offered the tsconfig, so this is a
      discrimination and not the removal of a word.
- [x] the route decided and recorded, with the two questions named separately: `classify`
      answers about paths, `matchesOnlyFiles` about kinds.
- [x] the in-project case still green — 0362 pins it as
      `it('the third admission route is not offered the tsconfig either')`, and that row is
      what caught the scope error in the new table.
- [x] a sabotage matrix, 6 rows, all red — including one that drops the admission route
      entirely and one that restores this bug.
- [x] `npm run validate` green.
- [ ] the discovery-glob question measured, and either filed or closed with the evidence —
      `deferred→`[0371](../0371-can-a-cardinality-rule-have-a-dead-discovery-glob.md). Not
      needed by this fix, and recorded rather than carried: a question asked three times and
      answered none is how a bug record becomes an argument.

Deferred: [0371](../0371-can-a-cardinality-rule-have-a-dead-discovery-glob.md).
