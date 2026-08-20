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
- [x] Every description of the metric matches the metric. The first pass fixed
      the prose section and the `linesOfCode` row and missed the tables an
      adopter actually reads to pick a threshold; review caught it. Swept:
      four JSDoc blocks in `predicates/metrics.ts`, `rules/metrics.ts` and
      `rules/metrics-function.ts` — which ship into the `.d.ts` and are what a
      consumer sees on hover — and eight rows across `docs/api-reference.md`,
      `docs/metrics.md` and `docs/standard-rules.md`. The only surviving
      mention of span lines is the migration note, which is describing the old
      behaviour on purpose.
- [x] The version marker names the release it actually ships in. It said
      "Changed in 0.3" — the version currently on the shelf with the OLD
      behaviour — so a reader on 0.3.0 would have concluded the warning did not
      apply to them. Confirmed by running `changeset version` in a scratch
      worktree: this lands in **0.4.0**.
- [x] The violation message says what it measured. "`TerminalBuilder` has 372
      lines" named a number the author cannot find in a 1218-line file; it now
      reads "372 code lines" (ADR-008: attribution, not colour). Safe for
      existing baselines — a metric finding sets `identity` explicitly, and
      `hashViolation` hashes `rule::identity`, so the message is not in the hash.
- [x] The carve-outs this justified in `arch.internal.rules.ts` are re-measured
      and cut: `maxMethodLines` now has **none**, and `maxClassLines` keeps two
      named files instead of a folder. `maxMethods` (a count, untouched by this
      metric) moved from a `/src/builders/` folder exclusion to the nine fluent
      builders named explicitly, closing the same silent-inheritance hole.
- [x] `npm run validate` — no new failures, every `check:*` gate, typecheck,
      lint, format and `check:nonvacuity` green. (The count first quoted here —
      "39 before, 39 after" — was measured with an instrument blind to
      file-level collection failures; the real per-package baseline is 30, and
      it is unchanged.)
- [x] The cost of the new metric is bounded. Review measured the first cut at
      81–330x the old arithmetic and +38% on `check:arch`; see below.

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

## The first cut was ~7x too slow — fixed here

Review measured `linesOfCode` at 81x, 110x and 330x the old `end - start + 1` on
three different runs, and `check:arch` at **+38% wall clock** (5.44s → 7.50s).

Profiling located it precisely, and it was not where any of us guessed. Over
this repo's source, walking every token costs **99ms** and reading their
POSITIONS costs **21ms** — but asking ts-morph for their line NUMBERS costs
**523ms**, five times the walk. `getStart()` returns a number the AST already
holds; `getStartLineNumber()` resolves it against the file's text on every call,
and the first cut called it once per token.

Two remedies were measured and rejected before this one:

- **Caching the code-line set per file** — no gain (849ms → 841ms). The whole
  file costs about what its classes cost, so deduplicating the nested walks buys
  nothing. The architect's review predicted this and was right.
- **`forEachDescendant`** — 3.5x cheaper, but it goes through `forEachChild`,
  which never visits punctuation, so it would silently drop the `}`-only lines
  this metric counts.

The fix takes positions from the AST and maps them to lines here, against a
newline table built once per file. **849ms → 116ms (7.3x), and `check:arch` is
back to 5.24s — below where it was before this bug.** Not text-based comment
detection, which would be genuinely fragile: a regex literal containing `//`
cannot be told from a comment without parsing. Deciding what is a comment stays
the AST's job; only offset-to-line arithmetic moved.

Correctness is proven by equivalence, not by argument: all **402** classes,
methods and functions in `packages/*/src` measure identically before and after,
zero differences.

One test got weaker and was replaced. `does not count a JSDoc block above the
declaration` no longer catches a dropped JSDoc skip, because counting is now
clipped to `[getStart(), getEnd()]` and leading JSDoc falls outside that range
anyway. `does not count a JSDoc block INSIDE the element` replaces it — a
documented method inside a class, which is the shape
`eess/jsdoc-on-public-methods` actually produces. Sabotage matrix: dropping the
JSDoc skip, dropping the comment-trivia skip, reverting to the span, and an
off-by-one in the new range clip are all caught.

## The thresholds, converted honestly

Changing what a metric counts without moving its thresholds is a silent
loosening. The median class here carries **0.50** code lines per span line, so
`maxClassLines(300)` had quietly become "600 span lines" — about double the bar
anyone agreed to.

**A first pass set 250/35 and called it re-derived. It was not.** 250 was chosen
because it fired on nothing new, which is fitting the bar to the code — the
failure this corpus exists to catch, committed while fixing an instance of it.
The honest number is the unit conversion: converting preserves the bar that was
intended, and _changing_ the strictness is a separate decision nobody made.

`maxClassLines(150)` and `maxMethodLines(30)` produced 13 findings.

**Eleven were fixed, not waived** — three oversized methods split, and six
classes split by concern rather than sliced to fit a number:

| class                         | before | after | the seam                               |
| ----------------------------- | ------ | ----- | -------------------------------------- |
| `Baseline`                    | 171    | 103   | matching vs diagnosing why nothing did |
| `DuplicateBodiesBuilder`      | 168    | 130   | the DSL vs the comparison algorithm    |
| `InconsistentSiblingsBuilder` | 204    | 142   | detecting vs selecting the files       |
| `CorrespondenceBuilder`       | 336    | 145   | the DSL vs constructing findings       |
| `SliceRuleBuilder`            | 237    | 137   | deciding vs explaining                 |
| `RuleBuilder`                 | 218    | 148   | the rule as declared vs the builder    |

**All thirteen were fixed.** The dialect's `TerminalBuilder` — the last and
largest at 372 — is now two classes rather than one: `RuleDeclaration` collects
the declaration, `TerminalBuilder extends` it and runs it. That is what the
rule's own message asks for ("consider splitting into focused classes"), and it
costs the ten subclasses nothing: they still extend `TerminalBuilder` and
inherit both halves, so the split is in one file rather than in their contracts.

Getting there took one wrong turn worth recording. Extraction alone stalled at
211: the three context accessors that decomposition needs — `facts()`,
`asRun()`, `filterContext()` — were 46 of the remaining lines, so each further
move cost about what it saved. The stated reason for stopping was that the
alternative "changes field access across ten subclasses"; that was asserted, not
measured. Measuring it found 82 such sites — so the claim was true, and
irrelevant, because splitting the class needs none of them.

**No carve-out survives.** `check:arch` is green on its own terms.

## Out of scope

That a method-size carve-out can only be expressed per class — that is
[bug 0167](./0167-method-size-rules-can-only-be-excluded-by-class.md), and it
stays true afterwards for the elements that genuinely remain over.
