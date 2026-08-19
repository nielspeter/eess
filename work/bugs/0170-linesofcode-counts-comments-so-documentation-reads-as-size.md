# Bug 0170: `linesOfCode` counts comments, so documentation reads as size

## Status

- **State:** Draft — fix built and measured; ready to close with this PR.
- **Found:** 2026-08-19, auditing the size-rule carve-outs in `arch.internal.rules.ts`.

## Symptom

`maxClassLines` and `maxMethodLines` report a class as oversized on the strength
of its documentation. Measured on this repo, comparing the span the metric
counts against the lines that actually carry code:

| Class                    | code | span | over 300 on…  |
| ------------------------ | ---- | ---- | ------------- |
| `ClassRuleBuilder`       | 150  | 366  | comments only |
| `FunctionRuleBuilder`    | 139  | 399  | comments only |
| `RuleBuilder` (core)     | 163  | 336  | comments only |
| `TerminalBuilder` (core) | 219  | 426  | comments only |
| `CorrespondenceBuilder`  | 373  | 628  | genuinely     |
| `TerminalBuilder` (ts)   | 552  | 1218 | genuinely     |

Six of nine class findings and two of four method findings are **entirely
artifacts of comment lines**.

This repo's own rule set makes the conflict direct: `eess/jsdoc-on-public-methods`
**requires** a doc block on every public method, and `eess/max-class-lines` then
counts those blocks as size. A fluent builder with twenty documented methods
cannot satisfy both. Satisfying one rule is what breaks the other.

## Root cause

```ts
export function linesOfCode(node: Node): number {
  return node.getEndLineNumber() - node.getStartLineNumber() + 1
}
```

It is a span, not a line count. The docstring is candid that it "includes blank
lines and comments", and justifies that two ways: it matches how editors report
length, and it "avoids the fragility of text-based comment stripping". The
second reason is the real one, and it does not apply — the comment ranges are in
the AST, so nothing needs to be stripped from text.

## The contract was never actually pinned

`tests/helpers/complexity.test.ts` has three cases titled _"counts span lines
for a class/method/function"_. Their assertions are `toBeGreaterThan(10)`,
`toBeGreaterThanOrEqual(3)` and `toBeGreaterThan(5)` — every one of which a
code-line implementation also satisfies. The titles claim a contract the
assertions cannot distinguish, so two earlier bugs
([0166](./fixed/0166-three-engine-methods-exceed-the-size-and-complexity-rules.md),
[0167](./0167-method-size-rules-can-only-be-excluded-by-class.md)) cited "the
tests pin this deliberately" for a behaviour nothing was holding in place.

## Fix

Count the distinct lines carrying at least one **token**. Comments are trivia
and never appear as tokens, so they are excluded structurally rather than by
pattern-matching text — which answers the docstring's own objection. Blank lines
carry no token either. JSDoc nodes are skipped explicitly: `getStartLineNumber()`
excludes them but `getChildren()` returns them, and counting them made an
element measure _larger_ than its own span.

A line carrying only `}` still counts — it is a source line, and this stays a
physical-source-lines metric, not a statement count.

## Verification

- [x] Red first: a function whose body is mostly comments and blank lines counts
      only its code lines — pinned to an exact number, not a bound. Confirmed red
      (`expected 8 to be 4`), then green — `complexity.test.ts` ·
      `it('counts neither comment lines nor blank lines')`.
- [x] JSDoc above a declaration is not counted —
      `it('does not count a JSDoc block above the declaration')`.
- [x] Sanity invariant across this whole corpus: the count never exceeds the
      node's span —
      `it('never reports more lines than the node spans, across the real corpus')`.
      This caught the first attempt, which counted JSDoc and so measured elements
      as larger than themselves.
- [x] The three misleading `"counts span lines"` titles are corrected, since
      after the fix they would name a contract the code no longer has.
- [x] `docs/api-reference.md` no longer documents it as "Count span lines", and
      `docs/metrics.md`'s "How Lines Are Counted" section is rewritten with a
      migration note.
- [x] The carve-outs this justified in `arch.internal.rules.ts` are re-measured
      and cut: `maxMethodLines` now has **none**, and `maxClassLines` keeps two
      named files instead of a folder. `maxMethods` (a count, untouched by this
      metric) moved from a `/src/builders/` folder exclusion to the nine fluent
      builders named explicitly, closing the same silent-inheritance hole.
- [x] `npm run validate` — no new failures (39 before, 39 after — all
      pre-existing), every `check:*` gate, typecheck, lint, format and
      `check:nonvacuity` green.

## Outcome, measured

| Rule             | findings before | after |
| ---------------- | --------------- | ----- |
| `maxClassLines`  | 9               | **2** |
| `maxMethodLines` | 4               | **0** |

The two classes that remain — `CorrespondenceBuilder` (329 code / 628 span) and
`TerminalBuilder` (372 / 1218) — are genuinely over on code and are owed a split
by [bug 0164](./0164-rulebuilder-carries-the-assertion-gate-and-exceeds-its-own-size-rules.md).
The kernel's own `terminal-builder.ts` (215) and `rule-builder.ts` (139) pass and
are no longer excluded.

## Out of scope

That a method-size carve-out can only be expressed per class — that is
[bug 0167](./0167-method-size-rules-can-only-be-excluded-by-class.md), and it
stays true afterwards for the elements that genuinely remain over.
