# Plan 0469: `haveField`: a document has a value, and any rule can depend on it

## Status

- **State:** Draft — written 2026-10-18 from proposal 017's block 2; revised the same day after one
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
  [plan 0470](./0470-a-lifted-predicate-carries-its-findings.md).
- **`honestyAtClose` rebuilt on `haveField`:** the second Review's decision 1, and bug 0444.
- **Any region other than the header** (a named section, for example): block 11.
- **Requiring `Severity`:** 22 live bugs carry none (measured 2026-10-18). Giving each one a level is a
  judgement per bug, not part of this build.

## Progress ledger

- [ ] Phase 1: resolver
- [ ] Phase 2: `haveField` and its findings in both phases
- [ ] Phase 3: dogfood rule, non-vacuity row, example, README, docs, changeset
- [ ] Sabotage rows 1–4 red on their named tests; suites green; durations reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
