# Bug 0166: three engine methods exceed the size and complexity rules

## Status

- **State:** Fixed — all three methods split; `npm run check:arch` green, and no
  new exclusion was added to get there.
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

**Not attempted in plan 0165 deliberately** — a mechanical split was tried there
and reverted, because brace-counting cannot see into the template literals these
methods are mostly made of. Done here by hand instead, one method at a time, with
the suite run after each.

### What was split

| method                                      | before                       | after                                                                                                        |
| ------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SliceRuleBuilder.emptyDiscoveryMessage`    | 72 code / 113                | → `matchingDiscoveryMessage`, `assignedFromDiscoveryMessage`, `faultGroups` (2 code lines)                   |
| `TerminalBuilder.collectWithAssertionGuard` | complexity 15                | → `assertionLessFinding`, `evidenceFloor` (complexity under 10, 15 code lines)                               |
| `CorrespondenceBuilder.collectViolations`   | complexity 20, 88 code / 168 | → `unboundDeclarationFindings`, `emptinessFindings`, `matchFindings`, `duplicateKeyFindings` (35 code lines) |

The correspondence split introduced a `Pairing` type: six values travel together
through those four phases, and passing them positionally would have put every
helper over the four-parameter cap while inviting the transposition that cap
exists to prevent (`aKeyed` and `bKeyed` are the same type).

`CorrespondenceBuilder.collectViolations` also needed two long contract notes
moved into its JSDoc — where they belong, since they describe the method's
contract rather than any line inside it, and `linesOfCode()` measures from the
declaration rather than from the doc block. Same words, no deletion.

**One thing found on the way:** `terminal-builder.ts`'s assertion-gate finding
moved from `collectWithAssertionGuard` into `assertionLessFinding`, and
`tests/core/every-config-finding-is-classified.test.ts` caught it immediately —
its census is keyed by `file::method`, so the producer's new address had to be
recorded. That is the census working, not a cost of the split.

## Verification

- [x] `npm run check:arch` green with no new exclusion — verified by removing the
      `maxMethodLines` carve-out entirely and re-running: the four classes it
      still covers are all under 50 lines of CODE, and neither of this bug's two
      length findings reappears. They went away because the methods got smaller.
- [x] `tests/builders/correspondence-builder.test.ts`, `tests/core/assertion-gate.test.ts`
      and `tests/builders/slice-rule-builder.test.ts` green, including
      `it('EVERY remedy is true: applying what each message says fixes the rule')`.
      Whole suite diffed against a pre-refactor baseline: **zero new failures,
      3476 passing** — the 27 that remain are upstream's own corpus, unchanged.
- [x] The measured counts in `arch.internal.rules.ts` are updated — re-measured
      after the split, with the two fixed methods removed from the table and a
      note saying they were fixed by splitting rather than by joining the list.
- [ ] `deferred→`[bug 0167](../0167-method-size-rules-can-only-be-excluded-by-class.md) —
      the exclusion is still per-CLASS, because `.excluding()` filters the rule's
      subject and a method-size rule's subject is the class. A future oversized
      method in one of the four excluded classes would not fire. Named here
      rather than left implicit; it is a limitation of the rule, not of this fix.

Deferred: [bug 0167](../0167-method-size-rules-can-only-be-excluded-by-class.md).

## Related

- [Bug 0164](../0164-rulebuilder-carries-the-assertion-gate-and-exceeds-its-own-size-rules.md)
  — the same shape one level up: a class over its size rule because the assertion
  gate needs overridable hooks.
- [Plan 0165](../../plans/0165-integrate-the-copied-ts-archunit-engine.md) — the
  sweep that took `check:arch` from 202 findings to these four.
