# Bug 0120: "this document has no state" and "I could not find its state" are the same answer — so the region heuristic can go blind again, one heading over

## Status

- **State:** Draft — the failure is constructed and verified against the shipped
  preset; the remedy is a design decision, which is why this is a record rather
  than a commit on [0119](./fixed/0119-placement-check-never-ran.md)'s PR.
- **Severity:** Medium — not a live false green (the corpus reads 59/59 today,
  and the count is printed on every run), but it is the mechanism that produced
  0119 and it is still armed at a different offset.
- **Origin:** self-found · enforcement and testing reviews of 0119's fix, which
  arrived at it independently
- **Reported:** 2026-08-12

## Symptom

`findState` returns `null` for two different situations, and the caller cannot
tell them apart:

1. **This document is not an item.** A README, a notes file, an ADR — no `State:`
   line, nothing to check. Silence is correct.
2. **This document is an item and I looked in the wrong place.** Its `State:`
   line exists, outside the scanned region. Silence is exactly wrong, and it is
   what bug 0119 was.

Both return `null`; `headerStateViolation` returns `null`; the gate says nothing.

Verified against the shipped preset — a document whose first section is not
`## Status`:

```markdown
# T

## Problem

something

## Status

- **State:** Done

## Verify

- [ ] undisposed
```

→ **no finding.** The placement check is skipped, the ledger half is skipped, and
the summary line reports a clean pass. That is 0119's signature — silence and a
substantiated-looking green — reproduced one heading later, in the fix for 0119.

## Root cause

The scanned region is a **heuristic about document shape**: originally "before
the first `##`", now "the preamble and the first section". Both are guesses that
happened to match, or not match, the corpus that motivated them. 0119 happened
because the guess and the corpus disagreed and nothing could say so.

Widening the guess again is not the fix; it just moves the offset. The fix is to
stop treating "I found nothing" as evidence of anything.

## Why it matters

This is a Tier-1 mechanism doing Tier-4 work — deciding _which line is this
document's state declaration_ — with no way to report that it could not decide.
Its failure mode is silence, which is the failure mode the whole preset exists to
eliminate.

The mitigation already shipped in 0119's PR is real and worth stating: the gate
now prints `29 scanned · 29 with a readable State · 16 done`, so a drift shows up
as a falling number instead of an unchanged green. That is what makes this a
deferral rather than an emergency. It is a smoke alarm, not a fix — someone still
has to notice the number.

## Fix

The decision, not yet made:

1. **Report the ambiguity.** Where a document is _known_ to be an item but has no
   readable state, say so (`ledger/state-not-found`). The non-heuristic version
   of "known to be an item" is folder membership: anything in a done-folder is
   definitionally an item, so a `completed/` document with no readable state is a
   finding with no guesswork. Catches the constructed case above when the
   document is closed; leaves the active lane uncovered.
2. **Drop the region.** Take the first line-anchored `State:` match anywhere in
   the document. Now defensible in a way it was not before — the label requires a
   colon and one of the bold/list forms, so prose no longer matches — but review
   demonstrated the over-read direction: a prose line that _begins_ with a state
   declaration and then discusses it shadows the document's real one, and emits a
   finding naming a state the document does not have. Wrong attribution is worse
   than silence.
3. **Require the section by name.** Read the `## Status` section specifically.
   Precise and self-describing, but it makes a heading name part of the contract
   for every adopter.

(1) is the smallest honest step and composes with either of the others later.
(2) needs the shadowing case closed first — probably "the _last_ match in the
region wins" or "a bolded `**State:**` beats a bare one".

## Verification

- [ ] Red test written first: a document whose first section is not `## Status`,
      in a done-folder, is reported rather than skipped. Silent today.
- [ ] A genuinely stateless document (a README) is still silent — the test that
      claims to cover this today points at a fixture carrying `**State:** Done`
      on line 3 and passes for the wrong reason.
- [ ] `withReadableState` stays at 59/59 for this corpus; the new finding must
      not fire on anything currently readable.
- [ ] A non-vacuity fixture and gate row, as the other three ledger rules now
      have.
- [ ] `npm run validate` green.

Deferred: none.
