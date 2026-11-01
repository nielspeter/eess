# Proposal 025 — md: a field written empty can mean absent

**State:** Draft — filed 2026-11-01 from an adopter's question, at the maintainer's request;
reviewed 2026-11-01, Ship with changes (see Review). Still Draft: its plan is
[plan 0581](../plans/0581-md-a-field-written-empty-can-mean-absent.md).
**Priority:** Medium — no false green: an empty value is always reported today. But a corpus whose
convention is that an empty field means "not yet" cannot state an optional field's rule at all,
and the workaround an adopter reaches for inverts its required-field rule into a false green.
**Origin:** inbound · consuming project, 2026-11-01, moving its own schema checks onto
`docs().notExist()` rules over eess-md 0.13.0.
**Affects:** `@nielspeter/eess-md`.

## Problem

Some corpora write a labelled field with no value on purpose. A meeting-record template writes
`**Confirmed:**` empty until the record is confirmed; a bug template writes `**Origin:**` empty
until someone fills it in. In such a corpus an empty field means the same as no field, and the
corpus's other readers treat it so.

eess-md reads an empty value as unreadable. [Plan 0468](../plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md)'s
review made `readFields` yield an empty value instead of dropping it, so that nothing is skipped
silently, and [plan 0469](../plans/completed/0469-havefield-a-document-has-a-value.md) made it "a
fifth unreadable cause": the resolver returns `'empty'`
(`packages/md/src/model/field-resolve.ts:44`), and the verdict reports
`<label> at line N has no value this rule can read` (`packages/md/src/model/field-verdict.ts:120`)
before `oneOf` is consulted. As a predicate it is undecided
([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)), so the finding
carries `bypassFilters`, and `not()` keeps it undecided. Neither record weighed a corpus that uses
the empty form deliberately.

## Measured

On `main` at 7ba8bbe3 (eess-md 0.13.0), Node 24.22.0, five documents with a `**Confirmed:**` field
in the `bold` form: written empty, a date, `soon`, `—`, and no field. The optional rule is
`docs().that().haveField(spec).and().satisfy(not(predicateHaveField({ ...spec, oneOf: /^(?:\d{4}-\d{2}-\d{2})?$/ }))).should().notExist()`;
the required rule is `docs().that().satisfy(not(predicateHaveField(spec))).should().notExist()`.

| rule                                            | written empty                                                                                                                                                                                                     | no field | `soon`, `—` | a date |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- | ------ |
| optional, `oneOf` accepting a date or `''`      | red, `has no value this rule can read`, unsuppressable                                                                                                                                                            | green    | red         | green  |
| required                                        | red, the same message                                                                                                                                                                                             | red      | green       | green  |
| optional, with `value` mapping `''` to `(none)` | red, unless `oneOf` also accepts `(none)`                                                                                                                                                                         | green    | red         | green  |
| required, with `value` mapping `''` to `(none)` | **green**: the placeholder is a value _Corrected 2026-11-01 (review): this row understates itself. The placeholder also turns the required rule green on an emoji-only value and on a bold label leading a list._ | red      | green       | green  |

The required rule already reds an empty field, under a message that says unreadable where the
corpus means missing. The optional rule cannot be written: an empty field reds it whatever `oneOf`
accepts. _Corrected 2026-11-01 (review): this is true only of the blank case.
`fields(c, spec).should().resolveAgainst(allowed)` already writes "if present, allowed" for every
other case, because a document with no field yields no element._
The workaround, a `value` function that turns `''` into a placeholder, makes the optional
rule expressible and turns the required rule green on an empty field, a false green under the
corpus's own convention. The other workaround, a presence reader of the corpus's own, is a second
reader beside eess-md's.

## Existing code survey

