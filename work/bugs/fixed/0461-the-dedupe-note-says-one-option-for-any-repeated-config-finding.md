# Bug 0461: the dedupe note says "one option" for any repeated configuration finding

## Status

- **State:** Fixed — 2026-11-05: the note says how many rules reported the finding and nothing
  else. Recorded 2026-10-18 from PR #235's reviews (architect, product, enforcement).
- **Severity:** Medium — re-rated 2026-11-05 (was Low): the finding is right, but the sentence
  appended to it is runtime output that states something false about the reader's rules, an honesty
  gap between a claim and its mechanism on this board's scale, not documentation drift.
- **Origin:** self-found · PR #235's reviews, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`dedupeConfigFindings` (`packages/core/src/dedupe-config-findings.ts:79`) collapses repeated
configuration findings and appends `affectedNote` (`packages/core/src/dedupe-config-findings.ts:69`): "This one option
generated N rules that cannot enforce anything; they are not listed separately because they are one
edit." That wording is written for a preset's fan-out. eess-md's code-block instrument finding
(`packages/md/src/builders/code-blocks.ts:148`, `bypassFilters: true`) is deduplicated the same way
when several rules read one failed parse, and so, read from the source and not yet reproduced, gets
the same note, which then names an option nobody set. [Plan 0454](../../plans/completed/0454-box-marks-are-the-callers.md)'s undeclared-box-mark finding would be the third case.

## Reproduced 2026-11-05

Measured on `main` at 046afd0c (v0.17.0: eess 0.10.0, eess-md 0.14.0), built packages, from an
adopter's question ([proposal 027](../../proposals/027-a-finding-says-whose-it-is-and-a-run-reports-it-once.md)).
A closed record `work/plans/completed/0001-p.md` holds, under `## Acceptance`, `- [?] deferred→BUG-1`
(line 7, `[?]` declared by no rule) and `- [ ] still open` (line 8). Two `taskItems(c, { marks: { '~': 'open' } })`
rules (`areOpen()`, `inDocuments(resideInFolder('work/plans/completed/**'))`,
`inSections(sectionsNamed(/^Acceptance$/))`, `notExist()`) and `honestyAtClose`:

- each rule reports its own finding for the open box at line 8 (`… should not exist (under
"Acceptance", line 5)`), and `honestyAtClose` reports `ledger/silent-open-box` at line 8: all three
  enforce;
- each of the three also reports `md/undeclared-box-mark` at line 7, the identity
  [plan 0454](../../plans/completed/0454-box-marks-are-the-callers.md) intends to collapse across rules;
- `dedupeConfigFindings` collapses those three to one, whose message ends: "This one option generated
  3 rules that cannot enforce anything; they are not listed separately because they are one edit."

So the box-mark case is no longer "would be": it is measured. The note reaches a test-runner caller
too, not only `eess-ts check`: `checkAll` (exported from the eess-ts root,
`packages/ts/src/core/check-all.ts:95`) runs the same collapse, and `checkAll` over two such builders
threw `ArchRuleError`, whose `violations` hold, and whose stderr report prints, the finding ending
"This one option generated 2 rules that cannot enforce anything".

Measured: the box-mark class, and with the fix the code-block instrument (its row in
`packages/md/tests/code-block-parse.test.ts` now reads the note). Earlier encounters with this note, each kept out of the collapse instead of fixing it:

- an expired declaration (`packages/ts/src/core/vacuity-diagnosis.ts:534`): ts-archunit's plan 0089's review
  measured 4 findings becoming 3, the survivor claiming two rules could not enforce;
- a false declaration (`packages/ts/tests/core/false-declaration-reports-both.test.ts:91`), which
  asserts the note never appears;
- an over-filtered detector (`packages/ts/tests/core/the-floor.test.ts:381`), ts-archunit's plan 0099.

For `zeroSubjectsViolation` the note is true and deliberate (`packages/ts/src/core/rule-builder.ts:433`):
N rules that cannot enforce are one edit. A fix keeps that case's meaning.

## Fix

`affectedNote` (`packages/core/src/dedupe-config-findings.ts:69`) now says only what the collapse
knows: " Reported N times in this run under this rule id and subject; listed once." Not how many
rules (one rule can report a key twice), not that the reports were one finding, and not that one edit
clears them: where a producer's element names a place rather than a cause, two causes on one line
share a key and the collapse keeps one of them. That is [bug 0621](../0621-the-collapse-merges-two-causes-reported-on-one-line.md),
which this fix does not change, and [bug 0420](../0420-a-failed-code-block-parse-is-misdescribed-by-the-kernel.md)'s
second symptom for code blocks. The note no longer claims they are one edit, so it is true there too.

Whether the rules can enforce anything is the finding's own message to say. For the two cases the
old note was true of, it does: a preset's dead selector ("can never match anything … so it has no
subjects and cannot fail") and an empty selector under `.expectNonEmpty()` ("so it enforces nothing
as written today"), each pinned by a row after the collapse. Kept out of
[plan 0454](../../plans/completed/0454-box-marks-are-the-callers.md), which stays eess-md only.

Sabotage: with the old note restored, nine rows red across the three packages (two in the kernel,
the box-mark and code-block rows, and five preset fan-out and dead-builder rows); with the fix, all
green. Two rows that asserted the absence of the old note's words (in
`false-declaration-reports-both.test.ts` and the preset row for a single finding) now compare whole
values, so the next rewording cannot leave them unable to fail.

## Verification

- [x] Red first: two `codeBlocks()` rules over one failed parse, deduplicated, carry "This one option
      generated 2 rules"
- [x] Green: the deduplicated finding's note names what was collapsed (two rules reporting one finding)
      and no option
- [x] Red first, the box-mark class: two `taskItems()` rules and `honestyAtClose` over one undeclared
      mark, with a readable open box each rule reports, in
      `packages/md/tests/builders/task-items-marks.test.ts` beside
      `it('two rules over one corpus give one finding per cause after dedupe')`, which runs this
      collapse and asserts nothing about its message:
      `it('a collapsed box-mark finding says how many rules reported it, and nothing false about them')`
- [x] The code-block row (`packages/md/tests/code-block-parse.test.ts:184`) states the new note
- [x] The count survives the rewording: [ADR-016](../../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s C3 row
      (`packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts:181` matches `/\b3\b/`)
- [x] `zeroSubjectsViolation`'s collapse still says its rules cannot enforce anything, through its own
      message: `it('an empty selector collapsed across rules still says it enforces nothing (bug 0461)')`;
      a dead selector's likewise, in `it('one wrong shared glob is one finding that names the option')`
- [x] A changeset naming `@nielspeter/eess`: `.changeset/the-collapse-note-says-only-what-it-knows.md`
- [x] The kernel's own row: `it('the note says how many times the key was reported, never that they were generated, dead or one edit')`

Deferred: none
