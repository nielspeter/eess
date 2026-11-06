# Proposal 028 — md: one document's field, read as the gate reads it

**State:** Draft — filed 2026-11-05 from an adopter's question, at the maintainer's request;
reviewed 2026-11-05, Split and sequence (see "Review — 2026-11-05"): ask 1 accepted and implemented
by [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md) (2026-11-06); ask 2
accepted 2026-11-06, reshaped, and owned by [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md). The proposal stays Draft until that plan is built, as
the proposals promoted so far waited for their work.
**Priority:** Medium — no false green in eess itself (the header case the adopter measured is
[bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)), but no public
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

| record                                              | `fields().select()`                                                                                                                     | `haveField`                                                                | `findState`                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| an indented `Status: fake`, then `**Status:** real` | `fake` (line 3) and `real` (line 5)                                                                                                     | passes: reads `real`, the indented line is code                            | `real`, line 5                     |
| a fence that never closes, then a field             | both, the one in the fence first                                                                                                        | `Status at line 4 follows a code fence that never closes; close the fence` | `null`, no cause                   |
| an indented `## Notes`, then `**Status:**`          | nothing (the header ends at the indented line: [bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)) | passes                                                                     | the value, line 5                  |
| `**Status:** a` and an `<!-- eess-exclude … -->`    | `corpusFromText` throws `ArchConfigError`                                                                                               | not reached                                                                | `a`, line 3                        |
| `**Status:** a`, then `**Status:** b`               | both                                                                                                                                    | `Status is given twice (line 3 'a', line 4 'b'); keep one`                 | `a`, the first                     |
| a real `## Notes` heading, then `**Status:**`       | nothing (outside the header)                                                                                                            | outside the header                                                         | the value (its own, larger region) |

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
  [bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md) is fixed), the
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
  _Corrected 2026-11-06: ask 2, as accepted, does depend on it ([plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md))._
- **The header boundary**, which is [bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md).

## Review — 2026-11-05

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, each against a survey written first and
each with its own throwaway probes against the built eess-md 0.14.0 (each under 0.2 s); no gate,
suite or `validate` was run for the review. All three found the capability generic and in the right
package, and none found a duplicate that closes ask 1. The two asks are two shippable things on
different timelines, so each is disposed of below; neither is planned here.

### Existing code survey

- **Ask 1 is narrowed by public API, not closed.** `predicateHaveField(spec)` gives `haveField`'s
  decision (`.test(doc)`) and its causes (`.undecided(doc)`), and `spec.oneOf` tests the resolved
  value: asked once per candidate, it returns `haveField`'s value for a **single-valued field with a
  finite vocabulary** (measured: only `real` matches in row 1; rows 2 and 5 refuse with the cause).
  It does not give it otherwise (architect I-3, enforcement I6, measured): it cannot tell "no field"
  from "a value outside the candidates" (both all false, no cause, which is
  [bug 0120](../bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md)'s case on the caller's
  side), a split field reads all false even when every value is a candidate, disagreeing prose is
  dropped, and candidates must be regex-escaped. Ask 1 stands for free-text and multi-valued fields
  and for any view that must name a value it does not expect.
- **The resolver to publish exists, and it is not `resolveField`.** `fieldVerdict`
  (`packages/md/src/model/field-verdict.ts:68`) is the one `haveField` and `agreeWithFolder` share,
  as `resolveLink` is shared by the link rules. `resolveField`
  (`packages/md/src/model/field-resolve.ts:48`) answers `none` on an unclosed fence and on a value
  outside the region (architect I-1, measured), so publishing it would fail the submission's own
  rows 2 and 6.
- **`findState` is a second public reading, and it fails open in a shipped gate.** Measured by the
  enforcement lens and confirmed here: `honestyAtClose` passes a live plan holding `State: Draft`
  then `State: Done` with an open box, and reds the reverse order. Recorded as
  [bug 0623](../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md) (High), with the
  documentation's "without a second opinion" claim. This contradicts the submission's Priority line,
  "no false green in eess itself".
- **The dogfood is already decided and has a second instance.** [Plan 0498](../plans/0498-honestyatclose-places-a-record-with-block-5.md)
  moves the ledger's state reading onto the root's field blocks ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s "a preset needing what
  the root lacks adds the block to the root first"), and `scripts/lib/finished-not-closed.mjs:151`
  reads one record's state with `findState`, the adopter's use case in this repository.
- **Ask 2 is unmeasured beyond [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md).**
  One `corpusFromText` over N texts is its intended use; once [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) lands, the waiver throw goes
  and the cost of assembling a corpus to read records has not been measured.

### Placement