- **One verdict, one reader below it.** `resolveField` (`packages/md/src/model/field-resolve.ts:48`)
  decides the value for `fieldVerdict`, which `haveField`/`predicateHaveField`
  (`packages/md/src/builders/have-field.ts:23`) and `agreeWithFolder`
  (`packages/md/src/conditions/agree-with-folder.ts:352`, [plan 0495](../plans/completed/0495-a-value-agrees-with-its-folder.md)) read. `fields()` reads
  `readFields` directly and reports an empty value itself (`packages/md/src/builders/vocabulary.ts:217`).
  All of them take `FieldOptions` (`packages/md/src/model/fields.ts:84`), so an option there
  reaches each.
- **`FieldOptions` already carries the caller's conventions:** `forms` (required: "eess-md has no
  default form"), `aliases`, `value`, `split` and `region`. What an empty value means is the same
  kind of fact: the corpus's, not eess-md's.
- **No option reads an empty value as anything else.** `value` runs before the empty test, so it
  can only turn the empty value into a value, which is the inversion measured above.
- **[ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)**: eess-md's root fixes no
  document's shape the caller did not name. The default stays as it is; the ask is a way for the
  caller to name its convention.

## Asks

- **A — a declared meaning for an empty value.** One member on `FieldOptions`:

  ```ts
  /** What a label written with no value means. Default 'unreadable': reported, never guessed. */
  readonly empty?: 'unreadable' | 'absent'
  ```

  Under `'absent'`, an occurrence whose values are all empty is not a value: a document holding
  only such occurrences is decided to have no value (a known false, not undecided), so an optional
  field's rule does not select it and a required field's rule reds it, with a message that keeps
  the line: `Confirmed at line 3 is written empty, which this rule reads as absent`.
  _Corrected 2026-11-01 (review): "an occurrence whose values are all empty" is not the same set
  as the type comment's "a label written with no value". The first also takes in an emoji-only
  value, a value the caller's `value` cuts to nothing, and a bold label leading a list; `'absent'`
  keys on a label written blank (the Review's decision 1)._
  _Corrected 2026-11-01 (review): the message does not compose inside `agreeWithFolder`'s F4
  finding, which reads "… and has …", and "this rule reads" misattributes the reading, which is
  the `FieldOptions` declaration (the Review's addition 2)._

## Acceptance criteria

- **Break class:** under `empty: 'absent'`, a required-field rule over a document with
  `**Confirmed:**` empty is red, its message naming the label, the line and the declared reading.
  _Corrected 2026-11-01 (review): this holds for the condition form only. In the predicate form
  measured above, the document becomes decided false, and the finding is `notExist`'s at line 1,
  with no label, no declared reading, and no `bypassFilters` (the Review's addition 3)._
- **Break class (false red):** under `empty: 'absent'`, an optional-field rule with `oneOf` passes a
  document whose field is written empty, and still reds one holding a value outside `oneOf`.
- **Default unchanged:** without the option, both rules give today's findings, byte for byte.
- **Precedence:** with an empty structured occurrence and a filled one, the empty one is dropped
  before precedence, so the filled one resolves rather than a conflict; with `split`, only an
  occurrence whose every split value is empty counts as empty.
- **Every reader:** `fields()`, `haveField`, `predicateHaveField` and `agreeWithFolder` give the
  same answer for the same spec.
- **Configuration:** an `empty` value other than the two is refused when the rule is built, as
  `checkRegion` refuses a bad region. _Corrected 2026-11-01 (review): `agreeWithFolder` never calls
  `checkRegion`, so copying it would leave that reader unchecked; one validator for `FieldOptions`,
  called from every build site, is needed (the Review's addition 7)._
- **Non-vacuity:** a fixture row reds when `'absent'` is read as `'unreadable'`, and one when it is
  read as a value. _Corrected 2026-11-01 (review): `check:nonvacuity` cannot hold these rows,
  because no gate in this repository declares the option. They are sabotage rows over named tests
  in `packages/md/tests` (the Review's addition 6)._

## Dogfooding

This repository writes no field empty on purpose, so its gates would not use the option; the rows
are the proof.

## Open questions

1. **A third reading, `'value'`.** Pass `''` to `oneOf` as a value. A required-field rule would then
   pass an empty field unless its own `oneOf` refuses `''`; whether any corpus wants that, or it
   only invites the inversion measured above, is the review's call.
2. **Where it is declared.** On `FieldOptions`, so every reader agrees, or per rule on
   `HaveFieldOptions`, so two rules over one field can read the empty form differently.
   _Corrected 2026-11-01 (review): this is a false choice. `FieldOptions` is already passed per
   call, so two rules can declare different readings on it too (the Review's decision 3)._

## Out of scope

- Changing the default: a corpus that declares nothing keeps the fail-closed reading.
- Values that look empty but are not (`—`, `n/a`, `TBD`): those are values, judged by `oneOf`.

## Review — 2026-11-01

**Ruling: Ship with changes**

Reviewed by the architect, product and enforcement lenses on `main` at bd78b962, after an
existing-code survey. All three reached "Ship with changes" on their own. The placement, the default
and the shape are right. The mechanism as worded reads more documents as absent than the caller
declares, and that must change before it is built. The reviewers measured with eight throwaway
scripts against `packages/md/dist`, about 0.15 to 0.17 s each, plus one 16 ms grep. No tracked file
was edited. The changes below are carried by the owning plan,
[plan 0581](../plans/0581-md-a-field-written-empty-can-mean-absent.md), which is being written now.

### Existing code survey, corrected

- **Ask A is genuinely new, and it belongs in eess-md.** A grep across `packages/*/src` found no
  "empty means absent" reading in any dialect or in the kernel. The slot it needs already exists.
  `FieldCause.kind` already has `'absent'` (`packages/md/src/model/field-verdict.ts:29`), and
  `predicateHaveField` treats only an `'unreadable'` cause as undecided
  (`packages/md/src/builders/have-field.ts:83-87`). So the predicate and the condition need no
  change of their own. The change sits in the model: `readFields`, `resolveField`, `fieldVerdict`
  and `fieldTerms`.
- **It is partly a docs gap.** `fields(c, spec).should().resolveAgainst(allowed)` already says "if
  present, allowed" for every case but the blank one, because a document with no field yields no
  element. The docs never point to it. The Problem's "the optional rule cannot be written" is true
  only of the blank case.
- **Open question 1's `'value'` reading duplicates the `value` callback.** A `value` that maps `''`
  to a placeholder, plus a `oneOf` that accepts the placeholder, is that reading. Measured row 4
  shows its hazard.

### Placement

- **`@nielspeter/eess-md` only, as an additive minor.** Only eess-md reads labelled values. Nothing
  moves into `packages/core`. eess-crossvalidate does not move: its source uses no field reader.
  This is not the refused `.allowEmpty()` in another form (`packages/core/src/cardinality.ts:1-38`):
  that silenced the empty-selection gate on any rule, and this option touches no selection
  cardinality.
- **The reading is classified once.** `readFields` is the one labelled-value reader. It marks an
  occurrence written empty, with an internal, unexported marker, and `resolveField`, `fieldVerdict`
  and `fieldTerms` follow the marker. Three readers each re-deriving "written empty" from `raw`
  would be the drift the "every reader" criterion exists to stop.
- **No ADR is needed.** The plan's Decisions record that written empty is read on `raw`, before
  `value`. They cite
  [plan 0469](../plans/completed/0469-havefield-a-document-has-a-value.md)'s "fifth unreadable
  cause" as qualified under a declared reading, not overturned. They also reconcile the option with
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) in writing: the
  declaration makes one shape judgeable, and everything else stays undecided.
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s founding
  example is a document that gives the value "empty" (lines 13-16), so without that sentence the
  option reads as an opt-out from it.

### Decisions

Made by this review. Each can be overruled, and each names its basis.

1. **`'absent'` keys on a label written blank, not on a value that is empty after cutting.** An
   occurrence is written empty when its `raw` is blank and its field ends at once. `raw` is "the
   text after the label, continuation lines included, before cutting"
   (`packages/md/src/model/fields.ts:115`). The field ends at once when the next non-blank line is
   another label, a heading, a thematic break, or the end of the region. The test is decided
   before the caller's `value` runs (`packages/md/src/model/fields.ts:286`). Every other
   occurrence that is empty after cutting stays `'unreadable'` under either setting, so the
   reading fails closed when it cannot tell. These stay as today:
   - an emoji-only value such as `✅`, which `cleanValue` strips to nothing;
   - a value the caller's `value` function cuts to nothing, such as `untilDelimiter(['—'])` on
     `— reason` or on a bare `—`. The bare `—` would also contradict the submission's own Out of
     scope, which keeps `—` a value;
   - a bold label followed by a list. This repository has that shape in
     [proposal 016](./016-eess-py-a-python-dialect.md) at line 16, and 22 files here carry a bold
     lead-in above a block.

   **Basis.** The submission's wording keys on "an occurrence whose values are all empty", which is
   `isEmpty` after the cut (`packages/md/src/model/field-resolve.ts:37`). Under it, optional and
   selector rules would drop each shape above without a finding. That is the silent drop
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) forbids. It also
   undoes [plan 0468](../plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md)'s
   sabotage row 9, "an empty value skipped again", whose named test is the emoji case, for every
   rule that declares the option. And a required rule would say "written empty" about a line that
   holds a value, which sends the author to the wrong fix
   ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2). All three reviewers raised
   this and measured it. [Plan 0581](../plans/0581-md-a-field-written-empty-can-mean-absent.md)
   adds a third break class: under `empty: 'absent'`, each shape
   above still gives today's unreadable finding, and stays undecided in selector position.

2. **A heading-form label whose value is on the next line stays unreadable, as today.** A heading
   takes no continuation lines (`packages/md/src/model/fields.ts:255-258`), so its `raw` is blank
   whether the field is empty or its value sits below it. On `raw` alone the two cannot be told
   apart. **Basis:** [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md):
   report, never guess. The reviewers offered two readings: (a) it stays `'unreadable'` under
   `'absent'`; (b) it is absent only when the heading's own section body is empty. Product would
   accept it as absent with one documented sentence. This review takes (a), because it fails
   closed, and (b) can be added later without breaking a rule. Overrule by choosing (b) before the
   plan is Ready.

3. **The `'value'` reading is not adopted, and the option sits on `FieldOptions`.**
   - **`'value'`:** all three lenses lean against it. It adds nothing the `value` callback cannot
     already do, and naming it in the union would look like an endorsement of the inversion in
     Measured row 4. Adding a union member later is an additive minor, so leaving it out closes
     nothing off.
   - **`FieldOptions`, not `HaveFieldOptions`:** product and enforcement lean to `FieldOptions`;
     the architect argued both sides. **Basis:** so every reader agrees. The submission's framing
     is a false choice, which all three lenses noted: `FieldOptions` is already passed per call, so
     two rules can already declare different readings. The real question is which readers can take
     the declaration, and `fields().resolveAgainst()`, the idiomatic optional rule, and
     `agreeWithFolder` take it only through `FieldOptions`.

### What the plan must add

1. **The no-value invariant, in place of "dropped before precedence".** If the empty occurrence is
   only dropped, `fieldVerdict` falls through its no-value chain and three later fallbacks re-read
   the dropped line and report false causes (`packages/md/src/model/field-verdict.ts:153-209`): "follows a
   code fence that never closes", "is outside the header", and "no Confirmed field …; its labels:
   Confirmed". If `'absent'` instead returns early where `'empty'` does today, a document that also
   has the label in a shape no form reads becomes decided false when it should be undecided. The
   rule to write: a document whose read occurrences are all written empty gets the verdict it would
   get without those lines, and only the final "no field" cause is replaced by one that names the
   empty line. "A known false, not undecided" then holds only when nothing else on that path is
   unreadable.
2. **A message that composes, names the declaration and gives a fix.** `agreeWithFolder`'s F4
   builds `… and has ${c.message}` (`packages/md/src/conditions/agree-with-folder.ts:372-379`), so
   the submission's message reads "… and has Confirmed at line 3 is written empty, …". "This rule
   reads" also misattributes the reading, which is the `FieldOptions` declaration. The reviewers
   converged on a noun phrase that opens with "no", for example
   `no Confirmed value: line 3 writes the label empty, which empty: 'absent' reads as none; write a value`.
   Add an acceptance row with the F4 text verbatim, and state that under the option an empty field
   in a bound folder moves from F5 (withheld) to F4 (judged).
3. **Break class 1 restated.** It holds for the condition form only. In the predicate form the
   submission measured, `satisfy(not(predicateHaveField(spec))).should().notExist()`, the document
   becomes decided false. The finding is then notExist's "should not exist" at line 1, with no
   label and no declared reading, and it loses `bypassFilters`, so it can be suppressed. Either
   restate the break class against `docs().should().haveField(spec)` and teach that form for
   required fields, or accept the line-1 message and say so.
4. **A decision on `fields()` and `examined`.** When every occurrence is written empty, `fields()`
   under `'absent'` reaches the kernel's empty-selection finding ("… widen the selection"). The
   colour is honest ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)), but the
   attribution is wrong, and `.expectEmpty()` is the wrong remedy for a corpus that fills in over
   time. Enforcement recommends keeping the drop and disclosing "N occurrences read as absent
   under `empty: 'absent'`". Restate "every reader gives the same answer": the presence readers
   agree on presence, and `fields()` agrees on which occurrences are values.
5. **The precedence trade, named.** An empty structured occurrence beside a filled one is red today
   as `Confirmed is given twice (line 3 '', line 7 '…'); keep one`. A leftover template line beside
   a hand-written copy is plausible drift, and the option turns that red green. Name the trade as
   deliberate, pin it with a test, and enumerate the neighbours: two empty structured occurrences;
   empty structured plus filled `plain`, where the plain value now resolves; filled structured plus
   empty `plain`, which must leave `disagreeing`; and aliases.
6. **Named-test sabotage rows, not `check-nonvacuity.mjs` rows.** No gate in this repository will
   declare the option, so `check:nonvacuity` can hold no row for it. The honest shape is a sabotage
   matrix over named `packages/md/tests` titles, as in
   [plan 0468](../plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md). Add
   rows for `'absent'` widened to the cut-to-nothing shapes, for one reader ignoring the option,
   and for the build-time refusal removed. Cite the six existing `has no value this rule can read`
   assertions as the "byte for byte" mechanism, and say there is no standing gate coverage.
7. **One build-time validator for `FieldOptions`.** `agreeWithFolder` never calls `checkRegion`, so
   a refusal copied onto `checkRegion`'s call sites would leave `agreeWithFolder` unchecked for
   `empty` too. Use one `checkFieldOptions`, covering `region` and `empty`, called from all three
   build sites. Branch on `=== 'absent'`, never on `!== 'unreadable'`, so a value the refusal
   misses fails closed.
8. **Docs ship with the build.** A short "optional and required fields" passage in
   `docs/markdown.md` and `packages/md/README.md`: optional is
   `fields(c, spec).should().resolveAgainst(allowed)`, required is
   `docs(c).should().haveField({ ...spec, oneOf })`, and `empty: 'absent'` serves both when a blank
   means "not yet". Say which sources of an empty value the option covers, and that a bold empty
   field needs a blank line or another label after it, or the next prose line is read as its value.

### Minor

- **Naming.** In the family, "empty" means an empty selection: `.expectEmpty()`, and the refused
  `.allowEmpty()`. Product leans to `blank: 'absent'`, which also matches the raw-keyed meaning.
  Reusing `'absent'` is fine: it is the `FieldCause` kind, and that type is not exported.
- **Examples.** Lead the docs with a template field every reader knows, such as `**Superseded by:**`
  in an ADR template.
- **Out of scope.** Add `honestyAtClose`, whose State reader does not take `FieldOptions`, so no one
  expects the ledger to honour the declaration.
- **Dogfooding.** The claim holds: no label this repository's gates read is written empty (a grep of
  `work/`, `adr/` and `docs/`). Take one of the bold lead-in records as a fixture for the third
  break class.
