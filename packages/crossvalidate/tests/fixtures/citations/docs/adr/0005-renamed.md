# ADR-0005

Cites a test that exists nowhere, but whose truncation collided with the one
test in the `orphan/` project — bug 0104's false green.

## Enforcement

| Clause | Tier | Mechanism                                           | Status |
| ------ | ---- | --------------------------------------------------- | ------ |
| a rule | 1    | vitest · ``it('catches `GONE` in a deleted test')`` | gated  |
