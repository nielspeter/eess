# Plan 0481: this repository dogfoods `notExist()`

## Status

- **State:** Done — built 2026-10-19 on branch `fix/fail-open-batch` (with [bugs 0508](../../bugs/fixed/0508-an-unknown-report-mode-prints-and-passes.md), 0499 and
  0506's crossvalidate half). Written 2026-10-18 at the maintainer's question ("are we dogfooding
  all these changes?"). [Plan 0456](./0456-kernel-notexist-and-dead-glob.md) shipped `notExist()` on every eess-md builder and the kernel's
  broken-selector check, and nothing in this repository's own gates used either: their only real
  use was `examples/md/unclaimed-and-double-claimed.test.ts`.
- **Priority:** Medium. The change is small, and until it lands the selector-fault check never runs
  on this repository's own globs.
- **Effort:** Small: one rule pair in `check:ledger`, the hand-written check it replaces kept or
  removed by measurement, one non-vacuity row.
- **Created:** 2026-10-18
- **Builds after:** [plan 0469](./0469-havefield-a-document-has-a-value.md) (the maintainer's batch order), before the release.
- **Built from State: Draft**, at the batch lead's instruction ("build it as written and close it");
  it was never promoted to Ready.

## Problem

`check:ledger` checks that every directory under `work/` is claimed by a declared lane with a
hand-written walk, `findUncoveredLanes` (`scripts/lib/lane-coverage.mjs:76`). That is [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s
block 6, "every document is claimed by one selection", written by hand. eess-md now states it in its
own blocks: two `notExist()` rules over the caller's selections ([plan 0456](./0456-kernel-notexist-and-dead-glob.md)'s recipe). Using them here
puts `notExist()` and the kernel's `cardinalitySelectorFault()` in front of this repository's own
globs, which nothing does today.

## Design

- In `scripts/check-ledger.mjs`, over a corpus whose only root is `work/**`: one rule that no
  document is outside every lane's root (`docs(c).that().satisfy(not(or(...lanes)))
.should().notExist()`), and one that no document is in two (`or(and(a, b), …)`), with the lanes'
  roots from `scripts/lib/ledger-lanes.mjs`.
- Measure first whether `findUncoveredLanes` reports anything the two rules do not (it judges
  directories that "carry records", not documents). Keep it only for what the rules cannot state,
  and say which in the record.
- A non-vacuity row: a probe document under a `work/` folder no lane claims reds the first rule at
  its path.

## Test inventory

- The probe row above, and a sabotage row: the first rule's selection widened to everything stays
  quiet on the probe (the second rule reds it, as the recipe says).
- `check:ledger` green on this repository with both rules, its summary naming their counts.

## Out of scope

- Rebuilding `honestyAtClose` from public blocks ([proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md), decision 1).

## Build notes

Where the build departed from the text above, each overrulable:

- **Five selections, not three.** `work/**` holds documents no lane reads on purpose: the spike
  lane (`work/spikes/`, 23 reports with no `State:`) and four notes at `work/`'s top level
  (`README.md` and three notes). The design's rule over the three lanes alone reds all of
  them. They are declared as `UNLANED` in `scripts/lib/ledger-lanes.mjs`, beside `LANES`, and both
  rules range over the five. Measured at the build, on base 7ef7a1d: 465 documents under `work/`, 0
  unclaimed, 0 claimed twice. The count grows with the corpus; the gate prints its own on every run.
- **`findUncoveredLanes` is kept, for what the rules cannot state.** Measured with two probes
  through `check:ledger --format json`: a page with no `State:` in a new folder under `work/` reds
  `ledger/unclaimed-document` and not `ledger/uncovered-lane`; a `State: Draft` record written
  into `work/spikes/` reds `ledger/uncovered-lane` and not the new rules, because the spike lane is
  claimed by `UNLANED`. Stating "an unlaned folder holds no record" as a rule would need a second
  reader of the State line beside `ledgerStats`'s, which is the duplication its docstring warns
  against. `scripts/lib/lane-claims.mjs` says which check catches what.
- **The rules live in `scripts/lib/lane-claims.mjs`**, called once from `check-ledger.mjs`; their
  receipts are two members of the gate's one receipt, and both appear in the verdict and the
  summary (on base 7ef7a1d: `claims  465 documents under work/ · 5 selections (3 lanes + 2 unlaned) · 0 unclaimed ·
0 claimed twice`). A holding `notExist()` receipt is declared empty by the kernel, so the merge
  does not read it as a pass without evidence.
- **The sabotage row is a gate row too**, `corpus/ledger/claimed-twice`. It does not widen to
  every document, as the design says: with every page claimed twice, the JSON `check-ledger.mjs`
  writes before `process.exit` was cut at 65,536 bytes through a pipe on macOS (measured with
  `spawnSync`), so the row could not parse it. It adds one selection too wide for the probe's
  folder and the proposals lane, which keeps the point (the first rule goes quiet on the probe, the
  second reds the doubled pages) and 18 findings. The truncation is a defect of `check:ledger`'s
  JSON path on any output past 64 KiB, and of six other gates with the same shape; it is recorded
  as [bug 0517](../../bugs/0517-a-gates-json-past-64-kib-is-cut-through-a-pipe.md).
- **Not this plan's:** the change to `check:corpus`'s `FROZEN` list (`**/wont-do/**` and
  `**/archived/**` removed, then restored and declared in `EMPTY_FROZEN` after review) belongs to
  [bug 0499](../../bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md)'s commits; this plan's corpus passes no frozen globs.

## Progress ledger

- [x] The two rules in `check:ledger`, measured against `findUncoveredLanes`
- [x] Non-vacuity and sabotage rows
- [ ] validation-owed: `npm run validate` and CI green on PR #251; duration reported (they run
      after this record is written; the result is reported on the PR, and CI is the gate)
- [x] Close: this plan → `completed/`; boards

Deferred: none

**Non-vacuity rows** (`scripts/check-nonvacuity.mjs`, both under `check:ledger`):

| row                                | what it does                                                                           | asserts                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `corpus/ledger/unclaimed-document` | plants `work/__nonvacuity_probe_unclaimed/notes.md`, no `State:`                       | exit 1, `ledger/unclaimed-document` at the probe's path                                       |
| `corpus/ledger/claimed-twice`      | the same probe, and `UNLANED` given `work/{proposals,__nonvacuity_probe_unclaimed}/**` | exit 1, no `ledger/unclaimed-document`, `ledger/claimed-twice` on a page in `work/proposals/` |

**Sabotage matrix, 2026-10-19**, on this commit's scripts, before this record was written. Each mutant applied, both rows run through the same
probe and rewrite as the gate rows (a standalone runner, not the whole `check:nonvacuity`), the file
restored with `git checkout`, tree clean after. Baseline: both rows ok.

| row | mutant                                                                   | red                                |
| --- | ------------------------------------------------------------------------ | ---------------------------------- |
| 1   | `claims.unclaimed` left out of the receipt and the verdict               | `corpus/ledger/unclaimed-document` |
| 2   | the second rule's selection replaced with the first's                    | `corpus/ledger/claimed-twice`      |
| 3   | the first rule's selection widened to every document (`work/**` claimed) | `corpus/ledger/unclaimed-document` |
