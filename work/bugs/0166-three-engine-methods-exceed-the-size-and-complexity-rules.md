# Bug 0166: three engine methods exceed the size and complexity rules

## Status

- **State:** Draft — reproduced by `npm run check:arch`, which is RED on exactly
  these four findings and nothing else.
- **Found:** 2026-08-19, finishing plan 0165's arch-violation sweep (202 → 4).

## Symptom

`npm run check:arch` fails with four findings across three methods:

| method                                      | complexity | span | **code** |
| ------------------------------------------- | ---------: | ---: | -------: |
| `CorrespondenceBuilder.collectViolations`   |     **20** |  168 |   **88** |
| `TerminalBuilder.collectWithAssertionGuard` |     **15** |  122 |       36 |
| `SliceRuleBuilder.emptyDiscoveryMessage`    |          — |  113 |   **72** |

Thresholds are complexity 10 and 50 lines.

## Root cause

Two different causes, and they need separating because only one is a real smell.

**Complexity is genuine.** `cyclomaticComplexity()` counts branches, not
comments, so 20 and 15 are honest measurements of methods that really do branch
that much. `collectViolations` walks two sides, four declaration kinds and three
directions; `collectWithAssertionGuard` is the assertion gate's whole precedence
ladder.

**Length is half genuine.** `maxMethodLines` uses `linesOfCode()`, which is
`end - start + 1` — the SPAN, comments included (`tests/helpers/complexity.test.ts`
pins that deliberately: _"counts span lines"_). Of the seven methods the rule
flagged during plan 0165, five were under 50 lines of actual code and over only
because this codebase comments densely on purpose; those five are excluded in
`arch.internal.rules.ts` with the measurements recorded. These two are not —
88 and 72 code lines are over the bar on their own.

## Fix

Split each method. `collectViolations` has natural seams already visible in its
own structure (per-side materialization, the declaration checks, the direction
walk). `emptyDiscoveryMessage` splits cleanly by discovery mode — `matching` vs
`assignedFrom` — which are two independent fault ladders sharing only a tail
string.

**Not attempted in plan 0165 deliberately.** A mechanical split of
`emptyDiscoveryMessage` was tried and reverted: brace-counting cannot see into
the template literals these methods are mostly made of, and hand-splitting the
assertion gate and the correspondence engine at the end of a long session is how
a regression ships. `terminal-builder.ts` is also the file plan 0165 Phase 2
named as waiting on the kernel project-abstraction ADR, so splitting it before
that decision is work done twice.

## Verification

- [ ] `npm run check:arch` green with no new exclusion — the two length findings
      must go away because the methods got smaller, not because a rule stopped
      looking.
- [ ] `packages/ts/tests/builders/correspondence-*.test.ts`,
      `tests/core/assertion-gate.test.ts` and `tests/builders/slice-rule-builder.test.ts`
      all still green, including `it('EVERY remedy is true: applying what each message says fixes the rule')`
      — the row that proves `emptyDiscoveryMessage`'s every branch offers a
      remedy that works.
- [ ] The measured code-line counts in `arch.internal.rules.ts`'s comment are
      updated, or the comment removed if the exclusion is no longer needed.

## Related

- [Bug 0164](./0164-rulebuilder-carries-the-assertion-gate-and-exceeds-its-own-size-rules.md)
  — the same shape one level up: a class over its size rule because the assertion
  gate needs overridable hooks.
- [Plan 0165](../plans/0165-integrate-the-copied-ts-archunit-engine.md) — the
  sweep that took `check:arch` from 202 findings to these four.
