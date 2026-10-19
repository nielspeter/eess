# Plan 0498: `honestyAtClose` places a record with block 5

## Status

- **State:** Draft — written 2026-10-19, with plan 0495 and ADR-022. Not reviewed.
- **Implements:** proposal 017
- **Priority:** Medium. Proposal 017's block 5 row: "`honestyAtClose`'s placement half is then
  rebuilt on it, so there is one placement check". It also pays down ADR-022's three ratcheted
  edges.
- **Effort:** Small to medium. The placement half becomes a call to block 5; the preset's other
  findings keep their readers until a block replaces each.
- **Created:** 2026-10-19
- **Builds after:** [plan 0495](./0495-a-value-agrees-with-its-folder.md) (block 5).
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3.

## Problem

`honestyAtClose` (`packages/md/src/rules/ledger.ts`) checks a record's state against its folder with
its own reader: `findStateRe` and `headerStateViolation`, over `labelPattern`, `LABEL_HEADING`,
`PLAIN_LABEL`, `wrappedLabelOf` and `proseText`, none of them root blocks. ADR-022 clause 3 requires a
preset built from the roots, and `md/rules-import-only-the-root` carries three exclusions for it
(`model/label.ts`, `model/prose.ts`, `model/task-items.ts`), each pinned by
`md/rules-ledger-debt-is-current` in `arch.rules.ts`. Once block 5 ships, the placement half has a
public block to stand on, and this repository has two placement checks for the same fact
(`ledger/state-folder-mismatch` and plan 0495's `corpus/done-folders-hold-done-values-*`, beside
`corpus/closed-records-sit-in-done-folders`).

## Design

1. **The placement half on block 5.** `ledger/state-folder-mismatch` becomes `agreeWithFolder` in
   `both`, its classes built from the preset's `states`, `terminalStates`, `doneFolders` and
   `boardFiles`, its field from `label`/`aliases`. The preset's fixtures stay unchanged (proposal
   017, decision 3's closing proof); where a finding's text changes, the plan lists each change and
   it ships as a flagged break with its dependants named (bug 0185).
2. **The three edges, one by one.** Each import leaves when nothing in `ledger.ts` uses it, and its
   `LEDGER_DEBT` entry in `arch.rules.ts` goes in the same commit (the pin reds otherwise). An edge
   still needed by another finding (`silent-open-box`, `deferred-none-lie`, the unterminated fence)
   stays, and the plan says which block would replace it, or files the block it lacks.
3. **One placement check in this repository.** Decide, measured, which of the three rules above
   stays: the ledger's rebuilt half covers both directions for all three lanes, so the `check:corpus`
   rules are kept only where they judge what it does not.

## Phases

1. Rebuild the placement half; the ledger fixtures green unchanged, or each change listed.
2. Remove each unused edge with its `LEDGER_DEBT` entry; update ADR-022's ratchet rows.
3. The repository's placement rules reconciled; ADR-021's clause 7 witness kept or moved, in the
   same change as its row.

## Files changed

- `packages/md/src/rules/ledger.ts`
- `arch.rules.ts`
- `adr/022-eess-mds-root-fixes-no-documents-shape.md` (Enforcement rows)
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs` (if a placement rule is retired)
- `packages/md/tests/rules/` (rows for the rebuilt half)
- `.changeset/`

## Test inventory

- The existing ledger tests green, unchanged, or each changed message listed.
- A `Status:`-labelled lane placed correctly under `label: 'Status'` (bug 0444's case).
- The sabotage: a rebuilt half that drops one direction reds its row.
- `check:arch` green with fewer exclusions, and each removed one's pin gone.

## Out of scope

- `honestyAtClose` leaving eess-md: the maintainer's decision (ADR-022 clause 3).
- The box and `deferred: none` halves on public blocks, beyond the edges they keep.
- `corpus()`'s default frozen folders: bug 0497.
