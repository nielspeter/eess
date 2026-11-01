# Bug 0578: a returned receipt claims "declared empty" beside an unmet `expectNonEmpty`

## Status

- **State:** Draft — reproduced 2026-11-01 on [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  branch; no red test yet.
- **Severity:** Low — no false verdict: the finding is there and the run is red. The receipt
  beside it contradicts it, which a caller reading `report: 'return'`'s result can be misled by.
- **Origin:** self-found · [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  architect review; reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

`evidencedViolations` (`packages/core/src/terminal-builder.ts:291`) marks a receipt
`declaredEmpty: true` when zero units were examined and the condition carries the cardinality mark,
whether or not `.expectNonEmpty()` was declared. With it declared, the receipt holds the finding
"this rule examined nothing and was declared non-empty" and `declaredEmpty: true` together. The
same function already withholds the mark beside a selector fault, for this reason ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §3).

## Reproduction

`adrCitationsResolve(c, p, { dir: 'docs/none/**', expectNonEmpty: true, report: 'return' })` on the
fixtures in `packages/crossvalidate/tests/fixtures/citations` returns one
`crossval/adr-citations-resolve` finding, `examined: 0` and `declaredEmpty: true`.

## Fix

Withhold `declaredEmpty` when `.expectNonEmpty()` is declared, as it is withheld beside a selector
fault.

## Verification

- [ ] Red test written first: the reproduction's receipt carries no `declaredEmpty`.
- [ ] A cardinality-marked rule over zero subjects with no declaration still carries it.
- [ ] A changeset naming `@nielspeter/eess`.
- [ ] `npm run validate` green.

Deferred: none
