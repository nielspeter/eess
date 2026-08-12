# ADR-0007

Cites a test in the modifier form the citation regex already permits — the ADR
side has always accepted `it.skip('…')`, and before bug 0105 the AST side could
never produce a match for it.

## Enforcement

| Clause      | Tier | Mechanism                                            | Status  |
| ----------- | ---- | ---------------------------------------------------- | ------- |
| pending one | 1    | vitest · `it.skip('a documented pending guarantee')` | pending |
