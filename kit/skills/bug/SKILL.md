---
name: bug
description: "Author a bug for a concrete defect in the code — confirm it is really a bug, take the next free number, follow the house shape from the corpus, reproduce with a red test FIRST, then fix to green, and hand to /close. A bug stands on its own; it needn't come from anywhere."
argument-hint: '<one-line symptom>   e.g. /bug status markers not shown for offline nodes'
---

# Author a bug (red test first)

A **bug** is _something wrong in the code, right there_ — a concrete defect. It can
stand entirely on its own; it needn't come from a plan or a case. This is the short
lane: author → reproduce → fix → close. (If it's not wrong-right-now but needs a
_how_ worked out, that's a `/plan`. If it came from a customer, log the `/case`
first and let it spawn the bug.)

Read the _shape_ from the corpus: skim a couple of recent bugs in
[`work/bugs/`](../../../work/bugs/) (and `fixed/`) and the board
[`BUGS.md`](../../../work/bugs/BUGS.md). Match what's there — **the corpus is the
template.**

## Run

1. **Confirm it's really a bug.** Wrong behaviour in existing code → bug. Needs
   design/unknowns worked out → `/plan`. Small enough to just fix → say so.

2. **Take the next free number.** Scan `work/bugs/` **and** `BUGS.md` for the
   highest `NNN`; use `NNN+1`. Guard against a collision.

3. **Write it in the house shape** at `work/bugs/NNN-slug.md` — symptom, repro,
   root cause, fix, plus a **verification** ledger. Header:
   `**State:** Draft — <free prose>`. Cite code as `path:line` (the corpus pointer
   gate grounds it). Put it on `BUGS.md`.

4. **Reproduce with a RED test first.** Write a failing test that captures the
   defect _before_ touching the fix. This is the one discipline models skip — a fix
   with no red-first test can't prove it fixed anything.

5. **Fix to green.** Make the smallest change that turns the red test green; run the
   suite so nothing else regresses.

6. **Hand to `/close`.** When it's merged-and-green, `/close` walks the ledger, says
   the deferral count out loud, moves the file to `bugs/fixed/`, and runs the gates —
   don't do that by hand.

## Guard (the failure models actually have)

**Fixing before reproducing.** No red test first → you can't prove the defect
existed or that it's gone. Red, then green.
