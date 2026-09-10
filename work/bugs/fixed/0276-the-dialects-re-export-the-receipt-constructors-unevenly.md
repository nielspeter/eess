# Bug 0276: the dialects re-export the receipt constructors unevenly

## Status

- **State:** Fixed — all four barrels carry both constructors, asserted by a
  test that runs under `check:family`.
- **Severity:** Medium — it costs an adopter a direct kernel dependency, which is
  the exact thing plan 0089 and ADR-011 exist to avoid.
- **Origin:** self-found · writing the 0.5 migration guide, when the docs-code
  gate refused a claim about where `mergeCollectResults` lives.

## Symptom

ADR-014 made `collectResult` and `mergeCollectResults` the two constructors an
adopter needs to build or combine a receipt. A consumer who installs one dialect
should reach both without a second install. Measured on `main`:

| dialect                    | `collectResult` | `mergeCollectResults` |
| -------------------------- | --------------- | --------------------- |
| `@nielspeter/eess-ts`      | yes             | yes                   |
| `@nielspeter/eess-mermaid` | yes             | **no**                |
| `@nielspeter/eess-md`      | **no**          | yes                   |
| `@nielspeter/eess-gherkin` | **no**          | **no**                |

`@nielspeter/eess-crossvalidate` has no barrel; it ships flat entry files.

## The claim this contradicts

`.changeset/the-emitter-takes-a-receipt.md`, pending in the 0.5 train and
therefore about to be published into six CHANGELOGs, says:

> Each also re-exports the new constructor and merge, so a standalone consumer of
> one dialect never needs a second kernel install.

That is true of `eess-ts` and of no other dialect.

## Why no gate caught it

`check:family` enforces that a dialect re-exports every kernel symbol **its own
source imports**. `eess-gherkin`'s source imports neither constructor, so it owes
neither re-export, and the gate is correct to stay green. The rule is
import-driven by design — the same blind spot `packages/md/src/index.ts` records
in its own comments about `correspondence`, which is re-exported for the docs
rather than for the source.

So the missing half is demand-side: nothing asks whether a dialect publishes what
an ADR says an adopter needs. That is the same shape as
[bug 0275](../0275-a-migration-can-still-state-its-claim-in-prose.md) and as the
`/presets` subpath audits recorded in
[plan 0263](../../plans/completed/0263-adr-014s-residual-enforcement-rows.md) — three
instances now of "the gate checks what is written, and nothing requires the right
thing to be written".

## The corruption that must produce a violation

A dialect barrel that does not publish a symbol ADR-014 names as required for
building or merging a receipt.

## Fix sketch

Add the missing re-exports — one line each in `eess-mermaid`, `eess-md` and
`eess-gherkin` — and correct the changeset's sentence before it ships. Then
decide whether the required set is worth asserting: a small named list checked
against each dialect's barrel would close the demand side for this ADR without
the general problem 0275 describes.

## Verification ledger

- [x] Red test first. `scripts/lib/receipt-constructors.test.mjs` imports each
      dialect's built barrel and asserts both constructors are callable. Before
      the fix: **3 failed, 2 passed** — `eess-ts` and the kernel green,
      `eess-mermaid`, `eess-md` and `eess-gherkin` red. After: 5 of 5.
- [x] The three barrels updated — one re-export line each, each carrying why the
      gate that looks adjacent to this could not have caught it.
- [x] The changeset corrected. It said "each also re-exports the new constructor
      and merge", which was true of one dialect. It now names the two symbols, so
      the sentence about to reach six published CHANGELOGs is one the suite holds.
- [x] **The required-set assertion is worth having, and this is the decision.**
      The test is not a list of what happens to be exported — it names what
      ADR-014 requires an adopter to be able to do, and checks each barrel against
      that. It also guards its own list: a final case asserts every required name
      is still on the kernel root, so renaming a constructor reds here rather than
      leaving four tests quietly asserting a symbol nobody exports.

      Wired into `check:family`, beside the import-driven rule it complements.
      That gate now runs both halves: the supply side (a dialect re-exports what
      its source imports) and the demand side (a dialect publishes what the ADR
      says an adopter needs). The second is what was missing, and the split is
      why a green gate sat beside this gap.

No changeset added: `check:release` reports 3 changed packages and 0 findings,
because `the-emitter-takes-a-receipt` already declares all six at `minor` and
this is the fix that makes its own sentence true.

## What the architecture review changed

**The required set was derived from a release, not from the ADRs, and it failed
on its first outing.** The first fix asserted the two constructors a pending
changeset happened to name. Measured consequence: `eess-gherkin` could build a
receipt and merge two, and could reach neither `finishPreset` nor
`reportViolations` to hand one to — while ADR-014 records that this package
publishes no binary, so "the seam is the preset a caller finishes". `eess-md` was
missing the emitter and the error guard too.

The set is now derived clause by clause: the two constructors (ADR-014), the one
emitter (ADR-008), `finishPreset` for the packages whose seam is a preset, and
`isArchConfigError` so a caller can recognise what that seam throws. Adding a
clause to those ADRs means adding a name here, which is the coupling that makes
this a check of the decision rather than of the code.

**And the corrected sentence was still false.** It said each of the five dialects
re-exports both constructors. Measured across `eess-crossvalidate`'s seven flat
entries: zero publish the merge, and the four carrying the constructor do so only
because their own source imports it. The sentence now names the four barrel
dialects and states crossvalidate's shape.

**A third opinion about the same question, avoided.**
`scripts/lib/kernel-surface.mjs` calls itself the one place saying which kernel
exports a dialect need not re-export, and records that its two consumers were
unified because a hand-synced pair drifts. This test is a third consumer, so it
now reads those sets and fails on a contradiction rather than becoming a fourth
definition.

Deferred: [bug 0277](../0277-crossvalidates-flat-entries-have-no-standalone-contract.md)
— whether standalone sufficiency applies to a flat-entry bridge package at all.
That is a prior question, and extending the set over seven entries before
answering it would build a gate from a shape rather than a decision, which is
exactly what this bug's first cut did.
