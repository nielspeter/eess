# Bug 0623: the ledger reads the first of two states

## Status

- **State:** Fixed — 2026-11-06: two state lines that disagree are `ledger/states-disagree`. Measured
  2026-11-05 on `main` at 217133fa (eess-md 0.14.0).
- **Severity:** High — a false green: `honestyAtClose` passes a record that also says it is done,
  depending only on which of its two `State:` lines comes first.
- **Origin:** self-found · the enforcement review of
  [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md), 2026-11-05.
- **Reported:** 2026-11-05

## Symptom

A live plan, `work/plans/0009-x.md`, holding two states and an open box:

```markdown
# Plan 9

**State:** Draft
**State:** Done

## Tasks

- [ ] an open box
```

`honestyAtClose(c, { report: 'return' })` returns no finding. With the two lines swapped (`Done`, then
`Draft`) it returns two: `ledger/state-folder-mismatch` and `ledger/silent-open-box`. With `Done`
twice, the same two. `findState` returns the first line in each case.

`haveField` with the label `State` reads the same record as a conflict, measured: "State is given
twice (line 3 'Draft', line 4 'Done'); keep one". In this repository `check:corpus`'s
`corpus/state-present` (`scripts/check-corpus.mjs:434`) reads through `haveField` and so reports
it, but only for live plans and bugs; a caller running `honestyAtClose` alone has no backstop.

The documentation says `findState` is "exported so a caller can ask the question without a second
opinion" (`docs/markdown.md:1988`). It is a second opinion: it disagrees with `haveField` on two
states (the first wins), on an unclosed fence (`null`, no cause) and on the region.

## Root cause

`findState` (`packages/md/src/rules/ledger.ts:274`, through `findStateRe`) returns the first state it
reads, and `honestyAtClose` judges the record by it. Two state lines that disagree are not a
conflict to the ledger, as they are to `haveField` (`packages/md/src/model/field-verdict.ts`).

## Fix

Not designed. [Plan 0498](../../plans/0498-honestyatclose-places-a-record-with-block-5.md) moves the
ledger's state reading onto the root's field blocks, which would read two disagreeing states as
`haveField` does; whether this waits for it or is fixed first is the fix's decision. Either way two
disagreeing states are a finding, never the first of them, and the documentation stops calling
`findState` the only opinion.

## Fixed

`statesIn` (`packages/md/src/rules/ledger.ts`) collects every state line in the header region, and
`stateIn`, which `findState` and the folder checks use, returns its first. `headerStateViolation`
reports `ledger/states-disagree` when any state line differs from the first (by the same case and
apostrophe fold the vocabulary uses), at that line, before the state/folder check reads either, as it
does an unreadable token. Any line that opens with the label counts, an out-of-vocabulary value
included; when such a line may be prose (`State: kept in Redis`), the finding's remedy says to reword
it rather than delete it. The box checks still read the first line (`isDoneItem`), so the order decides
whether a box finding appears beside the conflict, pinned by
`it('Done then Draft: reported the same way; the box check still reads the first line')`. Two lines
that agree read as before.

In this repository the same record is red twice, under `corpus/state-present` (`haveField`) and under
`ledger/states-disagree`. The ledger's copy is the only one an adopter running `honestyAtClose` alone
has, so it is not a duplicate to remove.

This is fixed ahead of [plan 0498](../../plans/0498-honestyatclose-places-a-record-with-block-5.md),
which may later move the reading onto `haveField`'s and decide whether agreeing duplicates are a
conflict there too. `findState` is unchanged, and `docs/markdown.md` now says it is not `haveField`'s
reading. A state written under another label beside a read one is never compared; that is
[bug 0627](../0627-a-state-under-another-label-beside-a-read-one-is-never-compared.md), which predates
this fix.

## Verification

- [x] Red first: the record above, `honestyAtClose` reports the two disagreeing states
      (`packages/md/tests/rules/ledger-two-states.test.ts`, three rows red before the fix; the
      fold, an out-of-vocabulary second line, the heading form and the prose remedy pinned after the
      review, the fold row red when the fold is removed), and the
      `bad-ledger` non-vacuity row now plants it (`scripts/nonvacuity/bad-ledger/0009-states-disagree.md`).
- [x] `Done` twice: decided as unchanged, two findings and no conflict, because both lines say the
      same state; whether agreeing duplicates are a conflict is [plan 0498](../../plans/0498-honestyatclose-places-a-record-with-block-5.md)'s,
      if the ledger moves onto `haveField`'s reading. Pinned by `it('Done twice agrees, so it reads as Done, as before')`.
- [x] `docs/markdown.md`'s `findState` paragraph says how its reading differs from `haveField`'s,
      and the ledger's list of findings names `ledger/states-disagree`.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/two-states-that-disagree.md`.
- [ ] validation-owed — `npm run validate` on the final commit, before merge; ticked when it exits 0.

Deferred: none
