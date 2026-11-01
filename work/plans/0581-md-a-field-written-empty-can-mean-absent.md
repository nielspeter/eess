# Plan 0581: a field written empty can mean absent

## Status

- **State:** Draft — awaiting the review's changes (see the proposal's Review, 2026-11-01); not ready to build
- **Implements:** [proposal 025](../proposals/025-md-a-field-written-empty-can-mean-absent.md)
- **Priority:** Medium. No false green today: an empty value is always reported. A corpus whose
  empty field means "not yet" cannot state an optional field's rule for the blank case.
- **Effort:** Small. About an hour's build in eess-md, plus docs; an additive minor.
- **Created:** 2026-11-01
- **Decided (2026-11-01, the maintainer, on the review):**
  - The member is `FieldOptions.empty?: 'unreadable' | 'absent'`, default `'unreadable'`
    (`packages/md/src/model/fields.ts:85`).
  - `'absent'` is keyed on a label **written** blank: the occurrence's `raw` is blank and its field
    ends at once (the next non-blank line is another label, a heading, a thematic break or the end
    of the region), decided before the caller's `value` runs. An occurrence that is empty only
    after cutting (an emoji-only value, a value the caller's `value` cuts to nothing, a bold label
    leading a list) stays `'unreadable'` under either setting.
  - A heading-form label with its value on the next line stays `'unreadable'` under `'absent'`
    (the review's option (a)).
  - No `'value'` reading: the `value` callback already expresses it (the review's open question 1).
    A union member added later is an additive minor, so this closes nothing off.

## Problem

`readFields` (`packages/md/src/model/fields.ts:277`) yields an occurrence whose cut value is empty
with the value `''`, and every reader reports it as unreadable. That is right by default, and it
leaves a corpus whose convention is "blank means not yet" no way to write the optional rule for the
blank case; the workaround an adopter reaches for turns its required-field rule green (the
proposal's Measured row 4). The review found the proposal's mechanism keyed on the wrong set: "an
occurrence whose values are all empty" is `isEmpty` after the cut
(`packages/md/src/model/field-resolve.ts:37`), which holds for four shapes that are not written
empty, and under `'absent'` each would be silently dropped (its Critical 1).

## Phase 0: the proposal's changes, before this plan can be promoted

The review's recommended next step lists these. Each is closed when the proposal says it.

- [ ] Record the correction: the mechanism as worded keyed on cut values and would silently drop
      four shapes that are not written empty.
- [ ] Ask A defined as written-blank-and-the-field-ends, with the heading-form decision above.
- [ ] A third break class: under `empty: 'absent'`, each cut-to-nothing shape still gives today's
      unreadable finding and stays undecided in selector position.
- [ ] The no-value invariant (Important 1): a document whose read occurrences are all written empty
      gets the verdict it would get without those lines; only the final "no field" cause is replaced
      by one naming the empty line.
- [ ] The reworded message: a noun phrase opening with "no", naming the option and giving the fix,
      with the `agreeWithFolder` F4 text verbatim (`packages/md/src/conditions/agree-with-folder.ts:377`)
      and the F5-to-F4 routing change stated (Important 2).
- [ ] Break class 1 restated against the condition form, `docs().should().haveField(spec)`
      (Important 3).
- [ ] The `fields()` `examined` decision: when every occurrence is written empty, keep the drop and
      disclose the count read as absent, or say otherwise (Important 4).
- [ ] The precedence cases named, with today's "given twice" red turned green named as a deliberate
      trade (Important 5).
- [ ] "Rows" defined as a named-test sabotage matrix over `packages/md/tests`, as
      [plan 0468](./completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md) did, with no
      `check:nonvacuity` row, since no gate here declares the option (Important 6).
- [ ] One `checkFieldOptions`, covering region and `empty`, called from all three build sites
      (Important 7).
- [ ] The docs passage on optional and required fields (Important 8).
- [ ] The `agreeWithFolder` region crash (it never calls `checkRegion`,
      `packages/md/src/model/fields.ts:63`) is recorded as its own bug,
      [bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md). Before this plan is Ready, it
      says whether it closes that bug too: the one validator is their shared root cause.

## Phases

1. **The reading, classified once.** `readFields` marks an occurrence written empty, with an
   internal, unexported marker; `resolveField` (`packages/md/src/model/field-resolve.ts:48`),
   `fieldVerdict` (`packages/md/src/model/field-verdict.ts:68`) and `fieldTerms`
   (`packages/md/src/builders/vocabulary.ts:260`) apply it, branching on `=== 'absent'`. The
   existing `'absent'` cause kind (`packages/md/src/model/field-verdict.ts:29`) carries the verdict;
   `predicateHaveField` already reads only `'unreadable'` as undecided
   (`packages/md/src/builders/have-field.ts:84`). `checkFieldOptions` refuses an unknown `empty`
   when the rule is built. The plan's Decisions say, in writing, how the option sits with
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md): the declaration
   makes one shape judgeable and everything else stays undecided; and that it qualifies, not
   overturns, [plan 0469](./completed/0469-havefield-a-document-has-a-value.md)'s fifth unreadable
   cause. No ADR is needed (the review's placement call).
2. **Docs.** The optional and required field rules, and `empty: 'absent'` for a blank that means
   "not yet", in `docs/markdown.md` and `packages/md/README.md`.

## Files changed

- Phase 1: `packages/md/src/model/fields.ts`, `packages/md/src/model/field-resolve.ts`,
  `packages/md/src/model/field-verdict.ts`, `packages/md/src/builders/vocabulary.ts`, the three
  build sites that call the validator, `packages/md/tests/`, `.changeset/`
  (`@nielspeter/eess-md` minor only).
- Phase 2: `docs/markdown.md`, `packages/md/README.md`.

## Test inventory

- Without the option, every existing reader's findings unchanged, byte for byte: the six existing
  `has no value this rule can read` assertions.
- Under `'absent'`: a required-field rule reds a written-blank field with the new message; an
  optional rule passes it and still reds a value outside `oneOf`.
- Under `'absent'`: the emoji-only value, a value cut to nothing, a heading-form label and a bold
  label leading a list each still unreadable.
- The precedence cases Phase 0 names.
- An unknown `empty` value refused at build time, from each build site.
- The sabotage matrix over named tests: `'absent'` read as `'unreadable'`; `'absent'` widened to
  the cut-to-nothing shapes; one reader ignoring the option; the build-time refusal removed.

## Out of scope

- Changing the default.
- Values that look empty but are not (`—`, `n/a`, `TBD`): values, judged by `oneOf`.
- `honestyAtClose`: its State reader takes no `FieldOptions`, so it does not honour the declaration.
