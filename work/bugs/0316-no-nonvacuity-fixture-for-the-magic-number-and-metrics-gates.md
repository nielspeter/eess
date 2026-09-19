# Bug 0316: no nonvacuity fixture proves the magic-number and metrics gates can fire

## Status

- **State:** Draft — measured. No KNOWN-GAP test: what is missing is the fixture itself.
- **Severity:** Medium — `check:arch` runs `eess/no-magic-numbers` (`arch.internal.rules.ts:195`),
  `eess/max-complexity` (`arch.internal.rules.ts:213`), `eess/max-method-lines`
  (`arch.internal.rules.ts:279`) and `eess/max-parameters` (`arch.internal.rules.ts:299`) over this
  repo, and `check:nonvacuity` plants a probe for none of them. A green from these four is evidence
  that they were declared, not that they can fire on this repo: a selector that went dead, or a
  condition wired wrongly, would stay green. Unit tests and 0306's sabotage matrix prove the
  conditions can fail; they do not reach the gate's wiring.
- **Origin:** raised as a minor by #137's first enforcement review, given no disposition, and raised
  again by its second; measured then.
- **Reported:** 2026-09-14

## Symptom

`scripts/check-nonvacuity.mjs` names one rule id that reads class code, `eess/no-silent-catch`
(`scripts/check-nonvacuity.mjs:677`). It names none of the four ids above.

## Root cause

The fixtures were added rule by rule, as bugs asked for them; 0306 changed how much these four read
and added none.

## Fix

A probe per rule id that plants a breach in a throwaway file, asserts the gate exits 1 and that the
finding is from that rule (`firedOn`), and cleans up — the shape of the silent-catch probe.

## Verification

- [x] Measured by reading `scripts/check-nonvacuity.mjs` against `arch.internal.rules.ts`.
- [ ] a probe per rule id, each shown to red `check:nonvacuity` when its rule is removed from the gate
- [ ] `npm run validate` green.

Deferred: none.
