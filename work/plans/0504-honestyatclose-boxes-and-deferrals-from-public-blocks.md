# Plan 0504: `honestyAtClose`'s boxes and deferrals from public blocks

## Status

- **State:** Draft — written 2026-10-19 from PR #246's review (method I1, architect I4). Not
  reviewed.
- **Implements:** [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)
- **Priority:** Medium. It owns [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md) decision 3's closing proof, "`honestyAtClose` rebuilt
  from public blocks with its fixtures unchanged", and [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s last two ratcheted edges. The
  fixtures are those after [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md)'s declared break, not those at `9675402` (see Design 3).
- **Effort:** Medium. Two halves of the preset, and whatever root blocks they lack.
- **Created:** 2026-10-19
- **Builds after:** [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md), which moves
  the state reading and the placement half.
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3.

## Problem

After [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md), `honestyAtClose` (`packages/md/src/rules/ledger.ts`) still imports past the md
root over two edges: `validateMarks` from `model/task-items.ts` (the box-marks option's check) and
`proseText` and `unterminatedFence` from `model/prose.ts` (`deferred: none` lines read as prose, the
state-in-code finding, and the unterminated-fence finding). They are excluded from
`md/rules-import-only-the-root` and pinned by `md/rules-ledger-debt-is-current-task-items`,
`-prose` and `packages/md/tests/rules/ledger-debt.test.ts`. An adopter writing the preset from the
root could not write these halves.

## Design

Designs 1 and 2 each leave a choice open. Each phase therefore starts as a time-boxed spike that
measures the fixtures and brings the choice back for a decision before its build (PR #246's
verification, architect N5, method N3); the plan is not marked Ready until both are decided.

1. **Boxes.** The box half is built from `taskItems()` and the root's marks option, which already
   validates marks inside the builder ([plan 0454](./completed/0454-box-marks-are-the-callers.md)), so `validateMarks` is not called by the preset.
   If a declared-marks check is still needed before any rule runs, the root gains it as a block the
   caller names every value of ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1), or the plan says why the builder's check is
   enough.
2. **`deferred: none` and prose.** Reading a line as prose, code set aside, is a root block the md
   root lacks: either a prose-lines block is added to the root (its contract written here, its
   callers named), or each finding is rebuilt from existing blocks (`fields()` for a labelled
   `Deferred:` line). The plan decides from a measurement of the findings' fixtures.
3. **The closing proof.** The ledger fixtures run unchanged against the rebuilt preset, and
   `ledger.ts` imports only the md and kernel roots: `LEDGER_DEBT` is empty, both pins and the
   debt test's entries are gone, and [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s last `pending` row becomes `gated`. **The baseline is
   the fixtures as [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md) leaves them** (2026-10-19, PR #246's verification, method N1): [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md) is a declared break that changes some verdicts and messages, listed in its changeset, so
   "unchanged" here means unchanged since 0498's merge. What the proof shows is that public blocks
   express the preset as 0498 redefined it; the verdicts 0498 changed are that changeset's, not this
   proof's.

## Phases

1. Spike, then build: boxes on public blocks; the `model/task-items.ts` edge removed with its pin
   and test entry.
2. Spike, then build: prose and deferrals on public blocks (a new root block if measured
   necessary); the `model/prose.ts` edge removed the same way.
3. The fixtures unchanged, as decision 3's proof; [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s row and [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s disposition
   updated.

## Files changed

- `packages/md/src/rules/ledger.ts`
- `packages/md/src/index.ts` (if a root block is added)
- `arch.rules.ts`
- `packages/md/tests/rules/ledger-debt.test.ts`
- `adr/022-eess-mds-root-fixes-no-documents-shape.md`
- `work/proposals/017-md-blocks-to-check-a-documents-shape.md`
- `.changeset/`

## Test inventory

- Every existing ledger test green with its fixtures unchanged since [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md)'s merge (the proof).
- An undeclared box mark still reported, through the builder's check.
- A `deferred: none` line in a code block still not read as a summary.
- `check:arch` green with `LEDGER_DEBT` empty; `ledger-debt.test.ts` asserting no `model/` import.

## Out of scope

- The state reading and placement half: [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md).
- `honestyAtClose` leaving eess-md: the maintainer's decision.
