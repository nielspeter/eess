# Bug 0527: nothing counts the boxes an `'unjudged'` declaration takes out of scope

## Status

- **State:** Draft — recorded 2026-10-19 from PR #253's enforcement review (I4); read from the code,
  not reproduced.
- **Severity:** Low — the declaration is explicit and visible in rule code, so nothing is excluded
  without a trace in the source; the gap is that no run says how much it excluded.
- **Origin:** self-found · PR #253's enforcement review
- **Reported:** 2026-10-19

## Symptom

[Bug 0525](./fixed/0525-a-box-mark-can-be-declared-only-open-or-done.md) lets a caller declare a box mark `'unjudged'`. An unjudged box is neither open nor done, so
`areOpen()` and `areChecked()` do not select it, and `honestyAtClose` neither asks it for a
disposition nor counts it as finished. In the trial upgrade, declaring `'?': 'unjudged'` over a
corpus with 1,680 `[?]` boxes took them all out of every close rule, and no number in any summary
said so:

- `ledgerStats` and `check:ledger`'s summary count documents and done-items, not boxes by state;
- `honestyAtClose` selects with `areOpen()`, so unjudged boxes are not among the units it examines;
- a `taskItems()` rule's receipt counts the boxes it selected, not the ones a declaration removed.

A declared exclusion is allowed ([ADR-009](../../adr/009-agent-first-failure-surfaces.md)), but the others carry a denominator or expire:
`expectEmptyFrozen` and `expectEmptyRoots` expire once their glob matches, and `.excluding()` is
checked for staleness ([ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)). An `'unjudged'` declaration does neither and is not counted.

## Root cause

The count of boxes by declared state is computed nowhere a summary reads.

## Fix

Count unjudged boxes where the summaries already count: `honestyAtClose`'s summary (or
`ledgerStats`) and a `taskItems()` rule's summary print "N boxes declared unjudged", so a declaration
that takes 1,680 boxes out of scope says so on every run. Red test first: a corpus with unjudged
boxes, and a summary that names their count.

## Verification

- [ ] Red test written first: a summary over a corpus with unjudged boxes names their count.
- [ ] `honestyAtClose` and `taskItems()` summaries print the unjudged count.
- [ ] `npm run validate` green.

Deferred: none
