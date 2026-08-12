# ADR-0004

One citation per delimiter, each title holding a quote of another kind.

## Enforcement

| Clause    | Tier | Mechanism                                                            | Status |
| --------- | ---- | -------------------------------------------------------------------- | ------ |
| double    | 1    | vitest · `it("keeps a 'single quote' inside a double-quoted title")` | gated  |
| template  | 1    | vitest · ``it(`keeps a 'single quote' inside a template title`)``    | gated  |
| an escape | 1    | vitest · `it('it\'s a "quoted" phrase')`                             | gated  |
