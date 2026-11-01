# Bug 0598: a corpus fixture's terminal run checks only its exit code

## Status

- **State:** Draft — found 2026-11-01 by an enforcement review of
  [bug 0597](./fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)'s
  fix; no red test yet.
- **Severity:** Low — the JSON run already asserts the finding; the terminal run could pass on
  another finding's exit code.
- **Origin:** self-found · enforcement review, 2026-11-01.
- **Reported:** 2026-11-01

## Symptom

`gateCorpusAcceptedDenominatorEmpty` (`scripts/check-nonvacuity.mjs`) runs `check-corpus.mjs`
twice: with `--format json`, where it asserts the finding by its rule id, and in the terminal form
CI uses, where it asserts only exit code 1. Demoting the accepted rulings also makes the board's
Ruling column disagree with the files, so `corpus/proposal-board-ruling-drift` fires too. Measured
with the guard removed (2026-11-01): the terminal run still exits 1, on that other finding. So the
terminal half proves the gate exits non-zero, not that the terminal output reports this finding.

## Fix

Not designed. The direction: the terminal run also asserts the finding's rule id or message in its
output. The shared helper `corpusSabotage` (`scripts/check-nonvacuity.mjs:3879`) checks the
terminal run the same way, by exit code only, so its rows share the gap; whether to fix them
together is the fix's decision.

## Verification

- [ ] With the guard removed, the terminal half of the row fails on its own.
- [ ] `npm run validate` green.

Deferred: none