- **Older versions.** eess-md 0.13.0 ignores an unknown option member, so a caller on an older
  version fails closed (red). That is the safe direction, and a reason never to make `'absent'` the
  default.
- **Tier.** Tier 1 (static) is the honest tier, and the submission claims no more.

### Corrections to the submission

Found by this review and recorded here rather than edited away:

1. Ask A says "a label written with no value", but its mechanism and the precedence criterion say
   "an occurrence whose values are all empty". Those are different sets (decision 1).
2. The Problem's "the optional rule cannot be written" is true only of the blank case;
   `fields().resolveAgainst()` writes the rest today.
3. Break class 1 holds only for the condition form (addition 3).
4. The proposed message does not compose inside `agreeWithFolder`'s F4, and "this rule reads"
   misattributes the reading (addition 2).
5. The non-vacuity criterion names fixture rows that `check:nonvacuity` cannot hold (addition 6).
6. The configuration criterion copies `checkRegion`, which `agreeWithFolder` never calls (addition
   7).
7. Measured row 4 understates itself. The `value` placeholder also turns the required rule green on
   the emoji-only and the list lead-in documents. Rows 1, 2 and 4 otherwise reproduce exactly.

One correction is to this review's own survey, not the submission. The survey suggested a partial
way to write the optional rule today: strong-Kleene `or()` composed with a hand-written
`predicateHaveTextMatching` regex. All three reviewers measured it, and it gives false greens. It
passes `**confirmed:** soon` and `__Confirmed__: soon`, both of which the `bold` form reads. It
passes a fenced template beside a prose value, a bold label leading a list, and the empty-plus-filled
conflict. It falsely reds an empty list-item field. The kernel's Kleene semantics are correct here;
the second reader is what is wrong. It is the "presence reader of the corpus's own" the submission
rejects, and the measurement supports the ask.

**Found beside this review, recorded separately:** a bad `region` passed to `agreeWithFolder`
builds and then crashes with a `TypeError` at run time, because it never calls `checkRegion`. Filed
as [bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md). It shares a root cause
with addition 7, so the plan says up front whether its fix joins the plan.

### Praise

- It measures before it asks. The four-row table, and row 4's inversion above all, made the
  duplication question answerable.
- It rejects both workarounds with a reason for each, and the reviewers' measurements confirm both
  are unsafe.
- Placement is right first time: eess-md only, on the caller's options, nothing in the kernel, and
  the default fail-closed and unchanged byte for byte. That is
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) applied as intended.
- It reuses the existing `'absent'` cause kind instead of inventing a fourth verdict state.
- Break class 1, that the required rule still reds, is the property that keeps the option from
  being `.allowEmpty()` in another form, and the submission states it first.
- Out of scope holds the line on `—`, `n/a` and `TBD`, and the examples are generic.

### Next step

[Plan 0581](../plans/0581-md-a-field-written-empty-can-mean-absent.md) owns Ask A, with the three
decisions and the eight additions above, as one Draft plan in eess-md only. It declares that it
implements this proposal. This proposal stays Draft until then; whoever files the plan sets
`Promoted` in that plan's PR.
