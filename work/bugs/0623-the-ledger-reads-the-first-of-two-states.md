# Bug 0623: the ledger reads the first of two states

## Status

- **State:** Draft — measured 2026-11-05 on `main` at 217133fa (eess-md 0.14.0) against the built
  packages; no red test yet.
- **Severity:** High — a false green: `honestyAtClose` passes a record that also says it is done,
  depending only on which of its two `State:` lines comes first.
- **Origin:** self-found · the enforcement review of
  [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md), 2026-11-05.
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

`haveField` reads the same record as a conflict ("Status is given twice (line 3 'a', line 4 'b');
keep one", measured with the label `Status`). In this repository `check:corpus`'s
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

Not designed. [Plan 0498](../plans/0498-honestyatclose-places-a-record-with-block-5.md) moves the
ledger's state reading onto the root's field blocks, which would read two disagreeing states as
`haveField` does; whether this waits for it or is fixed first is the fix's decision. Either way two
disagreeing states are a finding, never the first of them, and the documentation stops calling
`findState` the only opinion.

## Verification

- [ ] Red first: the record above, `honestyAtClose` reports the two disagreeing states.
- [ ] `Done` twice stays as today (two findings, no conflict).
- [ ] `docs/markdown.md`'s `findState` paragraph says how its reading differs from `haveField`'s.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
