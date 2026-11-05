# Proposal 028 — md: one document's field, read as the gate reads it

**State:** Draft — filed 2026-11-05 from an adopter's question, at the maintainer's request; not yet
reviewed.
**Priority:** Medium — no false green in eess itself (the header case the adopter measured is
[bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md)), but no public
reader returns one record's value as `haveField` decides it: on a conflict, on the header region and
on what it cannot read. A tool that shows one record's value keeps its own copy of eess-md's label
reader, or reads a different value than the gate.
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
   document and sets aside every code block the parser reports; `fields()` hands back every
   occurrence and sets aside only closed fences, by design (`SetAside`,
   `packages/md/src/model/prose.ts:294`: a rule whose findings grow with what it reads errs toward a
   false red). The same docstring warns about "a reader that keeps only the **last** of something
   … an example read after the real line becomes the verdict". A view that shows the first
   occurrence has the mirror defect: an example read before the real line becomes the answer.
2. **`corpusFromText` refuses a document holding a waiver directive** (`packages/md/src/corpus.ts:255`,
   through `refuseWaivers` at `:330`). A waiver in a text corpus would silently not apply to a rule,
   so it refuses rather than differ; [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) already records the refusal as a gap, owned by the
   kernel. A view that only reads a field has no waiver to apply, and its valid record becomes a
   thrown `ArchConfigError`.

## Measured

On `main` at b2231b70 (eess-md 0.14.0), built packages, one record each, the options above (values
shown without the leading space `value: (v) => v` keeps). `findState(text, vocabulary, undefined,
['Status'])` is the ledger's public reader (survey below), given a vocabulary that holds every value:

| record                                              | `fields().select()`                                                                                                               | `haveField`                                                                | `findState`                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| an indented `Status: fake`, then `**Status:** real` | `fake` (line 3) and `real` (line 5)                                                                                               | passes: reads `real`, the indented line is code                            | `real`, line 5                     |
| a fence that never closes, then a field             | both, the one in the fence first                                                                                                  | `Status at line 4 follows a code fence that never closes; close the fence` | `null`, no cause                   |
| an indented `## Notes`, then `**Status:**`          | nothing (the header ends at the indented line: [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md)) | passes                                                                     | the value, line 5                  |
| `**Status:** a` and an `<!-- eess-exclude … -->`    | `corpusFromText` throws `ArchConfigError`                                                                                         | not reached                                                                | `a`, line 3                        |
| `**Status:** a`, then `**Status:** b`               | both                                                                                                                              | `Status is given twice (line 3 'a', line 4 'b'); keep one`                 | `a`, the first                     |
| a real `## Notes` heading, then `**Status:**`       | nothing (outside the header)                                                                                                      | outside the header                                                         | the value (its own, larger region) |

A value rule over the first two rows judges both occurrences and reds on each, as designed. Only a
reader that picks one gets the wrong value or none. `findState` agrees with `haveField` on the first
and third rows, reads the fourth, and differs on the unclosed fence (no cause), the conflict (the
first wins) and the header region.

## Existing code survey

