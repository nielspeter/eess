# ADR-0006

Cites three tests written in modifier form. All three exist.

## Enforcement

| Clause      | Tier | Mechanism                                       | Status  |
| ----------- | ---- | ----------------------------------------------- | ------- |
| pending one | 1    | vitest · `it('a documented pending guarantee')` | pending |
| focused one | 1    | vitest · `it('a focused guarantee')`            | gated   |
| concurrent  | 1    | vitest · `it('a concurrent guarantee')`         | gated   |
| a todo      | 1    | vitest · `it('a todo guarantee')`               | pending |
