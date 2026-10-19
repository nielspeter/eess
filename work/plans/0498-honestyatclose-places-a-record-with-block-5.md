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
2. **The placement half on block 5.** `ledger/state-folder-mismatch` becomes `agreeWithFolder`, its
   field from `label`/`aliases`, with one done group: the `terminalStates`, bound to every
   `doneFolders` entry as a `**/<folder>/**` glob.
   - **By default:** the live states are a `'rest'` group, the selection is the preset's records, and
     the direction is `both`. A closed record in a live folder and an open one in a done folder are
     each one F2.
   - **Under `closeInPlace`:** no `'rest'` group. The rule selects only the done folders (the same
     `**/<folder>/**` globs) and binds only the done group, `right-to-left`. A closed record in a
     live folder is not selected, so it is not reported, which is what `closeInPlace` means. With a
     `'rest'` group it would be F2 in every direction (plan 0495: with `'rest'`, a one-way rule is
     made by the selection), which is why the option maps to a selection and not only a direction
     (PR #246's verification, architect N1 and product N1, decision E2). An open state in a done
     folder is then a value in no group: F3, not F2, a message change listed below.
   - **The done folders are the preset's globs, not the caller's.** `doneFolders` are folder names
     matched anywhere (`/wont-do/`), and the preset builds the globs, both from its five defaults
     and from a caller's list. It builds them through plan 0495's internal mark, so F7 fires once,
     only when every done folder of the group matches nothing (plan 0495, decision E3). A lane
     whose `wont-do/` has no record yet is the ordinary state, here and for adopters on the
     defaults (most lanes have two of the five). Extending the mark from the five defaults to the
     globs the preset derives from a caller's names is this plan's decision, overrulable: a name in
     `doneFolders` declares a kind of folder, not a path the caller typed.
   - **Frozen documents are selected explicitly,** by the done-folder globs, not through
     `corpus()`'s default frozen folders, so bug 0497's break does not move this rule's fixtures.
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
- **F5/F6/F7:** an unreadable value and a record under two groups' folders are findings; F7 only
  when no done folder of the lane matches anything (a lane with none of its done folders on disk).
- **Under `closeInPlace`:** an open state in a done folder is F3 ("none of the declared values"),
  not today's `State: X but filed in a done-folder` message.
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
  changes". The fixtures as they stand after this plan merges are plan 0504's baseline: its proof
  of proposal 017 decision 3 ("fixtures unchanged") is measured against them, not against the
  fixtures at `9675402`, and the verdicts this plan changes are those listed in its changeset
  (PR #246's verification, method N1, decision E5).
- `closeInPlace`: a closed record in a live folder is not selected and not reported; an open record
  in a done folder is still reported, as F3. Without `closeInPlace`, both are F2.
- Defaults: a lane with `completed/` and none of the other four default folders gets no F7; a lane
  with none of the five gets one.
- `label: 'Status'` with `aliases`: placement read through the alias. Bug 0444's fix already has a
  row for the label reaching the state reader (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`);
  this one is new for the rebuilt placement half.
- A misspelt state in a live folder: still `ledger/unknown-state`.
- A first record filed in a done folder no rule bound before (`work/plans/wont-do/`): still judged,
  so the merge keeps what `ledger/state-folder-mismatch` covers today (PR #246, architect M10 and
  enforcement M7).
- The sabotage: a rebuilt half that drops one direction reds its row; `closeInPlace` mapped to
  `right-to-left` while keeping the `'rest'` group and the whole selection (the first draft of this
  plan) reds the `closeInPlace` row, since the closed record in a live folder is then F2; the
  internal mark dropped, so the default done folders give F7 each, reds the defaults row.
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

From PR #246's verification round: `closeInPlace` selects the done folders and binds only the done
group, with no `'rest'` group (decision E2, architect N1, product N1); the done-folder globs carry
plan 0495's internal mark, so F7 fires only when all are dead (decision E3, architect N2); plan
0504's baseline is the post-0498 fixtures (decision E5, method N1); frozen documents selected
explicitly (method N1's carried condition).
