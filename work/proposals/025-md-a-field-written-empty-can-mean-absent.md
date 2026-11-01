# Proposal 025 — md: a field written empty can mean absent

**State:** Draft — filed 2026-11-01 from an adopter's question, at the maintainer's request; not
reviewed.
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

| rule                                            | written empty                                          | no field | `soon`, `—` | a date |
| ----------------------------------------------- | ------------------------------------------------------ | -------- | ----------- | ------ |
| optional, `oneOf` accepting a date or `''`      | red, `has no value this rule can read`, unsuppressable | green    | red         | green  |
| required                                        | red, the same message                                  | red      | green       | green  |
| optional, with `value` mapping `''` to `(none)` | red, unless `oneOf` also accepts `(none)`              | green    | red         | green  |
| required, with `value` mapping `''` to `(none)` | **green**: the placeholder is a value                  | red      | green       | green  |

The required rule already reds an empty field, under a message that says unreadable where the
corpus means missing. The optional rule cannot be written: an empty field reds it whatever `oneOf`
accepts. The workaround, a `value` function that turns `''` into a placeholder, makes the optional
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

## Acceptance criteria

- **Break class:** under `empty: 'absent'`, a required-field rule over a document with
  `**Confirmed:**` empty is red, its message naming the label, the line and the declared reading.
- **Break class (false red):** under `empty: 'absent'`, an optional-field rule with `oneOf` passes a
  document whose field is written empty, and still reds one holding a value outside `oneOf`.
- **Default unchanged:** without the option, both rules give today's findings, byte for byte.
- **Precedence:** with an empty structured occurrence and a filled one, the empty one is dropped
  before precedence, so the filled one resolves rather than a conflict; with `split`, only an
  occurrence whose every split value is empty counts as empty.
- **Every reader:** `fields()`, `haveField`, `predicateHaveField` and `agreeWithFolder` give the
  same answer for the same spec.
- **Configuration:** an `empty` value other than the two is refused when the rule is built, as
  `checkRegion` refuses a bad region.
- **Non-vacuity:** a fixture row reds when `'absent'` is read as `'unreadable'`, and one when it is
  read as a value.

## Dogfooding

This repository writes no field empty on purpose, so its gates would not use the option; the rows
are the proof.

## Open questions

1. **A third reading, `'value'`.** Pass `''` to `oneOf` as a value. A required-field rule would then
   pass an empty field unless its own `oneOf` refuses `''`; whether any corpus wants that, or it
   only invites the inversion measured above, is the review's call.
2. **Where it is declared.** On `FieldOptions`, so every reader agrees, or per rule on
   `HaveFieldOptions`, so two rules over one field can read the empty form differently.

## Out of scope

- Changing the default: a corpus that declares nothing keeps the fail-closed reading.
- Values that look empty but are not (`—`, `n/a`, `TBD`): those are values, judged by `oneOf`.
