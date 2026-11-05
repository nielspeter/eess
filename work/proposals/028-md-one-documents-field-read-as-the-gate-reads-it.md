# Proposal 028 — md: one document's field, read as the gate reads it

**State:** Draft — filed 2026-11-05 from an adopter's question, at the maintainer's request; not yet
reviewed.
**Priority:** Medium — no false green in eess itself (the header case the adopter measured is
[bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md)), but a tool that
shows one record's value has no public reader that agrees with `haveField`, so it keeps its own copy
of eess-md's label reader or reads a different value than the gate.
**Origin:** inbound · consuming project, 2026-11-05, on eess-md 0.13.0, measured here on 0.14.0.
**Affects:** `@nielspeter/eess-md`.

## Problem

An adopter's views (a board, a few checks) show one field of one record: its `Status`, read from the
record's text. They kept a copy of eess-md's label reader for that, and set out to replace it with
public API:

```ts
fields(corpusFromText({ 'r.md': text }), {
  label: 'Status',
  forms: ['bold', 'plain'],
  region: 'header',
  value: (v) => v,
}).select(…)
```

Two things stop it:

1. **`fields()` and `haveField` read a document differently.** `haveField` resolves one value per
   document and sets aside every code block CommonMark reports; `fields()` hands back every
   occurrence and sets aside only closed fences, by design (`SetAside`,
   `packages/md/src/model/prose.ts:294`: a rule whose findings grow with what it reads errs toward a
   false red). A view that shows one value is the reader the same docstring warns about: one that
   keeps one occurrence, where an example read before the real line becomes the answer.
2. **`corpusFromText` refuses a document holding a waiver directive** (`packages/md/src/corpus.ts:330`).
   It is for tests: a waiver in a text corpus would silently not apply to a rule, so it refuses rather
   than differ. A view that only reads a field has no waiver to apply, and its valid record becomes a
   thrown `ArchConfigError`.

## Measured

On `main` at b2231b70 (eess-md 0.14.0), built packages, one record each, the options above:

| record                                              | `fields().select()`                                                                                                               | `haveField`                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| an indented `Status: fake`, then `**Status:** real` | `fake` (line 3) and `real` (line 5)                                                                                               | passes: reads `real`, the indented line is code                            |
| a fence that never closes, then a field             | both, the one in the fence first                                                                                                  | `Status at line 4 follows a code fence that never closes; close the fence` |
| an indented `## Notes`, then `**Status:**`          | nothing (the header ends at the indented line: [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md)) | passes                                                                     |
| `**Status:** a` and an `<!-- eess-exclude … -->`    | `corpusFromText` throws `ArchConfigError`                                                                                         | not reached                                                                |

A value rule over the first two judges both occurrences and reds on each, as designed. Only a reader
that picks one gets the wrong value or none.

## Existing code survey

| ask                                          | finding                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read one document's field as the gate does   | **Exists, internal.** `resolveField` (`packages/md/src/model/field-resolve.ts:48`) returns `value` (with the plain occurrences that disagree), `empty`, `conflict` or `none`, reading with `'code-blocks'`; `fieldVerdict` (`packages/md/src/model/field-verdict.ts:68`) adds what it cannot read (an unclosed fence, an indented block) as causes. Neither is exported from the root or from `@nielspeter/eess-md/internal`. |
| `fields()` with a `setAside` option          | **Exists inside.** `readFields(doc, options, setAside)` (`packages/md/src/model/fields.ts:277`) takes it; `fields()` passes the default. Not asked: a rule that may choose to read less is the direction `SetAside`'s design refuses, and the view's need is one resolved value, which a rule's selection is not.                                                                                                             |
| Read one document from text without a corpus | **Does not exist publicly.** `MdDocument` is a public type (`packages/md/src/index.ts:101`), but the only public ways to get one are `corpus()` and `corpusFromText()`.                                                                                                                                                                                                                                                       |
| A real corpus the caller already holds       | **Exists.** `fields(c, options).that().satisfy(inDocuments(resideInFile('…')))` narrows a rule to one record, and `.select()` returns its occurrences: still every occurrence, not the gate's one value.                                                                                                                                                                                                                      |

## Asks

1. **A public one-document field reader with `haveField`'s reading.** Given an `MdDocument` and
   `FieldOptions`, it returns what `haveField` decides: the value (and the plain occurrences that
   disagree), nothing, an empty value, a conflict between occurrences, or that the field cannot be
   read, with each cause and its remedy. One reader, so a view and the gate cannot disagree on one
   record.
2. **The same over text.** A caller holding a record's text (read from another branch, say) gets an
   `MdDocument`, or the reader takes text directly, without building a corpus, so the waiver refusal
   (which protects rules, and this reader is not one) never arises.

## Acceptance criteria

- **Break class (agreement):** for each record in the Measured table, the reader returns what
  `haveField` decides: `real`; cannot read, naming the unclosed fence; and (once
  [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md) is fixed) the
  value below the indented line.
- **Break class (conflict):** two structured occurrences with different values are a conflict, never
  the first of them.
- **Break class (waiver):** a record holding a waiver directive reads its field through ask 2.
- **Non-vacuity:** a reader that returns the first occurrence, and one that reads with
  `'closed-fences'`, each fail a row.

## Dogfooding

This repository's ledger reads a record's `State:` with its own reader (`findState`,
`packages/md/src/rules/ledger.ts`). Whether it could use the public reader, and whether the two agree,
is unmeasured.

## Open questions

- Is the reader's result `haveField`'s internal `FieldResolution` made public, or a smaller shape for
  callers who only want the value or the reason they cannot have it?
- For ask 2: a public document parser, or the reader takes text and parses privately? The first is
  more general and makes `MdDocument`'s shape a larger promise.

## Out of scope

- **A `setAside` option on `fields()`** (see the survey).
- **`corpusFromText` accepting waivers.** Its refusal is right for what it is: a text corpus a rule
  runs over, where a waiver would silently not apply.
- **The header boundary**, which is [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md).
