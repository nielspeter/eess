---
'@nielspeter/eess-ts': minor
---

**Breaking for subclasses of `SmellBuilder`:** `protected abstract examinedCount(): number` is now `abstract examinedUnits(): number`.

Two changes in one member, so a custom detector will fail to compile rather than
silently keep an unused method:

- **Renamed.** `examinedUnits` is the name the rest of the family uses for the
  ADR-010 evidence count, and `SmellBuilder` was the only surface still spelling
  it differently.
- **No longer `protected`.** The count is now readable from outside the class,
  because a caller deciding whether a rule was inert has to be able to ask. It is
  what `inertAdvice()` reports and what the zero-examined floor reads.

To migrate, rename the method and drop the `protected` modifier. The body is
unchanged: return the number of units this detector actually looked at — not the
number it could have looked at, and not a constant. A constant fails
`tests/core/evidence-at-every-seam.test.ts`, which requires the count to respond
to input in both directions.
