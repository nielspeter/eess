# Bug 0424: a capitalised Mermaid ER fence is skipped in silence

## Status

- **State:** Fixed — 2026-10-15, in the PR that closes it. Measured the same day on the branch fixing
  bug 0423.
- **Severity:** High — a false green (`BUGS.md`'s High row). An `erDiagram` in a fence tagged
  ` ```Mermaid ` whose attribute the property table lacks is not compared, and nothing is reported.
- **Origin:** self-found · fixing bug 0423, 2026-10-15. The same defect on the ER binding's path,
  recorded rather than folded into that fix.
- **Reported:** 2026-10-15

## Symptom

`tableErAgree` over `packages/crossvalidate/tests/fixtures/table-er/bad-extra-attribute.md` with its
fence retagged ` ```Mermaid `: the phantom attribute is not reported, and `tableErStats` gives
`{"docs":0,"entities":0,"attributes":0}`. Tagged `mermaid`, the attribute is reported. On its own the
retagged fixture still goes red, with the kernel's empty-evidence finding; beside any other ER diagram
the run passes (PR #214's review).

## Root cause

`md-mermaid-er.ts` selects `b.lang === 'mermaid' || b.lang === null`, an exact comparison, as
`md-mermaid.ts` did before bug 0423's fix.

## Fix

Use the case-insensitive `isMermaidTag()` that bug 0423's fix added to
`packages/crossvalidate/src/shared.ts`, keeping the `lang === null` case.

## Verification

- [x] Red test first, through `tableErAgree`: `packages/crossvalidate/tests/md-mermaid-er.test.ts`, the
      bug 0424 test, over `tests/fixtures/table-er/bad-capitalised-extra-attribute.md`, reports the
      attribute and counts the document. Red before the change.
- [x] A sabotage: restoring the exact comparison turns that test red.
- [x] A non-vacuity case: `scripts/nonvacuity/bad-md-mermaid-er.mjs` now also requires
      `bad-md-mermaid-er/capitalised-er.md`'s attribute. It fires with the fix and goes vacuous (exit 0)
      with the exact comparison restored, naming the skipped fence.
- [x] The selector's other branches pinned too (PR #215's review): an untagged `erDiagram` is still read
      (`bad-untagged-extra-attribute.md`), and one in a `sql` fence is not (`sql-tagged-er.md`).
      Dropping the untagged case, or accepting every tag, now turns a test red.
- [x] `npm run validate` green on this branch.

Deferred: none