| ask                                               | finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read one document's field as the gate does        | **The decision and its causes are public; the value is not.** `predicateHaveField(spec)` (`packages/md/src/builders/have-field.ts:73`, exported from the root and documented in `docs/markdown.md`) answers has / has not with `.test(doc)`, and `.undecided(doc)` returns each cause it cannot read, with its message: measured, an unclosed fence and two occurrences that disagree each come back as a cause, an indented example as none. The resolved value is internal: `resolveField` (`packages/md/src/model/field-resolve.ts:48`) returns `value` (with the plain occurrences that disagree), `empty`, `conflict` or `none`, reading with `'code-blocks'`, and `fieldVerdict` (`packages/md/src/model/field-verdict.ts:68`) adds the causes. Neither is exported from the root or from `@nielspeter/eess-md/internal`. |
| Read one record's field from text, with no corpus | **Exists for a different reading.** `findState(text, vocabulary, root?, labels?)` (`packages/md/src/rules/ledger.ts:274`, exported from `@nielspeter/eess-md/rules/ledger`, documented in `docs/markdown.md` "so a caller can ask the question without a second opinion") reads text with `'code-blocks'` and takes the label list, so no corpus is built and no waiver is refused. It is the ledger's reading, not `haveField`'s: the first of two occurrences wins, its region is the ledger's larger one, an unclosed fence gives `null` with no cause, and it needs a vocabulary (`state` is absent outside it, `raw` carries the value).                                                                                                                                                                                   |
| `fields()` with a `setAside` option               | **Exists inside.** `readFields(doc, options, setAside)` (`packages/md/src/model/fields.ts:277`) takes it; `fields()` passes the default. Not asked: a rule that may choose to read less is the direction `SetAside`'s design refuses, and the view's need is one resolved value, which a rule's selection is not.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| An `MdDocument` from text                         | **Does not exist publicly.** `MdDocument` is a public type (`packages/md/src/index.ts:101`), but the only public ways to get one are `corpus()` and `corpusFromText()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A real corpus the caller already holds            | **Exists.** `fields(c, options).that().satisfy(inDocuments(resideInFile('…')))` narrows a rule to one record, and `.select()` returns its occurrences: still every occurrence, not the gate's one value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `corpusFromText` accepting waivers                | **Recorded:** [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) (Draft), owned by the kernel in [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Whether part of this ask is documentation (pointing a view at `findState` and `predicateHaveField`)
rather than new API is the review's to decide.

## Asks

1. **`haveField`'s value, public.** Given an `MdDocument` and `FieldOptions`, return what `haveField`
   decides: the value (and the plain occurrences that disagree), nothing, an empty value, a conflict
   between occurrences, or that the field cannot be read, with each cause and its remedy.
   `predicateHaveField` already gives the decision and the causes; what is missing is the value, so
   a view and the gate cannot disagree on one record.
2. **The same over text.** Text input exists publicly in `findState`, with the ledger's reading. What
   is missing is `haveField`'s reading over text: a caller holding a record's text (read from another
   branch, say) gets an `MdDocument`, or the reader takes text directly, without building a corpus.
   [Bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md)'s fix would remove the waiver
   throw from `corpusFromText`, but not the need to assemble a corpus to read one record, nor the
   reading.

## Acceptance criteria

- **Break class (agreement):** for each record in the Measured table, the reader returns what
  `haveField` decides: row 1, `real`; row 2, cannot read, naming the unclosed fence; row 3 (once
  [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md) is fixed), the
  value below the indented line; row 4, `a` (through ask 2, below); row 5, a conflict (below); row 6,
  outside the header, as a cause.
- **Break class (conflict):** two structured occurrences with different values are a conflict, never
  the first of them.
- **Break class (waiver):** a record holding a waiver directive reads its field through ask 2.
- **Non-vacuity:** a reader that returns the first occurrence, and one that reads with
  `'closed-fences'`, each fail a row.

## Dogfooding

This repository's ledger reads a record's `State:` with `findState`. Measured above, it and
`haveField` disagree on two occurrences (the first wins), on an unclosed fence (no cause) and on the
region. Whether the ledger should read through the reader of ask 1 is a question for the review; the
disagreement is the evidence.

## Open questions

- Is the reader's result `haveField`'s internal `FieldResolution` made public, or a smaller shape for
  callers who only want the value or the reason they cannot have it?
- For ask 2: a public document parser, or the reader takes text and parses privately? The first is
  more general and makes `MdDocument`'s shape a larger promise.

## Out of scope

- **A `setAside` option on `fields()`** (see the survey).
- **`corpusFromText` accepting waivers**, which is [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md)'s (the kernel, in
  [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s shape). This proposal does
  not depend on it.
- **The header boundary**, which is [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md).
