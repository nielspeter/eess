# ADR-0008

Cites four things that are not citable tests. All four must stay unresolved —
before and after 0105 — or the fix widened more than it claimed.

The `test(…)` row is the one that matters most: md↔ts accepts `it` only while
`gherkin-ts` accepts `it` and `test`, and until this row nothing failed if
someone made them agree.

## Enforcement

| Clause         | Tier | Mechanism                                          | Status |
| -------------- | ---- | -------------------------------------------------- | ------ |
| templated      | 1    | vitest · `it('a templated guarantee %s')`          | gated  |
| conditional    | 1    | vitest · `it('a conditionally skipped guarantee')` | gated  |
| a suite        | 1    | vitest · `it('a suite that is not a test')`        | gated  |
| the test alias | 1    | vitest · `it('an alias-defined guarantee')`        | gated  |
