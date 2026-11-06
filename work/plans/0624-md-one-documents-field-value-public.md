# Plan 0624: one document's field value, as `haveField` decides it, public

## Status

- **State:** Draft — written 2026-11-05 from the review of
  [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md), at the
  maintainer's direction, and revised the same day after its own review (architect, product,
  enforcement, method); to be built after the coming release.
- **Implements:** [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)
  (ask 1; ask 2 stays held)
- **Priority:** Medium. No false green in this plan's subject (the ledger's is
  [bug 0623](../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md)), but a tool that shows one
  record's value has no public reader that agrees with `haveField`, and a consuming project's plan
  waits on one.
- **Effort:** Medium in all, about half a day: Phase 1a Medium (the golden table and the projection),
  Phase 1b Small, Phase 2 Small. Each phase is one review sitting.
- **Created:** 2026-11-05
- **Decided, each overrulable:**
  - The public names are `resolveFieldValue(doc, options)`, on `resolveLink`'s verb-plus-noun
    precedent, and `FieldReading` for its result. "Resolve" here means "decide the value", not
    `fields().should().resolveAgainst()`'s "is in the vocabulary"; the docs say so. The internal
    `resolveField` keeps its name and file: no public name equals it, so renaming it buys nothing.
  - `haveField`'s **condition** stays on `fieldVerdict`'s internal causes, unchanged: it needs the
    `cites` and `element` the section-name scan reads, which a public type should not carry. Only
    the **predicate's** three-way decision moves onto the new internal projection, the one real
    duplicate of it.
  - Options are validated in `resolveFieldValue` only, not in the shared `fieldVerdict`, so
    `haveField`'s behaviour does not change. That `haveField` accepts an empty label is
    [bug 0625](../bugs/0625-a-field-rule-accepts-an-empty-label.md), on its own record.
  - `resolveFieldValue` takes no `oneOf`: a spec carrying one is an `ArchConfigError`, since the
    reader reports the value as written and `haveField` with `oneOf` judges it.
  - [Bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md) (`agreeWithFolder`'s
    region) is not bundled, and `agreeWithFolder` is not moved onto the projection: a no-behaviour
    refactor left out of scope below, so this plan changes no condition.
  - `findState` is not touched: its future is
    [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md)'s question.

## Problem

A view that shows one record's labelled value (a board's `Status` column) has three public readers,
and none returns the value `haveField` decides:

- `fields().select()` hands back every occurrence and reads indented and unclosed-fence code, by
  design (`SetAside`, `packages/md/src/model/prose.ts:294`).
- `findState` (`packages/md/src/rules/ledger.ts:274`) has the ledger's reading: the first of two
  values wins ([bug 0623](../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md)), its region is
  larger, and an unclosed fence gives `null` with no cause.
- `predicateHaveField` gives the decision and the causes, and with `oneOf` the value of a
  single-valued field with a finite vocabulary, but not a free-text or split value, and it cannot
  tell "no field" from "a value outside the candidates" (the caller-side form of
  [bug 0120](../bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md)).

The resolver that decides is `fieldVerdict` (`packages/md/src/model/field-verdict.ts:68`), shared by
`haveField` and `agreeWithFolder` and exported nowhere.

## Design

```ts
import type { FieldForm, FieldOptions, MdDocument, Undecided } from '@nielspeter/eess-md'

export type FieldReading =
  | {
      readonly kind: 'value'
      readonly values: readonly string[] // the split values of the one resolved occurrence
      readonly line: number
      readonly label: string // as written: the label or the alias that matched
      readonly form: FieldForm
      readonly notes: readonly Undecided[] // decided, still reported (ADR-021 clause 4)
    }
  | { readonly kind: 'absent'; readonly line: number; readonly message: string }
  | { readonly kind: 'unreadable'; readonly causes: readonly Undecided[] }

export function resolveFieldValue(doc: MdDocument, options: FieldOptions): FieldReading
```

