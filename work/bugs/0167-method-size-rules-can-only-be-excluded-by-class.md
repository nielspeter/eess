# Bug 0167: a method-size rule can only be excluded by class, so a carve-out hides its whole class

## Status

- **State:** Draft — the limitation is real but **no longer live**: see the
  update below.
- **Found:** 2026-08-19, closing [bug 0166](./fixed/0166-three-engine-methods-exceed-the-size-and-complexity-rules.md).

## Symptom

`arch.internal.rules.ts` carves four classes out of `maxMethodLines(50)`:

```ts
srcClasses()
  .excluding(/TerminalBuilder/)
  .excluding(/\/helpers\/baseline\.ts$/)
  .excluding(/\/smells\/(duplicate-bodies|inconsistent-siblings)\.ts$/)
  .should()
  .satisfy(maxMethodLines(50))
```

Each is excluded for ONE method that is under 50 lines of code and over on span
(the metric counts comments). But the carve-out is per class, so **every other
method in those four classes is also unwatched** — `TerminalBuilder` alone has
33 of them. A genuinely oversized method added there tomorrow would not fire.

## Root cause

`.excluding()` filters the rule's SUBJECT, and the subject of `maxMethodLines`
is the class (`srcClasses()`), not the method. The violation's `element` is
`Class.method`, but by the time that exists the subject has already been
selected — there is no per-method exclusion to reach for.

Two knock-on facts make it worse rather than cosmetic:

1. **The metric measures span, not code.** `linesOfCode()` is
   `end - start + 1` — `tests/helpers/complexity.test.ts` pins that deliberately
   ("counts span lines"). In a codebase whose other rule (`eess/jsdoc-on-public-methods`)
   REQUIRES a doc block on every public method, the two rules pull against each
   other, which is why these carve-outs exist at all.
2. **A per-method waiver has nowhere to live.** An inline
   `// eess-exclude eess/max-method-lines: …` above the method would be the
   natural shape and is how every other waiver in this repo works — but the
   finding is attributed to the class's line, not the method's, so the directive
   scan never sees it.

## Fix

Not decided. Three candidates, in rough order of preference:

- **Attribute the finding to the method's own line.** Then the existing inline
  directive works with no new API, and the carve-out becomes one comment above
  each method instead of four regexes in the rules file. Changes violation
  identity, so it needs a baseline note.
- **A code-only line metric** — `linesOfCode` counts span by pinned design, so
  this means a sibling (`sourceLinesOfCode`?) and an opt-in on the condition.
  Removes the reason most of these carve-outs exist.
- **Per-element exclusion on metric conditions** — `.excluding()` matching the
  violation `element` rather than the subject, for conditions that report
  sub-elements.

## Verification

- [ ] The four classes are watched again — adding a genuinely oversized method to
      `TerminalBuilder` reds `check:arch`.
- [ ] The existing four exemptions survive in some explicit, reviewable form; the
      fix must not simply raise or delete the threshold.
- [ ] `scripts/check-nonvacuity.mjs` proves whichever mechanism replaces the
      carve-out actually fires.

## Related

- [Bug 0166](./fixed/0166-three-engine-methods-exceed-the-size-and-complexity-rules.md) — deferred this.
- [Bug 0164](./0164-rulebuilder-carries-the-assertion-gate-and-exceeds-its-own-size-rules.md)
  — the same span-vs-code interaction at class level.

## Update, 2026-08-19 — no longer live, and one premise was wrong

[Bug 0170](./fixed/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md)
fixed `linesOfCode` to count code rather than span. All four methods this bug was
written about were under the threshold on code, so `maxMethodLines` now carries
**no exclusions at all** and no class is unwatched on its account.

The limitation itself stands — `.excluding()` still filters the subject, and the
subject of a method-size rule is still the class — so this stays open against the
next time a genuine per-method waiver is needed.

**Correction.** This bug asserted that `tests/helpers/complexity.test.ts` "pins
that deliberately ("counts span lines")". It did not. The three cases carrying
that title asserted `toBeGreaterThan(10)`, `toBeGreaterThanOrEqual(3)` and
`toBeGreaterThan(5)` — bounds a code-line implementation satisfies just as well.
The title claimed a contract the assertion could not distinguish, and this bug
(and [0166](./fixed/0166-three-engine-methods-exceed-the-size-and-complexity-rules.md))
cited it as settled fact. The titles are corrected as part of 0170.
