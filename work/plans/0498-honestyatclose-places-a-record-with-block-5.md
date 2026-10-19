# Plan 0498: `honestyAtClose` places a record with block 5

## Status

- **State:** Draft — written 2026-10-19, with plan 0495 and ADR-022; revised the same day after
  PR #246's review (see "Review — 2026-10-19"). Not reviewed again.
- **Implements:** proposal 017
- **Priority:** Medium. Proposal 017's block 5 row: "`honestyAtClose`'s placement half is then
  rebuilt on it, so there is one placement check". It also removes ADR-022's `model/label.ts` edge.
- **Effort:** Medium. The state reading and the placement half move onto public blocks; the box and
  `deferred: none` halves are plan 0504's.
- **Created:** 2026-10-19
- **Builds after:** [plan 0495](./0495-a-value-agrees-with-its-folder.md) (block 5).
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3.

## Problem

`honestyAtClose` (`packages/md/src/rules/ledger.ts`) reads a record's state with its own reader,
`findStateRe`, `headerStateViolation`, `stateUnderAnotherLabel` and `isDoneItem`, over
`labelPattern`, `LABEL_HEADING`, `PLAIN_LABEL` and `wrappedLabelOf` from `model/label.ts`, none of
them root blocks. ADR-022 clause 3 requires a preset built from the roots, and
`md/rules-import-only-the-root` carries the `model/label.ts` edge as an exclusion, pinned by
`md/rules-ledger-debt-is-current-label` and by `packages/md/tests/rules/ledger-debt.test.ts`. Once
block 5 ships, the state reading and the placement half have public blocks to stand on: `fields()`
and `haveField` for the value, `agreeWithFolder` for the placement. And this repository has
placement checks for the same fact in three rules (`ledger/state-folder-mismatch`,
`corpus/closed-records-sit-in-done-folders`, and plan 0495's `corpus/done-folders-hold-done-values-*`).

## Design

1. **The state reading on `fields()`/`haveField`.** `isDoneItem` (which decides the boxes
   `silent-open-box` judges), the header state, `ledger/unknown-state` and the "state under another
   label" finding read the value through the root's field blocks with the preset's `label` and
   `aliases`, so nothing in `ledger.ts` uses `model/label.ts`.
2. **The placement half on block 5.** `ledger/state-folder-mismatch` becomes `agreeWithFolder`, with
   the live states as a `'rest'` group and each terminal state bound to the `doneFolders` (as
   `**/<folder>/**` globs), its field from `label`/`aliases`. The direction is `both`, or
   `right-to-left` when `closeInPlace` is set: `closeInPlace` turns off the orphaned-close half,
   which is the value → folder direction, so the option keeps its meaning.
3. **`ledger/unknown-state` stays,** over every record the preset reads, not only the bound folders:
   it is what reports a misspelt state in a live folder (plan 0495, decision D8). Block 5's F3 covers
   only bound folders.
4. **The edge.** `model/label.ts` leaves `ledger.ts`; its `LEDGER_DEBT` entry in `arch.rules.ts`, its
   pin and its four symbols in `packages/md/tests/rules/ledger-debt.test.ts` go in the same commit
   (the pin reds otherwise). ADR-022's row for the edge becomes `gated`.
5. **One placement check here.** Measured on the rebuilt preset, decide which of the three rules
   above stays: the ledger's half covers both directions for all three lanes, so a `check:corpus`
   rule is kept only where it judges what the ledger does not. ADR-021's clause 7 witness
   (`corpus/closed-records-sit-in-done-folders`) is kept, or moved in the same change as its row.

## The verdict changes, a break

Block 5 judges what `headerStateViolation` did not:

- **F4:** a record in a done folder with no `State` is a finding. Today it is "not an item"
  (`packages/md/src/rules/ledger.ts:473`, `return null`).
- **F5/F6/F7:** an unreadable value, a record under two groups' folders, a done folder glob that
  matches nothing (`DEFAULT_DONE_FOLDERS` names five folders; most lanes have two) are findings.
- **The rule id** of a placement finding changes if the build keeps block 5's own, and a
  `.excluding()` entry keyed on `ledger/state-folder-mismatch` then stops matching.
- **Messages** change to block 5's.

Each is listed in the changeset with its migration line, and the changeset names the dependants
(bug 0185).

## Phases

1. The state reading on public blocks; `model/label.ts` removed with its pin and test entries.
2. The placement half on `agreeWithFolder`, `closeInPlace` mapped; the ledger fixtures green, each
   changed verdict listed.
3. The repository's placement rules reconciled; ADR-022's and ADR-021's rows updated in the same
   change.

## Files changed

- `packages/md/src/rules/ledger.ts`
- `arch.rules.ts`
- `packages/md/tests/rules/ledger-debt.test.ts`
- `packages/md/tests/rules/` (rows for the rebuilt half)
- `adr/022-eess-mds-root-fixes-no-documents-shape.md` (Enforcement rows)
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs` (if a placement rule is retired)
- `.changeset/`

## Test inventory

- The existing ledger tests green, unchanged, or each changed verdict listed under "The verdict
  changes".
- `closeInPlace`: a closed record in a live folder is not reported; an open record in a done folder
  still is.
- `label: 'Status'` with `aliases`: placement read through the alias. Bug 0444's fix already has a
  row for the label reaching the state reader (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`);
  this one is new for the rebuilt placement half.
- A misspelt state in a live folder: still `ledger/unknown-state`.
- A first record filed in a done folder no rule bound before (`work/plans/wont-do/`): still judged,
  so the merge keeps what `ledger/state-folder-mismatch` covers today (PR #246, architect M10 and
  enforcement M7).
- The sabotage: a rebuilt half that drops one direction reds its row; `closeInPlace` ignored reds
  its row.
- `check:arch` green with the label exclusion and its pin gone.

## Release

`@nielspeter/eess-md` minor, `**Breaking**`-flagged: the verdict changes above, a migration line for
each, and the dependants named (bug 0185).

## Out of scope

- The box and `deferred: none` halves, the `model/task-items.ts` and `model/prose.ts` edges, and
  proposal 017 decision 3's closing proof: [plan 0504](./0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md).
- `honestyAtClose` leaving eess-md: the maintainer's decision (ADR-022 clause 3).
- `corpus()`'s default frozen folders: bug 0497.

## Review — 2026-10-19

From PR #246: `closeInPlace` kept and mapped to `right-to-left`, and the verdict changes declared as
a break with a Release section (product I3, decision D9); this plan removes only the
`model/label.ts` edge, and plan 0504 owns the other two and the closing proof (method I1,
architect I4, decision D10); `ledger/unknown-state` kept (decision D8); unbound done folders keep
their coverage (architect M10, enforcement M7); bug 0444's existing row named (method M4).
