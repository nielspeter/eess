# Bug 0380: `adrCitationsResolve` does not say whether a `test(…)` title can be cited

## Status

- **State:** Draft — a contract question, pinned by an existing fixture; no decision yet.
- **Severity:** Low — no false green. A `test(…)` title cited as `it('…')` is reported as
  missing, which is fail-closed; the cost is a false red and an undocumented contract.
- **Origin:** deferred from [0105](./fixed/0105-md-ts-drops-modifier-forms.md) to
  [0111](./fixed/0111-md-adr-citations-resolve-by-prefix.md), which owned "the
  three-implementation contract". 0111's ruling (2026-10-04) removed `eess-md`'s
  implementation, so the question now belongs to `eess-crossvalidate` alone and needed its
  own home.
- **Reported:** 2026-10-04

## Symptom

`gherkin-ts` accepts `test(…)` beside `it(…)`; `adrCitationsResolve` accepts only `it(…)` and
its modifier forms. `packages/crossvalidate/tests/fixtures/citations/docs/adr/0008-not-tests.md`
pins today's behaviour, so the answer cannot drift while it waits — but nothing states which
answer is intended, for the ADR convention in `CLAUDE.md` or for an adopter.

## Fix

Decide whether the ADR enforcement convention cites `test(…)` titles, then make
`adrCitationsResolve` and the convention text agree.

## Verification

- [ ] the decision, recorded where the convention is documented
- [ ] `adrCitationsResolve` and the fixture agree with it
- [ ] `npm run validate` green.

Deferred: none.
