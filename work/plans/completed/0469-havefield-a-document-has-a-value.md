# Plan 0469: `haveField`: a document has a value, and any rule can depend on it

## Status

- **State:** Done — built 2026-10-18 in PR #242 from the reviewed Draft, without a separate
  `/plan-ready` step: the build PR's review stands in for it, as for plans 0458 and 0456 (and 0454, PR #240, and 0468, PR #241). "Build notes" says where the build departed from the text. Written 2026-10-18 from proposal 017's block 2; revised the same day after one
  review round (architect · product · enforcement · method).
- **Implements:** proposal 017
- **Priority:** High. All three adopters asked for blocks 1 and 2 (proposal 017, "Consumer
  feedback"). This is the block that lets a caller write "documents whose `Status` is `fixed` have a
  `Verification` section" in their own words.
- **Effort:** Medium. One dual-use method on `docs()`, a resolver for each document, and its
  findings.
- **Created:** 2026-10-18
- **Builds after:** [plan 0468](./0468-fields-read-a-labelled-value-in-the-callers-forms.md), whose
  reader it resolves, and therefore after 0468's own preconditions.

## Problem

Block 1 yields every occurrence of a value. It cannot report a document that carries none, because
such a document yields no element. Two questions are left open:

- whether a document has the value at all;
- which value counts when a document carries several.

Adopter 3 hit the second: a `State:` in prose at line 220 beat the header at line 3. Every adopter
answers both questions with its own code.

## Design

_(Note 2026-10-18, from plan 0468's review: `readFields(doc, options, setAside)` takes the fence
mode. A presence check should pass `'code-blocks'`: the default, `'closed-fences'`, reads past an
unclosed fence, which errs toward "present" for this plan's question.)_

```ts
export interface HaveFieldOptions extends FieldOptions {
  /** The allowed values, after the caller's `value`: the same type `resolveAgainst` takes. */
  readonly oneOf?: Vocabulary | RegExp
}

docs(c).that().haveField(spec) // a predicate: documents whose resolved value exists (and is allowed)
docs(c).should().haveField(spec) // a condition: every selected document has it
```

`value` keeps its meaning from plan 0468 (the caller's normaliser), so adopters 1 and 2 keep their
own value end. The method is dual-use by phase, as `haveSection` is
(`packages/md/src/builders/docs.ts:45`).

**The resolver.** It lives in `packages/md/src/model/field-resolve.ts` and is internal. It resolves
one document from 0468's `readFields` **occurrences**, not from the split elements, so a
multi-valued field is one occurrence and never a conflict with itself. Block 5 will reuse it, so
precedence is decided in one place (decision 2).

1. **Structured beats plain.** `bold`, `heading` and `bold-line` win over `plain`.
2. **One structured occurrence** resolves the value. A `plain` occurrence that disagrees with it is a
   finding at its own line, and the resolved value stands.
3. **Two or more structured occurrences**, agreeing or not, are a conflict: one finding naming both
   lines.
4. **Only `plain` occurrences:** if they all agree, they resolve the value. If they disagree, it is a
   conflict.
5. **No occurrence:** the document has no value.

With `oneOf`, a field with several values is allowed only when every value is.

**The header region.** `region: 'header'` is a `FieldOptions` option (plan 0468), so the reader, the
resolver and the unnamed-form scan all read the same lines. Two adopters' records need it, and so do
two of this repository's:

- **A register inside a record.** An adopter's plan carries its real `**Status:**` on line 3, then ten
  feedback items each written `- **Status:** open.`.
- **A kept earlier submission.** Proposals 010 and 016 keep their original submission, with its own
  `**State:**`, below the current header.

Read over the whole document, each of these is a conflict. Within the header, each resolves to its
real value. A "first occurrence wins" option was considered and rejected, because it would hide a
second value anywhere, even inside the header. The region hides only what lies outside the part the
caller names, and only when the caller opts in. That narrows decision 2 ("a losing occurrence that
disagrees is its own finding"): a disagreeing occurrence outside the region is neither read nor
reported. The narrowing is recorded in proposal 017.

**Every cause is reported, in either position.** `haveField` used as a selector must not drop a
document without saying so (ADR-009). Four causes make a document's value unreadable, and the builder's
`collectViolations` reports them in both phases, as `links()` reports its declaration findings
(`packages/md/src/builders/links.ts:140-150`):

- the conflict;
- the unnamed form;
- the disagreeing prose;
- **outside the region**: with `region` set, no value in the header, but the label occurs elsewhere
  in the document, in any structured form (`bold`, `heading`, `bold-line`) whether the rule names it
  or not. So a `## Status: fixed` after a `## Notes` heading, under `forms: ['bold']`, is reported,
  never skipped.

A readable value outside `oneOf` is different. Used as a condition, `haveField` reports it. Used as a
selector, it is the filter doing its job: the document is not selected, and nothing is reported. A
misspelt value is caught by a paired `fields(...).resolveAgainst(...)` rule instead (see the example
below).

They cover the documents the rule's **other** predicates keep, so a bugs-only rule never reports a
README. "Other predicates" means the rule's own `.that()` predicates. `haveField` is a builder method,
not an exported predicate, so it cannot sit inside an `or()` or `not()`. The specs it records are
replaced on `fork()`, never pushed onto shared state (`packages/md/src/builders/links.ts:87-99`). A
document gets one finding per cause even when the same spec is used in both phases.

`.select()` is a door these findings do not pass through: a selection built with `haveField` leaves
out an unreadable document without reporting it, as `links()` documents for its own declarations
(`packages/md/src/builders/links.ts:63-65`). The method's JSDoc and the README say so.

Each document gets one cause (ADR-009 rule 2). An unnamed-form finding replaces "no field" for that
document. These are the messages:

```
work/bugs/0001.md: no Status field (read as bold, heading); its labels: Severity, State
work/bugs/0001.md: Status at line 14 is outside the header (region: 'header'); move it into the header, or drop the region
work/bugs/0001.md: found `## Status: open` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line
work/bugs/0001.md:3: 'Shipped' (Status, line 3) is not in the allowed set (open, fixed)
work/bugs/0001.md:3,9: Status is given twice (line 3 'open', line 9 'fixed'); keep one
work/bugs/0001.md:220: prose says Status 'open', but the field at line 3 says 'fixed'
```

- **Labels.** "Its labels" lists the wrapped labels the document carries (`wrappedLabelOf`), so a
  record that writes `State` where the rule reads `Status` points at the real label. An alias the
  caller did not name cannot be known, so that is how the second Review's alias condition is met;
  the narrowing is recorded in proposal 017.
- **Values.** The allowed-value message is the one `resolveAgainst` prints (plan 0468): one concept,
  one message.
- **Withheld documents.** Decision 2 says a withheld document is "counted as withheld". Here each
  withheld document gets one finding, and the findings are the count. No separate summary number is
  added. This is recorded in proposal 017.

A predicate that selects no document gives the kernel's zero-examined finding (ADR-010).

**The example the block exists for:**

```ts
docs(c)
  .that()
  .resideInFolder('bugs/*')
  .and()
  .haveField({
    label: 'Status',
    forms: ['bold', 'heading'],
    value: untilDelimiter(['—']),
    oneOf: /fixed/i,
  })
  .should()
  .haveSection('Verification')
  .check()
```

A bug written `**Status: fixed**` (the `bold-line` form, not named) is not selected, and it is
reported. A bug whose Status is `Fxed` is not selected either. The README pairs this rule with
`fields(...).resolveAgainst(allStates)`, which reports the misspelling: a filter alone cannot tell a
misspelt value from a different one.

**Dogfooding.** `check:corpus` gains a rule: every live plan and bug (`work/plans/*.md`,
`work/bugs/*.md`, the board files excluded by name) has one `State` field in the `bold` form.
Measured 2026-10-18 with eess-md's own `proseText`, every live plan and bug has exactly one, so the
rule needs no exclusion. A `check:nonvacuity` row removes the State line from one live bug.

Proposals are left out. Two of them (010 and 016) keep their original submission, with its own
`**State:**` line, below the current one, as the lane's rule asks. `region: 'header'` now separates
those, so whether to add the lane, measured, is the build's choice. This is the first check here that
reds when a record has no state at all: `honestyAtClose` counts such a record but never refuses it
(bug 0444).

## Phases

1. **Resolver.** `field-resolve.ts` over `readFields`, with its five outcomes.
2. **`haveField`.** The predicate and condition forms, `collectViolations` in both phases, and the
   messages above.
3. **Dogfood, docs, release.** The `check:corpus` rule and its `check:nonvacuity` row, an example under
   `examples/md/`, the eess-md README with the paired rule, the header region and its known limit (plan 0468), a glob that keeps a rule off frozen records, `docs/markdown.md`, a changeset.

## Files changed

- `packages/md/src/model/field-resolve.ts` (new)
- `packages/md/src/predicates/document.ts`
- `packages/md/src/conditions/structure.ts`
- `packages/md/src/builders/docs.ts`
- `packages/md/src/index.ts`
- `examples/public-surface.test.ts` (`HaveFieldOptions`)
- `examples/md/have-field/` (new: clean and violating fixtures)
- `packages/md/tests/builders/have-field.test.ts` (new)
- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`
- `docs/markdown.md`
- `.changeset/md-have-field.md`

## Test inventory

- **The resolver:**
  - one row per outcome;
  - a structured occurrence beating an earlier `plain` one (adopter 3's line-220 case);
  - several agreeing `plain` occurrences;
  - `region: 'header'`: a register of bulleted `**Status:**` items under a later `##` resolves to the
    header's value; without the option it is a conflict;
  - a split field resolving as one occurrence.
- **The condition:** each message above, word for word, and one cause per document.
- **The predicate:**
  - it selects the documents that have the field, and with `oneOf` only the allowed ones;
  - a conflicted document, an unnamed-form document and a field outside the header (with
    `region: 'header'`) are each not selected **and** reported;
  - `forms: ['bold']`, `region: 'header'`, and the only Status is `## Status: fixed` after a `## Notes`
    heading: reported as outside the region;
  - an `open` bug under `oneOf: /fixed/i` is not selected and not reported;
  - a document outside the other predicates is not reported.
- **The example:** red on a fixed bug with no `Verification` section; green once the section is added.
- **A selection of nothing:** the zero-examined finding.
- **Sabotage rows**, each turning its named test red:
  1. the resolver prefers the first occurrence;
  2. `collectViolations` skips the predicate phase;
  3. the condition passes a document with no field;
  4. the resolver counts split elements;
  5. the "outside the region" cause is dropped, and a `## Status` section record used in a selector
     goes unreported.

## Release

`@nielspeter/eess-md` minor, additive. It ships after plan 0468's flagged release.

## Out of scope

- **A value agreeing with its folder:** block 5, after its ADR. It reuses this resolver.
- **An exported `Predicate<MdDocument>` for `inDocuments`.** Lifting `haveField` onto other elements
  through block 12 would drop these findings, because `inDocuments` has no door for them. That door is
  [plan 0470](../0470-a-lifted-predicate-carries-its-findings.md).
- **`honestyAtClose` rebuilt on `haveField`:** the second Review's decision 1, and bug 0444.
- **Any region other than the header** (a named section, for example): block 11.
- **Requiring `Severity`:** 22 live bugs carry none (measured 2026-10-18). Giving each one a level is a
  judgement per bug, not part of this build.

## Build notes — 2026-10-18

Where the build departed from the text above, each overrulable:

- **The allowed-value message is `resolveAgainst`'s** (`'Shipped' (Status, line 3) does not match
/open|fixed/`), not the Design's `is not in the allowed set (open, fixed)`: the Design also says
  "one concept, one message", and the two cannot both hold. `judge` is shared from
  `packages/md/src/builders/vocabulary.ts`.
- **An empty value is a fifth unreadable cause:** `Status at line 3 has no value this rule can read`.
  Plan 0468's review made `readFields` yield an empty value rather than drop it, so the resolver
  sees it; a document whose only value is empty is not selected and is reported.
- **The resolver reads with `'code-blocks'`,** as plan 0468's review asked: reading past an unclosed
  fence would err toward "present".
- **A selected document can still carry findings:** prose that disagrees, a label elsewhere in a
  form the rule does not read, and (as a condition) a value outside `oneOf`. "One cause per
  document" holds for the documents that are not selected.
- **"No field" names the labels the document carries,** or says it carries none.
- **The dogfood rule is `corpus/state-present` over live plans and bugs** (the lanes from
  `scripts/lib/ledger-lanes.mjs`), green on its first run. "Live" first meant "not in
  `check:corpus`'s `FROZEN` list", which does not freeze `rejected/`, so it counted two terminal
  bugs (222 records); review moved both State rules onto the lane's own `doneFolders` (219 records
  at the review round's head; the gate prints the count on every run). Two non-vacuity rows: a
  live bug with no State, and one with two. Proposals are left out, as the Design allows.
- **The findings module is `packages/md/src/builders/have-field.ts`,** not
  `predicates/document.ts` and `conditions/structure.ts`: one verdict per document feeds the
  predicate, the condition and the selector's findings. The unnamed-form scan was split into a
  per-document helper (`unreadFields`) so `haveField` reuses it.
- **Review round, 2026-10-18 (architect · enforcement · testing · method):**
  - **One fence mode.** The resolver read with `'code-blocks'` and the unread-label scan with
    `'closed-fences'`, so a value after a code fence that never closes was seen by neither and, as a
    selector, the document was dropped silently. The whole verdict now reads with `'code-blocks'`,
    and a value only a reading past the fence finds is its own reported cause.
  - **The model owns the verdict.** The resolver gained the `'empty'` outcome; the verdict,
    `labelsOf` and the unread-label scan moved to `packages/md/src/model/field-verdict.ts` and
    `field-unread.ts`, so block 5 reuses them without importing a builder. `STRUCTURED_FORMS` is one
    constant. The builder module keeps `HaveFieldOptions`, the predicate and the condition; `judge`
    stays in `builders/vocabulary.ts` and is passed in.
  - **The docs say what is reported.** "Never left out silently" claimed too much: as a selector, a
    document with no field, or a misspelt label, is left out like any document the filter does not
    keep. The README and `docs/markdown.md` pair the selector with a `.should().haveField()` rule
    for that; the no-field finding names a plain line the rule does not read. The predicate's
    description names its `oneOf`.
  - **Tests that can fail:** the dedupe through a selected document, fork safety with both rules
    built before either runs, disagreeing prose and an unread label as a selector, `oneOf` with
    `split`, the unclosed fence, and the plain-line hint; sabotage rows 7–11.
  - **Recorded, not fixed:** the dogfood rule exercises only the condition position (a
    selector-position dogfood → [plan 0470](../0470-a-lifted-predicate-carries-its-findings.md),
    where the lifted form is built); the rule's records are chosen with a path prefix rather than a
    glob, so a changed lane root reds as zero examined without naming the glob
    ([bug 0484](../../bugs/0484-state-present-picks-records-by-a-path-prefix.md)); a `## State:`
    heading is reported by both `corpus/state-present` and `corpus/state-in-a-form-not-read`,
    counted twice in the summary ([bug 0483](../../bugs/0483-a-state-heading-is-counted-twice.md));
    `.select()` carries none of these findings (plan 0470's question); the outside-the-header cause
    reads structured forms only, so a plain or loosely formatted label below the header is "no
    field" (plan 0468's region limit); each `haveField` use computes a document's verdict more than
    once (→ plan 0470, whose lift multiplies it per box).
- **Review verification, 2026-10-18:** each reviewer re-checked their findings against the fix pass.
  Fixed from it: the fence fallback also scans for labels in forms the rule does not read, so such a
  label after a code fence that never closes is reported, not dropped; the message names the code
  that hides the line, a fence that never closes or an indented block (`codeShapeAt` in
  `model/prose.ts`); a lost unread-label record throws instead of vanishing. Sabotage rows 12–13.
  Recorded, not fixed ([bug 0482](../../bugs/0482-the-havefield-tests-cannot-see-an-extra-finding.md)):
  the tests' `said()` helper drops line-0 findings, so an extra configuration finding beside an
  expected list is not seen; no test pins aliases (with `region` or in a conflict message, which
  names `spec.label`), an empty value under `oneOf`, a `split` that yields only empty values, a CRLF
  record, or `.excluding()` against a selector finding; "it carries no wrapped label" is untested;
  the `ArchConfigError` for a lost unread-label record is unreachable through `matchingElements` and
  untested; the matrix's exact edits live in the session's `scratchpad/sab0456/matrix0469.py`, not
  in the repository, so the table's "sabotage" column is the record of what each row broke.
- **Files beyond the plan's list:** `packages/md/src/model/field-verdict.ts`, `field-unread.ts` and
  `builders/have-field.ts` (new); `FieldOccurrence` exported from `model/fields.ts`;
  `examples/README.md`. The README's region limit and the frozen-records glob were already
  documented (plan 0468's README section and `packages/md/README.md`'s `corpus()` text); this
  plan's README paragraph points at them rather than repeating them.
- **The example is `examples/md/a-fixed-bug-shows-its-verification.test.ts`,** with two judgements (a
  fixed bug missing the section, a Status in a form the rule does not read).
- **Sabotage row 6 is beyond the plan's five:** the dogfood rule checking nothing. Row 3's first
  mutation broke the file's syntax (the test was "absent", not red); a cleaner one was used.

## Progress ledger

- [x] Phase 1: resolver
- [x] Phase 2: `haveField` and its findings in both phases
- [x] Phase 3: dogfood rule, non-vacuity row, example, README, docs, changeset (the load-bearing
      check proves 7 of 7 judgements across 4 examples, 10 s)
- [x] Sabotage rows 1–4 red on their named tests; suites green; durations reported (rows 1–13 in
      the table below, run at 12c3323 after the review and its verification: each named check
      green on the untouched tree and red with its row applied, files restored by `git checkout`,
      tree clean, about 45 s; a row's time covers all its checks, so row 6's two lines share one
      figure)
- [x] `npm run validate` green; duration reported (at a924a041, with this box ticked provisionally
      because `check:ledger` runs inside it: exit 0 in 14 min 37 s. The verification's last pass
      after it (the fence fallback, a throw, two tests) was re-checked by the md suite, sabotage rows
      1–13, `check:arch`, `lint` and `format:check`; this branch is rebased onto plan 0468's before
      its PR, and CI is the gate for the combined tree. Rebased onto plan 0468's branch after PR #240
      merged, the combined tree was validated again at 9ec9c2a: exit 0 in 14 min 32 s, 222 fixtures,
      md 481 tests)
- [x] Close: this plan → `completed/`; boards

Deferred: plan 0470 (selector-position dogfood, one verdict per use), bug 0482, bug 0483, bug 0484

The SHAs above are this branch's commits before its rebase and squash merge (PR #242), so they do
not resolve on `main`. What they evidence holds for the merged tree: the tree validated at 9ec9c2a
differs from the PR's merged tree only in this record (`git diff --stat`, measured 2026-10-18).

**Sabotage matrix, measured 2026-10-18 at 12c3323 (after the review and its verification):**

| row | sabotage                                           | checked by                                                                | named test                                                                                                | baseline | sabotaged | time  |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- | --------- | ----- |
| 1   | the resolver prefers the first occurrence          | `packages/md/tests/builders/have-field.test.ts`                           | two structured occurrences conflict, agreeing or not                                                      | green    | red       | 1.7s  |
| 2   | collectViolations skips the predicate phase        | `packages/md/tests/builders/have-field.test.ts`                           | a value only below the header is reported as outside the region, in either position                       | green    | red       | 3.2s  |
| 2   | collectViolations skips the predicate phase        | `packages/md/tests/builders/have-field.test.ts`                           | selects only the allowed documents; reports the unreadable ones; is silent on an open bug and on a README | green    | red       | 3.2s  |
| 3   | the condition passes a document with no field      | `packages/md/tests/builders/have-field.test.ts`                           | no occurrence: no field, naming the labels the document does carry                                        | green    | red       | 1.6s  |
| 4   | the resolver counts split elements                 | `packages/md/tests/builders/have-field.test.ts`                           | a split field is one occurrence, never a conflict with itself                                             | green    | red       | 1.6s  |
| 5   | the outside-the-region cause dropped               | `packages/md/tests/builders/have-field.test.ts`                           | a value only below the header is reported as outside the region, in either position                       | green    | red       | 1.6s  |
| 6   | check:corpus's State-present rule checks nothing   | `QA_ONLY=corpus/state-present node scripts/check-nonvacuity.mjs`          | corpus/state-present                                                                                      | green    | red       | 24.5s |
| 6   | check:corpus's State-present rule checks nothing   | `QA_ONLY=corpus/state-present-conflict node scripts/check-nonvacuity.mjs` | corpus/state-present-conflict                                                                             | green    | red       | 24.5s |
| 7   | a value after an unclosed fence taken as absent    | `packages/md/tests/builders/have-field.test.ts`                           | a value after a code fence that never closes is reported, in either position, not taken as absent         | green    | red       | 1.6s  |
| 8   | the dedupe between positions dropped               | `packages/md/tests/builders/have-field.test.ts`                           | the same spec in both positions gives one finding for a selected document with disagreeing prose          | green    | red       | 1.5s  |
| 9   | specs pushed onto the shared array                 | `packages/md/tests/builders/have-field.test.ts`                           | two rules forked from one base do not share their haveField specs                                         | green    | red       | 1.5s  |
| 10  | an unread label beside a resolved value dropped    | `packages/md/tests/builders/have-field.test.ts`                           | a selector reports disagreeing prose and an unread label beside a resolved value                          | green    | red       | 1.6s  |
| 11  | oneOf allows a field when any value is allowed     | `packages/md/tests/builders/have-field.test.ts`                           | with split and oneOf, a field is allowed only when every value is                                         | green    | red       | 1.6s  |
| 12  | the fence fallback reads only the rule's own forms | `packages/md/tests/builders/have-field.test.ts`                           | a label in an unread form after an unclosed fence is reported, not dropped                                | green    | red       | 1.5s  |
| 13  | every hidden field blamed on a fence               | `packages/md/tests/builders/have-field.test.ts`                           | a value in an indented code block names the indented block, not a fence                                   | green    | red       | 1.6s  |