The eess-md root (architect M-1): labelled values exist only in eess-md, so not the kernel ([ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md));
not `/internal`, which [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) keeps from adopters; not a new subpath, which [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 4 rules
out for blocks; and on the root, because [plan 0498](../plans/0498-honestyatclose-places-a-record-with-block-5.md)'s preset may import nothing else
(`md/rules-import-only-the-root`). [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1 is satisfied: `label` and `forms` are required.

### Dispositions

| Ask                             | Disposition          | Condition / shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — `haveField`'s value, public | `Accepted, reshaped` | [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md). Reshaped: not `FieldResolution` but `fieldVerdict`'s outcome, a union in which a conflict, an empty value and every cause the gate cannot read replace the value, a missing section reads as absent, and text input is left to ask 2. The ruling held it; the maintainer accepted it the same day. Implemented by [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md), 2026-11-06 ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2 — the same over text          | `Accepted, reshaped` | Accepted 2026-11-06 at the maintainer's direction, and owned by [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md), which fixes [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) and cannot close without it. Reshaped: the ask wanted a reader "without building a corpus"; the plan's answer is [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md)'s fix plus documentation, `corpusFromText` + `resolveFieldValue`, because the cost is measured (one corpus over 590 records builds in about 0.6 s, and a corpus per record costs about 1.2 ms), so no new reader or parser is needed. The held condition's first branch is what this plan meets, once built; its second (a consumer that cannot wait for [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md)) is not the case: the consumer, named 2026-11-05, waits on that fix. Held before, verbatim: "Unholds when [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) is fixed and the cost of building a corpus over a board's texts is measured, or when a consumer is named that cannot wait for [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md)." |

### The shape ask 1 is held to

- **`fieldVerdict` made public as a resolver**, modelled on `resolveLink`: a free function over an
  `MdDocument` and `FieldOptions`, the model layer the predicate and condition already consume
  (architect M-2). Not a `.value()` member on the predicate (the kernel's `Predicate<T>` has no room
  for it, and `not()`/`and()`/`or()` would drop it) and not a value in `.undecided()` (the cause
  channel).
- **A discriminated union in which the causes replace the value** (enforcement I1, [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)): no
  reachable value on any arm but the value arm; a conflict and an empty value are causes, as
  `haveField` classes them, never arms carrying occurrences, which would put first-wins one `[0]`
  away; beside a value, only the causes [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 4 says the verdict does not depend on
  (disagreeing prose, a label in a form not read). Not `FieldVerdict` as is: its `has: boolean`
  is the `test()` collapse.
- **The value arm carries the split `values` and each occurrence's own `label`**, not a joined string;
  occurrences as the public `MdTerm`, not a new `FieldOccurrence` export (product).
- **Option validation in the resolver**: a malformed region or an empty label is an
  `ArchConfigError`, since a reader returning a value has no `examined` floor behind it (architect
  I-5). Whether that same move closes [bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md)
  is a bundling decision for the plan, stated here so it can be overruled.
- **[Proposal 025](./025-md-a-field-written-empty-can-mean-absent.md)'s `empty: 'absent'`** must map
  onto the union before it is public (architect I-7).
- **"One reader" made structural**: the predicate, the condition and the public reader all project
  `fieldVerdict`, with an architecture rule that only `field-verdict.ts` imports `resolveField`, on
  the precedent of `md-one-link-resolver`, and its own non-vacuity row (enforcement I5).

### Corrections to the submission

Kept as filed above; corrected here.

- Acceptance row 3's "(once [bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md) is fixed)" is wrong: `haveField` reads that record today,
  because `'code-blocks'` blanks the indented line before `headerEnd` sees it (architect I-4,
  measured). What exists is a coupling: [bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md)'s
  fix changes `headerEnd`, which both readings call, so its verification must keep `haveField`'s
  reading of row 3.
- Open question 1's first option (publish `FieldResolution`) is unsound; the real question is
  `fieldVerdict`'s content versus a smaller shape (architect I-1).
- The conflict criterion is weaker than `haveField`: two **agreeing** structured occurrences are a
  conflict too (enforcement I3, measured).
- The criteria survive at least six sabotages (enforcement I7): dropping disagreeing prose, reading
  an empty value as `''`, ignoring aliases, `value` or `split`, a section region with no cause,
  absence without its hint, and a second parse path for ask 2. A plan's acceptance must add a row
  for each, plus an agreement test over a fixture corpus that asserts its own count and covers every
  outcome kind.
- The waiver criterion pins no value (enforcement M4); no tier is named (Tier 2 for agreement, Tier 1
  for the architecture rule); [bug 0120](../bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md)
  and [proposal 025](./025-md-a-field-written-empty-can-mean-absent.md) are not linked.
- The survey and Dogfooding missed [plan 0498](../plans/0498-honestyatclose-places-a-record-with-block-5.md) and `scripts/lib/finished-not-closed.mjs`.

### Open questions, surfaced and not settled

- What happens to `findState` once ask 1 ships: the ledger's own reading by design, rebased after
  [plan 0498](../plans/0498-honestyatclose-places-a-record-with-block-5.md), or deprecated (a removal from a published subpath, so a break).
- For ask 2, if it unholds: a private parse inside the reader (sound by construction, one document
  constructor), a public parser (a new constructor under [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1's `frozen` rule), or
  [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) plus documentation.
  _Settled 2026-11-06 by [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md): [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) plus documentation, on the measured cost._
- Whether "one resolver per concept" (links, fields) should become binding, in an ADR, rather than a
  practice held by an architecture rule per concept (architect M-5).

### Praise

The submission measured both readers on the same records before arguing, refused the `setAside`
option on `fields()` with the right reason, and kept the waiver refusal out of its own scope once
[bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) was found. Its table is what let the review find the fail-open in the ledger.
