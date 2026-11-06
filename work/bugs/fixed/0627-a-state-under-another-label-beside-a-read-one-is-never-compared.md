# Bug 0627: a state under another label beside a read one is never compared

## Status

- **State:** Fixed — 2026-11-06 on `fix/0627-state-under-another-label`, second attempt. Beside a read
  state, a header line under another label whose whole value is a disagreeing state word, on a line
  that opens a field, is `ledger/states-disagree`, naming every such line. The shapes that stay quiet
  are listed under Fix. The defect was measured 2026-11-06 by the enforcement review of
  [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md)'s fix, on `fix/0623-two-states`
  (eess-md 0.14.0 plus that fix).
- **Severity:** High — a false green: `honestyAtClose` passes a live record that also says it is done,
  under a label the preset does not read.
- **Origin:** self-found · the enforcement review of
  [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md)'s fix, 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

A live plan with the default labels (`State`):

```markdown
# Plan 9

**State:** Draft

## Status: Done

## Tasks

- [ ] an open box
```

`honestyAtClose` returns no finding: the record is read as a live draft by its `State:` line, and the
`## Status: Done` heading, a state word under a label the preset does not read, is never looked at.
Without the `State:` line, the same heading is reported as `ledger/state-under-another-label`
([bug 0444](./0444-honesty-at-close-reads-state-only-and-says-nothing.md),
[bug 0476](./0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md)).
It predates [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md)'s fix and is the same false-green class under another label.

## Root cause

`stateUnderAnotherLabel` runs only when no state line under the labels in force was read
(`packages/md/src/rules/ledger.ts:846`, after the fix), so a record that has one is never checked for a state word
written under another label.

## Fix

A state word under another label beside a read state that disagrees with it is a finding, as two
disagreeing lines under one label are since [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md); one that agrees, or a value
that is not a state word, is not.

**The first attempt (690c114b) and why it was replaced.** It compared every state word the bug-0444
scan found under another label, reading a value by its prefix, and skipped a plain label on an
indented line that is no list item. Its enforcement review measured a false red on an adopter's
corpus (`- **Phase 1:** Done (40/40 pages)` beside `- **State:** Ready — near complete`) and a
whitespace test that missed a paragraph opened after a blank line. The design was taken back to an
architect review before the second attempt was built.

**The second attempt.** One scanner, `statesUnderAnotherLabel`
(`packages/md/src/rules/ledger.ts:382`), returns facts for each header line under another label.
The two paths read different facts:

- **The no-state path ([bug 0444](./0444-honesty-at-close-reads-state-only-and-says-nothing.md))** keeps its reading unchanged: a value that _starts_ with a state
  word, on any line. There, reading wide errs toward a finding.
- **The comparison** (`headerStateViolation`, the bug-0627 block at
  `packages/md/src/rules/ledger.ts:622`) reads two facts.
  - `whole`: the value, through `cleanValue`, cut by `untilDelimiter(['—', '–'])`, its trailing
    period dropped, must be a state word. These are the root's helpers, not a new cut.
  - `continuesItem`: a plain label on a later line of a paragraph inside a list item is that item's
    prose. A private walk over `doc.root`, memoised per tree (`continuesListItem`,
    `packages/md/src/rules/ledger.ts:363`), decides it. It is modelled on `blockOf` in
    `model/links.ts`, which [ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s root-only rule keeps out of the ledger's reach.

  Wrapped labels and headings count on any line. The comparison runs after the unknown-state check
  and before the folder check, and names every disagreeing line in one finding, at the first.

**What stays quiet.** The position rule is a measured choice, not a reading of intent. These
shapes stay quiet, and `docs/markdown.md` names them:

- a conflicting plain label continuing the State bullet, or any other bullet
  (`- **Owner:** Ann` then `  Status: Done`);
- a value in a blockquote;
- a value that only starts with a state word;
- an other-label heading after the first plain heading, which is compared only before it, as the
  bug-0444 path reads it (`## State: Done` at that boundary is read, `## Status: Done` is not);
- the read side still matches its own `State:` value by prefix, so the two sides differ on purpose.

A nested list item (`  - Previously: Draft`) is a field of its own: it is compared, so it fails
closed.

**Measured** with eess-md built from the second attempt:

- **This repo** (559 records): 0 findings. The first attempt's three false reds are quiet. They are
  history lines in [plan 0235](../../plans/completed/0235-the-emitter-takes-a-receipt.md), [plan 0237](../../plans/completed/0237-eess-runtime-use-only-in-rule-files.md) and [bug 0206](./0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md) (`Previously read: Ready/Draft — …`).
- **Two adopter corpora**, read-only, each with the same options against `main` (101199d4) and
  against this fix: identical findings, so no new red.
  - The first runs its own config: 157 records, all with a readable state, all compared. It is the
    one that writes `## Status: open` in bugs beside `- **State:**` in plans; `open` is not in its
    vocabulary, so it is quiet.
  - The second ran under the default vocabulary: 14 of its 557 plans and none of its 1,309 bugs
    have a readable state. That is 14 compared records, among them the first attempt's false red,
    now quiet.

**Not in this fix.** The no-state path reads a history line as a field too; that is
[bug 0630](../0630-a-history-line-is-read-as-a-state-under-another-label.md), recorded. `fields()`
reads a label-shaped line as a field on any line, so a ledger rebuilt on it ([plan 0498](../../plans/0498-honestyatclose-places-a-record-with-block-5.md)) must keep
this position rule or lose it on purpose; that is noted in [plan 0498](../../plans/0498-honestyatclose-places-a-record-with-block-5.md).

## Verification

- [x] Red first: the record above is reported
      (`packages/md/tests/rules/ledger-state-beside-another-label.test.ts`). Against `main`'s
      `ledger.ts`, the shipped file gives 11 failed and 11 passed, of 22. The first attempt's file
      gave 6 failed and 7 passed, of 13.
- [x] `**State:** Done` beside `## Status: Done` is not.
- [x] A `Status:` value that is no state word is not, nor one that only starts with one
      (`Phase 1: Done (40/40 pages)`).
- [x] A history line continuing the State bullet, indented or not, is not. A plain label opening a
      line, a paragraph or a list item is.
- [x] The non-vacuity fixture `scripts/nonvacuity/bad-ledger.mjs` holds the new shape in
      `0010-state-under-another-label.md`, judged at that file. Its clean `0002` holds a value that
      only starts with a state word and a history line.
- [x] A sabotage matrix of six mutants, each red, run in a worktree with its own install, the
      restored tree 22 of 22 and the fixture exit 1:

      | mutant | red in |
      | --- | --- |
      | prefix read, not the whole value | `it('a value that only starts with a state word is not a state')`; the fixture (exit 2, clean 0002 red) |
      | a list item continued read as a field | the two history tests (indented and not) and the stated limit; the fixture (exit 2) |
      | every paragraph continuation skipped, not only in a list item | `it('a plain label at the start of a line is a field, and is compared')`, `it('every disagreeing line is named in the one finding, at the first')` |
      | only the first disagreeing line named | `it('every disagreeing line is named in the one finding, at the first')` |
      | the comparison removed | every reporting test; the fixture (exit 0, vacuous) |
      | a trailing period not dropped | `it('a state word cut at the dash, marked up, or with a period is a state')` |

- [x] A changeset naming `@nielspeter/eess-md`, the break marked. eess-md's only dependent is
      crossvalidate, an optional peer, so none is named.
- [ ] validation-owed — `npm run validate` on the final code, recorded here with its exit code and
      time in the PR's last commit.

Deferred: none
