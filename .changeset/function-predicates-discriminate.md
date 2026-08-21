---
'@nielspeter/eess-ts': none
---

`arePublic`, `areProtected`, `arePrivate` and `areNotAsync` gain the tests that
can falsify them — bug 0187.

**Declared `none` because nothing a consumer can observe changes.** All four
predicates are untouched; what ships is nine tests over a fixture that already
existed.

Worth stating even though it ships no version: all four were **unfalsifiable**.
Widened to `test: () => true`, so they filter nothing at all, the full suite
stayed green at 3519/3519. They were not untested — each had a `describe` block
— but every assertion was one-sided (`.toBe(true)` with no rejecting case) or
`.not.toThrow()` over a fixture chosen so the rule passes. Coverage that is
legible and false is the failure mode ADR-009 names.
