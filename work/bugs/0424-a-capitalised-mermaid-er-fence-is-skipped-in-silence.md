# Bug 0424: a capitalised Mermaid ER fence is skipped in silence

## Status

- **State:** Draft — measured 2026-10-15 on the branch fixing bug 0423. No red test yet.
- **Severity:** High — a false green (`BUGS.md`'s High row). An `erDiagram` in a fence tagged
  ` ```Mermaid ` whose attribute the property table lacks is not compared, and nothing is reported.
- **Origin:** self-found · fixing bug 0423, 2026-10-15. The same defect on the ER binding's path,
  recorded rather than folded into that fix.
- **Reported:** 2026-10-15

## Symptom

`tableErAgree` over `packages/crossvalidate/tests/fixtures/table-er/bad-extra-attribute.md` with its
fence retagged ` ```Mermaid `: the phantom attribute is not reported, and `tableErStats` gives
`{"docs":0,"entities":0,"attributes":0}`. Tagged `mermaid`, the attribute is reported.

## Root cause

`md-mermaid-er.ts` selects `b.lang === 'mermaid' || b.lang === null`, an exact comparison, as
`md-mermaid.ts` did before bug 0423's fix.

## Fix

Use the case-insensitive `isMermaidTag()` that bug 0423's fix added to
`packages/crossvalidate/src/shared.ts`, keeping the `lang === null` case.

## Verification

- [ ] Red test first, through `tableErAgree`: the retagged fixture reports the phantom attribute.
- [ ] `npm run validate` green.

Deferred: none
