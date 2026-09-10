# Bug 0276: the dialects re-export the receipt constructors unevenly

## Status

- **State:** Draft — a standalone-sufficiency gap the family gate cannot see.
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
[bug 0275](./0275-a-migration-can-still-state-its-claim-in-prose.md) and as the
`/presets` subpath audits recorded in
[plan 0263](../plans/completed/0263-adr-014s-residual-enforcement-rows.md) — three
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

- [ ] Red test first: an assertion that each dialect barrel publishes both
      constructors, failing on `main`.
- [ ] The three barrels updated, and the pending changeset's sentence corrected
      or narrowed to the dialect it is true of.
- [ ] A decision recorded on whether the required-set assertion is worth having,
      or whether this stays a one-off correction.
