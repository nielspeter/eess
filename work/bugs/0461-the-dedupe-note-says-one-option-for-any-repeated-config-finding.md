# Bug 0461: the dedupe note says "one option" for any repeated configuration finding

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's reviews (architect, product, enforcement).
- **Severity:** Medium — re-rated 2026-11-05 (was Low): the finding is right, but the sentence
  appended to it is runtime output that states something false about the reader's rules, an honesty
  gap between a claim and its mechanism on this board's scale, not documentation drift.
- **Origin:** self-found · PR #235's reviews, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`dedupeConfigFindings` (`packages/core/src/dedupe-config-findings.ts:69`) collapses repeated
configuration findings and appends `affectedNote` (`dedupe-config-findings.ts:56`): "This one option
generated N rules that cannot enforce anything; they are not listed separately because they are one
edit." That wording is written for a preset's fan-out. eess-md's code-block instrument finding
(`packages/md/src/builders/code-blocks.ts:119`, `bypassFilters: true`) is deduplicated the same way
when several rules read one failed parse, and so, read from the source and not yet reproduced, gets
the same note, which then names an option nobody set. [Plan 0454](../plans/completed/0454-box-marks-are-the-callers.md)'s undeclared-box-mark finding would be the third case.

## Reproduced 2026-11-05

Measured on `main` at 046afd0c (v0.17.0: eess 0.10.0, eess-md 0.14.0), built packages, from an
adopter's question ([proposal 027](../proposals/027-a-finding-says-whose-it-is-and-a-run-reports-it-once.md)).
A closed record `work/plans/completed/0001-p.md` holds, under `## Acceptance`, `- [?] deferred→BUG-1`
(line 7, `[?]` declared by no rule) and `- [ ] still open` (line 8). Two `taskItems(c, { marks: { '~': 'open' } })`
rules (`areOpen()`, `inDocuments(resideInFolder('work/plans/completed/**'))`,
`inSections(sectionsNamed(/^Acceptance$/))`, `notExist()`) and `honestyAtClose`:

- each rule reports its own finding for the open box at line 8 (`… should not exist (under
"Acceptance", line 5)`), and `honestyAtClose` reports `ledger/silent-open-box` at line 8: all three
  enforce;
- each of the three also reports `md/undeclared-box-mark` at line 7, the identity
  [plan 0454](../plans/completed/0454-box-marks-are-the-callers.md) intends to collapse across rules;
- `dedupeConfigFindings` collapses those three to one, whose message ends: "This one option generated
  3 rules that cannot enforce anything; they are not listed separately because they are one edit."

So the box-mark case is no longer "would be": it is measured. The note reaches a test-runner caller
too, not only `eess-ts check`: `checkAll` (exported from the eess-ts root,
`packages/ts/src/core/check-all.ts:95`) runs the same collapse, and `checkAll` over two such builders
threw `ArchRuleError` with the finding ending "This one option generated 2 rules that cannot enforce
anything".

Measured: the box-mark class. Read from the source, not reproduced: the code-block instrument
(above). Earlier encounters with this note, each kept out of the collapse instead of fixing it:

- an expired declaration (`packages/ts/src/core/vacuity-diagnosis.ts:534`): ts-archunit's plan 0089's review
  measured 4 findings becoming 3, the survivor claiming two rules could not enforce;
- a false declaration (`packages/ts/tests/core/false-declaration-reports-both.test.ts:91`), which
  asserts the note never appears;
- an over-filtered detector (`packages/ts/tests/core/the-floor.test.ts:381`), ts-archunit's plan 0099.

For `zeroSubjectsViolation` the note is true and deliberate (`packages/ts/src/core/rule-builder.ts:433`):
N rules that cannot enforce are one edit. A fix keeps that case's meaning.

## Fix

The note states what was collapsed in terms that hold for every caller (N rules reported this same
finding), or takes its wording from the finding. Kept out of [plan 0454](../plans/completed/0454-box-marks-are-the-callers.md), which stays eess-md only.

## Verification

- [ ] Red first: two `codeBlocks()` rules over one failed parse, deduplicated, carry "This one option
      generated 2 rules"
- [ ] Green: the deduplicated finding's note names what was collapsed (two rules reporting one finding)
      and no option
- [ ] Red first, the box-mark class: two `taskItems()` rules and `honestyAtClose` over one undeclared
      mark, with a readable open box each rule reports, in
      `packages/md/tests/builders/task-items-marks.test.ts` beside
      `it('two rules over one corpus give one finding per cause after dedupe')`, which runs this
      collapse and asserts nothing about its message
- [ ] The code-block row (`packages/md/tests/code-block-parse.test.ts:184`) states the new note
- [ ] The count survives the rewording: [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s C3 row
      (`packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts:181` matches `/\b3\b/`)
- [ ] `zeroSubjectsViolation`'s collapse still says its rules cannot enforce anything
- [ ] A changeset naming `@nielspeter/eess`

Deferred: none
