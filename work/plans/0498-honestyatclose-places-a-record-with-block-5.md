# Plan 0498: `honestyAtClose` places a record with block 5

## Status

- **State:** Draft — written 2026-10-19, with [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md) and [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md); revised the same day after
  PR #246's review (see "Review — 2026-10-19"). Not reviewed again.
- **Note 2026-10-19 ([plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s build, revised by the batch review):** [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s decision E3
  marks a preset's default folder globs so F7 fires only when all are dead. The mark has no home:
  `markDefaultFolders` shipped briefly on `@nielspeter/eess-md/internal` and was removed, because
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3 lets `packages/md/src/rules/ledger.ts` import only the md root and the kernel
  root (`md/rules-import-only-the-root`), and on `/internal` any adopter could turn F7 off for its
  own globs. The writerless `WeakSet` and its F7 branch were then deleted too (PR #251's verify
  round). This plan decides where the mark lives, and adds the mark, its F7 branch and their test
  when it adds a writer.
- **Note 2026-10-19 (PR #251's review, architect M4):** `agreeWithFolder` checks its declaration
  only when the rule runs (`collectViolations`), not when `.agreeWithFolder()` is called, and keeps
  the caller's options by reference, so changing `groups` after the call changes the rule. It fails
  safe when the rule runs; this plan decides whether to check at declaration time and copy the
  options, as `taskItems()` does with its marks.
- **Implements:** [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)
- **Priority:** Medium. [Proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s block 5 row: "`honestyAtClose`'s placement half is then
  rebuilt on it, so there is one placement check". It also removes [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s `model/label.ts` edge.
- **Effort:** Medium. The state reading and the placement half move onto public blocks; the box and
  `deferred: none` halves are [plan 0504](./0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md)'s.
- **Created:** 2026-10-19
- **Builds after:** [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md) (block 5).
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3.

## Problem

`honestyAtClose` (`packages/md/src/rules/ledger.ts`) reads a record's state with its own reader,
`findStateRe`, `headerStateViolation`, `stateUnderAnotherLabel` and `isDoneItem`, over
`labelPattern`, `LABEL_HEADING`, `PLAIN_LABEL` and `wrappedLabelOf` from `model/label.ts`, none of
them root blocks. [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3 requires a preset built from the roots, and
`md/rules-import-only-the-root` carries the `model/label.ts` edge as an exclusion, pinned by
`md/rules-ledger-debt-is-current-label` and by `packages/md/tests/rules/ledger-debt.test.ts`. Once
block 5 ships, the state reading and the placement half have public blocks to stand on: `fields()`
and `haveField` for the value, `agreeWithFolder` for the placement. And this repository has
placement checks for the same fact in three rules (`ledger/state-folder-mismatch`,
`corpus/closed-records-sit-in-done-folders`, and [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s `corpus/done-folders-hold-done-values-*`).

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
     `'rest'` group it would be F2 in every direction ([plan 0495](./completed/0495-a-value-agrees-with-its-folder.md): with `'rest'`, a one-way rule is
     made by the selection), which is why the option maps to a selection and not only a direction
     (PR #246's verification, architect N1 and product N1, decision E2). An open state in a done
     folder is then a value in no group: F3, not F2, a message change listed below.
   - **F7 on the preset's five defaults.** With no `doneFolders` given, the preset builds its five
     default globs through [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s internal mark, so F7 fires once, only when every default
     folder matches nothing ([plan 0495](./completed/0495-a-value-agrees-with-its-folder.md), decision E3). The caller did not type them, and most lanes
     have two of the five.
   - **F7 on a caller's names** (PR #246's final enforcement check, decision G2). A caller's
     `doneFolders` names are the caller's: their globs are unmarked, so a misspelt name is F7, per
     name, as [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md) gives any caller-written glob. Marking them too, as the previous revision of
     this plan did, hides a typo whenever another done folder of the lane exists. With
     `doneFolders: ['fixed', 'rejectd']`, the real `rejected/` is bound to `'rest'` and an open
     record there agrees; under `closeInPlace` it is never selected at all.
   - **A done folder with no record yet is declared, per name.** A `doneFolders` entry is a name or
     `{ name, mayBeEmpty: true }`, typed `readonly (string | { readonly name: string; readonly
mayBeEmpty: true })[]`. A `mayBeEmpty` name is still bound (a first record filed there is
     judged), and its glob alone is exempt from F7; nothing else changes. It is explicit and
     reviewable, as `.expectEmpty()` is for a rule that may examine nothing, never implied for every
     name.
   - **F7 is judged within the lane** (PR #246's last enforcement check, R2). For every glob the
     preset builds, from its defaults or a caller's names, F7 asks whether the glob matches a
     document of the preset's own corpus, its roots, not any path the repository holds. A name
     that is wrong for this lane but real in another (`/rejected/` for proposals, real only under
     `work/bugs/`) is then F7 rather than masked. [Plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s own F7 reads the corpus's file index
     (the repository); the preset narrows it because a lane's done folder is the lane's.
   - **This repository's lanes** (`scripts/lib/ledger-lanes.mjs`) declare `/wont-do/` and
     `/archived/` for plans and `/rejected/` for proposals as `mayBeEmpty`. Measured with
     `git ls-files`: no path has a `wont-do/` segment; the six with `archived/` are test fixtures
     under `packages/md/tests/fixtures/` and `scripts/nonvacuity/`, none in `work/plans/`; and the
     two with `rejected/` are under `work/bugs/rejected/`, none in `work/proposals/`. Judged within
     each lane, all three would be F7 today without the declaration.
   - **What `mayBeEmpty` cannot see, and its expiry** ([ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 7; R3). A typo inside a
     `mayBeEmpty` entry (`{ name: 'wontdo', mayBeEmpty: true }`) is exempt from F7 by
     construction, as `.expectEmpty()` is exempt from the zero-examined finding. So the exemption
     lasts only as long as its reason: a `mayBeEmpty` name whose glob now matches a record of the
     lane is a finding, `` `wont-do` is declared mayBeEmpty but holds 1 record; drop
mayBeEmpty ``, suppressible, so the declaration is removed when the first record is filed and
     a stale one cannot outlive the folder it was written for. A misspelt `mayBeEmpty` name stays
     a residual: it is dead, so it never expires, and review reads it.
   - **Frozen documents are selected explicitly,** by the done-folder globs, not through
     `corpus()`'s default frozen folders, so [bug 0497](../bugs/0497-corpus-freezes-two-folder-names-by-default.md)'s break does not move this rule's fixtures.
3. **`ledger/unknown-state` stays,** over every record the preset reads, not only the bound folders:
   it is what reports a misspelt state in a live folder ([plan 0495](./completed/0495-a-value-agrees-with-its-folder.md), decision D8). Block 5's F3 covers
   only bound folders.
4. **The edge.** `model/label.ts` leaves `ledger.ts`; its `LEDGER_DEBT` entry in `arch.rules.ts`, its
   pin and its four symbols in `packages/md/tests/rules/ledger-debt.test.ts` go in the same commit
   (the pin reds otherwise). [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s row for the edge becomes `gated`.
5. **One placement check here.** Measured on the rebuilt preset, decide which of the three rules
   above stays: the ledger's half covers both directions for all three lanes, so a `check:corpus`
   rule is kept only where it judges what the ledger does not. [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s clause 7 witness
   (`corpus/closed-records-sit-in-done-folders`) is kept, or moved in the same change as its row.

## The verdict changes, a break

Block 5 judges what `headerStateViolation` did not:

- **F4:** a record in a done folder with no `State` is a finding. Today it is "not an item"
  (`packages/md/src/rules/ledger.ts:473`, `return null`).
- **F5/F6/F7:** an unreadable value and a record under two groups' folders are findings. F7: on
  the defaults, only when none of the five default folders matches anything; for a caller's
  `doneFolders`, each name that matches nothing and is not `mayBeEmpty`. An adopter listing a done
  folder it has not created gets F7 and adds `mayBeEmpty: true` to that name: a migration line.
- **Under `closeInPlace`:** an open state in a done folder is F3 ("none of the declared values"),
  not today's `State: X but filed in a done-folder` message.
- **The rule id** of a placement finding changes if the build keeps block 5's own, and a
  `.excluding()` entry keyed on `ledger/state-folder-mismatch` then stops matching.
- **Messages** change to block 5's.

Each is listed in the changeset with its migration line, and the changeset names the dependants
([bug 0185](../bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)).

## Phases

1. The state reading on public blocks; `model/label.ts` removed with its pin and test entries.
2. The placement half on `agreeWithFolder`, `closeInPlace` mapped; the ledger fixtures green, each
   changed verdict listed.
3. The repository's placement rules reconciled; [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s and [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s rows updated in the same
   change.

## Files changed

- `packages/md/src/rules/ledger.ts`
- `arch.rules.ts`
- `packages/md/tests/rules/ledger-debt.test.ts`
- `packages/md/tests/rules/` (rows for the rebuilt half)
- `adr/022-eess-mds-root-fixes-no-documents-shape.md` (Enforcement rows)
- `scripts/lib/ledger-lanes.mjs` (`/wont-do/` and `/archived/` for plans, `/rejected/` for
  proposals, as `mayBeEmpty` names)
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs` (if a placement rule is retired)
- `.changeset/`

## Test inventory

- The existing ledger tests green, unchanged, or each changed verdict listed under "The verdict
  changes". The fixtures as they stand after this plan merges are [plan 0504](./0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md)'s baseline: its proof
  of [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md) decision 3 ("fixtures unchanged") is measured against them, not against the
  fixtures at `9675402`, and the verdicts this plan changes are those listed in its changeset
  (PR #246's verification, method N1, decision E5).
- `closeInPlace`: a closed record in a live folder is not selected and not reported; an open record
  in a done folder is still reported, as F3. Without `closeInPlace`, both are F2.
- Defaults: a lane with `completed/` and none of the other four default folders gets no F7; a lane
  with none of the five gets one.
- A caller's names: `doneFolders: ['fixed', 'rejectd']` beside a real `rejected/` holding a `Draft`
  record, under `closeInPlace`: F7 names `**/rejectd/**`; without `closeInPlace`, the same. A
  `{ name: 'wont-do', mayBeEmpty: true }` over a lane with no `wont-do/`: no F7, and a `Won't-do`
  record filed there later is judged, and the stale-declaration finding names `wont-do`.
- Within the lane: a proposals lane with `doneFolders: ['promoted', 'rejected']` and no
  `work/proposals/rejected/`, beside a real `work/bugs/rejected/`: F7 names `**/rejected/**` for
  the proposals lane.
- `label: 'Status'` with `aliases`: placement read through the alias. [Bug 0444](../bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md)'s fix already has a
  row for the label reaching the state reader (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`);
  this one is new for the rebuilt placement half.
- A misspelt state in a live folder: still `ledger/unknown-state`.
- A first record filed in a done folder no rule bound before (`work/plans/wont-do/`): still judged,
  so the merge keeps what `ledger/state-folder-mismatch` covers today (PR #246, architect M10 and
  enforcement M7).
- The sabotage: a rebuilt half that drops one direction reds its row; `closeInPlace` mapped to
  `right-to-left` while keeping the `'rest'` group and the whole selection (the first draft of this
  plan) reds the `closeInPlace` row, since the closed record in a live folder is then F2; the
  internal mark dropped, so the default done folders give F7 each, reds the defaults row; the mark
  applied to a caller's names (the previous revision's design) reds the `rejectd` row, since F7 is
  then silent and the `Draft` record in `rejected/` unjudged; `mayBeEmpty` ignored reds the
  `wont-do` row; F7 judged over the repository's paths instead of the lane's documents reds the
  proposals `rejected` row; the stale-declaration finding dropped reds the `wont-do` row's second
  half.
- `check:arch` green with the label exclusion and its pin gone.

## Release

`@nielspeter/eess-md` minor, `**Breaking**`-flagged: the verdict changes above, a migration line for
each, and the dependants named ([bug 0185](../bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)).

## Out of scope

- The box and `deferred: none` halves, the `model/task-items.ts` and `model/prose.ts` edges, and
  [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md) decision 3's closing proof: [plan 0504](./0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md).
- `honestyAtClose` leaving eess-md: the maintainer's decision ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 3).
- `corpus()`'s default frozen folders: [bug 0497](../bugs/0497-corpus-freezes-two-folder-names-by-default.md).

## Review — 2026-10-19

From PR #246: `closeInPlace` kept and mapped to `right-to-left`, and the verdict changes declared as
a break with a Release section (product I3, decision D9); this plan removes only the
`model/label.ts` edge, and [plan 0504](./0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md) owns the other two and the closing proof (method I1,
architect I4, decision D10); `ledger/unknown-state` kept (decision D8); unbound done folders keep
their coverage (architect M10, enforcement M7); [bug 0444](../bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md)'s existing row named (method M4).

From PR #246's verification round: `closeInPlace` selects the done folders and binds only the done
group, with no `'rest'` group (decision E2, architect N1, product N1); the default done-folder
globs carry [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s internal mark, so F7 fires only when all are dead (decision E3, architect
N2); after the final enforcement check, a caller's names are not marked, and a done folder with no
record yet is declared per name with `mayBeEmpty: true` (decision G2), reverting this plan's own
earlier extension of the mark; from the last enforcement check, F7 is judged within the lane, the
proposals lane's `/rejected/` is declared `mayBeEmpty`, and a stale `mayBeEmpty` is a finding (R2,
R3); [plan 0504](./0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md)'s baseline is the post-0498 fixtures (decision E5, method N1); frozen documents selected
explicitly (method N1's carried condition).