- **The arm is the predicate's rule**, so the reader and `predicateHaveField` share one mapping:
  resolved → `value`; otherwise any `unreadable` cause → `unreadable`; otherwise `absent`. So:
  - `value`: the one occurrence `haveField` resolves; its `notes` are the causes beside a resolved
    value (prose that disagrees, a label in a form not read).
  - `absent`: no field, **and a section region whose section the document lacks**
    ([plan 0505](./completed/0505-a-field-read-inside-a-named-section.md)'s decided "no"), with
    `haveField`'s own message (the labels it does find, or the missing section). One `message`, not
    a hint cut out of it.
  - `unreadable`: a conflict (two structured occurrences, agreeing or not), an empty value, a label
    only in a form the rule does not read, a value past an unclosed fence or in an indented block, a
    value outside the header or section. Each cause carries `haveField`'s message, whose tail is its
    remedy where `haveField` gives one.

  No `conflict` arm carries occurrences and no value sits on a non-value arm, so first-wins is not one
  `[0]` away. Causes use the kernel's public `Undecided`, already re-exported by eess-md, not the
  internal `FieldCause` (whose `cites` and `disallowed` kind stay internal).

- **One internal projection**, `fieldOutcome(v: FieldVerdict)` in
  `packages/md/src/model/field-verdict.ts`, returns the arm over the internal causes.
  `predicateHaveField`'s decision (`packages/md/src/builders/have-field.ts:83`) reads through it, and
  `resolveFieldValue` maps it to `FieldReading`, dropping `cites` and `kind`.
- **Options refused in `resolveFieldValue`**, each an `ArchConfigError` naming the option: an empty
  or whitespace-only label, `forms: []`, a malformed region (`checkRegion`,
  `packages/md/src/model/fields.ts:63`), a `oneOf`. A reader returning `absent` for every record is a
  plausible-looking wrong answer, so a misconfiguration must throw.
- **Waivers do not apply.** The reader is not a rule: a cause a gate waives through an exclusion
  comment is still returned. The docs say so.
- If [plan 0581](./0581-md-a-field-written-empty-can-mean-absent.md) ships first, its
  `empty: 'absent'` maps an empty value to `absent`, under the same arm rule; no arm is added.

## Phases

- [ ] **1a. The internal projection, pinned to today.** No public change.
  - [ ] Before any rewire, capture a **golden table** from `main`: for every document of a fixture
        corpus × a set of specs (header, a named section present and missing, aliases, `split`,
        `value`, `oneOf`), `predicateHaveField(spec).test()` and `.undecided()` messages and the
        `docs(c).should().haveField(spec)` messages. Commit it as data with its own row count.
  - [ ] Add `fieldOutcome`; rewrite the predicate's decision onto it. The golden table is
        unchanged, every row.
  - [ ] Changeset: `'@nielspeter/eess-md': none` (no consumer-visible change, pinned by the table).
- [ ] **1b. The public reader.**
  - [ ] `resolveFieldValue` and `FieldReading` on the eess-md root, over `fieldOutcome`; the option
        refusals.
  - [ ] `docs/markdown.md`: a section "Reading a field yourself: `resolveFieldValue`", beside
        `resolveLink`'s, with an example that shows where `doc` comes from
        (`c.documents().find((d) => d.relPath === …)`), a "which reader" table (`fields()`,
        `predicateHaveField`, `findState`, `resolveFieldValue`: what each returns and where it
        differs, `findState`'s first-wins included), and one sentence in the `findState` paragraph
        pointing to it. A line in `packages/md/README.md`.
  - [ ] `scripts/vacuity-matrix.mjs`: the export's exemption row, its reason stating where
        emptiness is proven ("model reader; outcome coverage is the agreement test's own count").
  - [ ] Changeset: `'@nielspeter/eess-md': minor`, additive, no break; its body says `haveField`'s
        output is unchanged (the golden table).
- [ ] **2. The import edges, held.** In `arch.rules.ts`:
  - [ ] `modules(p).that().resideInFile('**/packages/md/src/model/field-resolve.ts').should().onlyBeImportedVia('**/packages/md/src/model/field-verdict.ts')`.
  - [ ] `field-verdict.ts` only imported via `builders/have-field.ts`,
        `conditions/agree-with-folder.ts` and the file that re-exports `resolveFieldValue` (named
        when built).
  - [ ] Each rule's comment states what it cannot see, as `eess/md-one-link-resolver`'s does: a
        second reading built on `readFields` that never imports `field-resolve.ts` (how `findState`
        exists), and a resolver inlined into its only importer.
  - [ ] One `scripts/check-nonvacuity.mjs` row: a planted module under `builders/` importing both
        files, asserting both rule ids fire on it.

## Test inventory

- [ ] **Agreement (Tier 2)**, over the fixture corpus, asserting its own document count and that each
      cause class occurs, with its count: a conflict (disagreeing, and agreeing); an empty value; a
      label only in an unread form; an unclosed fence; an indented block; outside the header; outside
      a section; a missing section; no field with its label hint; no field with no labels; a value
      with a prose note; a value with an unread-form note. Per document: - `value` ⇔ `test()` true; `unreadable` ⇔ `undecided()` non-empty, with equal messages;
      `absent` ⇔ `test()` false and `undecided()` empty; - the condition's messages equal the arm's causes plus `notes` (with `absent`'s message).

      Proposal 028's Measured rows are among them (row 4's waiver in a `corpus()` fixture).
      Agreement is with `haveField` **without** `oneOf`.

- [ ] **New tests on the projection**, each red under its own mutant: notes dropped (prose, and the
      unread-form note); `absent` without its message; an occurrence leaking onto a non-value arm;
      the arm mapping (a missing section mapped to `unreadable`).
- [ ] **The review's other mutants** (first-wins on a conflict, an empty value read as `''`, aliases,
      `value` or `split` ignored, a section region with no cause, `'closed-fences'`) mutate
      `fieldVerdict` itself: each is shown red in `haveField`'s existing suite, or a test is added
      there, never a second copy pinned on the reader.
- [ ] The option refusals: an empty label, a whitespace label, `forms: []`, a malformed region and a
      `oneOf` each throw `ArchConfigError` naming the option.
- [ ] A sabotage matrix run in a worktree, each mutant mapped to the test title that reds, recorded
      at close.
- [ ] **Phase 2 (Tier 1)**: the non-vacuity row red on the planted importer, both ids.

## Out of scope

- Ask 2 (the same over text) and its own mutant, a second parse path: held on
  [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) and a measurement.
- `findState`'s reading and the ledger: [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md)
  and [bug 0623](../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md).
- `fields()`' header boundary: [bug 0622](../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md).
- `agreeWithFolder`'s region check ([bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md))
  and moving its own three-way mapping (`packages/md/src/conditions/agree-with-folder.ts:356`) onto
  `fieldOutcome`: a no-behaviour refactor for a later change.
- `haveField` accepting an empty label: [bug 0625](../bugs/0625-a-field-rule-accepts-an-empty-label.md).
- Whether "one resolver per concept" (links, fields) should become an ADR rather than one
  architecture rule per concept: an open question carried from [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s review.
