# Bug 0363: a `parent-dir` glob naming a file outside the project is told to widen an include that cannot help

## Status

- **State:** Draft — found by enforcement and architecture review of bug 0362's second
  fix; deliberately left out of that fix's scope.
- **Severity:** Medium — **no wrong verdict; an impossible remedy on an unsuppressable
  finding.** The finding is correct and the `Fix:` line beside it cannot be carried out.
  ADR-009 rule 2: "a message whose stated fix is impossible on the path that produced it
  is worse than no message: the agent tries it, it fails, and the agent then does the
  forbidden thing."
- **Origin:** review of [0362](./fixed/0362-a-typod-ratchet-is-green-in-both-tools.md).
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

Not decided. The shape that the review converged on is to have the admission gate return
the **route** rather than a boolean, so the message cannot be constructed from a
different derivation than the one that admitted it:

```ts
export type DeadSiteRoute = 'syntactic' | 'names-a-file' | 'contradicted-by-disk' | undefined
```

with remedy and scope keyed off a `Readonly<Record<…>>` table, the idiom `FAULT_ADVICE`
and `ON_DISK_ADVICE` already establish two files over. That is a design change to a
boundary two bug fixes have now touched, so it is a decision to take rather than a patch
to apply — which is why it is here and not in 0362.

## Related

- [0362](./fixed/0362-a-typod-ratchet-is-green-in-both-tools.md) — fixed the same class
  on the two routes it could reach without changing that boundary. This is the third.
- [0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — where the disk became a discriminator at all.
- [0354](./0354-the-glob-view-doctrine-is-settled-in-three-bug-records-and-no-adr.md) —
  the same complaint one level up: this boundary's doctrine lives in bug records.

**An open question, recorded rather than answered.** Enforcement review asked whether a
cardinality rule can have a dead **discovery** glob, which would be silent in both paths
(`cardinalitySelectorMissedDisk` returns `deadSitesIn(...).selector` and discards
`.discovery`; `deadSelectorFindings` returns empty for cardinality outright). Measured so
far: the only construction of `position: 'discovery'` in the source is a hand-built site
inside `packages/ts/src/presets/agent-guardrails.ts:546`, a preset's internal diagnostic
over its own `ruleFiles` entries, not a shape a user chains `.satisfy(notExist())` onto.
So it may not be constructible — that is a measurement to take, not a defect to assume.

## Verification

- [ ] a red-first test driving a `parent-dir` glob naming a file **outside** the project,
      asserting the `Fix:` line does not name the tsconfig.
- [ ] the route decided and recorded, with the two questions named separately.
- [ ] the in-project case still green — 0362 pins it as
      `it('the third admission route is not offered the tsconfig either')`.
- [ ] a sabotage matrix, including a row that widens the admission filter.
- [ ] the discovery-glob question measured, and either filed or closed with the evidence.
