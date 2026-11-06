# Plan 0624: one document's field value, as `haveField` decides it, public

## Status

- **State:** Done — built 2026-11-06 on `feat/0624-field-reader` from the Ready plan frozen at
  3fb8ef97 against `main` 8969ee6b (v0.18.0): Phase 1a 8f824a0c, 1b 00b10d99, 2 20a119e2, then the
  build review's fixes (architect, product, enforcement, method) in b3e9ba7d and after. Written
  2026-11-05 from the review of [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md), at the maintainer's
  direction, and revised the same day after its own review (architect, product, enforcement, method).
  Every box below is ticked with its evidence, or disposed of with its reason.
- **Implements:** [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)
  (ask 1; ask 2 stays held)
- **Priority:** Medium. No false green in this plan's subject (the ledger's is
  [bug 0623](../../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md)), but a tool that shows one
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
    [bug 0625](../../bugs/0625-a-field-rule-accepts-an-empty-label.md), on its own record.
  - `resolveFieldValue` takes no `oneOf`: a spec carrying one is an `ArchConfigError`, since the
    reader reports the value as written and `haveField` with `oneOf` judges it.
  - [Bug 0588](../../bugs/0588-agree-with-folder-never-checks-its-region.md) (`agreeWithFolder`'s
    region) is not bundled, and `agreeWithFolder` is not moved onto the projection: a no-behaviour
    refactor left out of scope below, so this plan changes no condition.
  - Decided in the build (the build review, overrulable): the value arm is flat (`values`, `line`,
    `label`, `form`, `notes`), not the public `MdTerm` [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s review named, since `MdTerm`
    holds one value, a `doc`, and a `'pattern'` form; `absent` carries `haveField`'s `message` and no
    line, since the whole document is the cause; the options type `FieldReadingOptions` refuses
    `oneOf` at compile time, and the runtime check refuses one that gets past it; both import rules
    also assert `beImported()`.
  - `findState` is not touched: its future is
    [plan 0498](../0498-honestyatclose-places-a-record-with-block-5.md)'s question.

## Problem

A view that shows one record's labelled value (a board's `Status` column) has three public readers,
and none returns the value `haveField` decides:

- `fields().select()` hands back every occurrence and reads indented and unclosed-fence code, by
  design (`SetAside`, `packages/md/src/model/prose.ts:294`).
- `findState` (`packages/md/src/rules/ledger.ts:274`) has the ledger's reading: the first of two
  values wins ([bug 0623](../../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md)), its region is
  larger, and an unclosed fence gives `null` with no cause.
- `predicateHaveField` gives the decision and the causes, and with `oneOf` the value of a
  single-valued field with a finite vocabulary, but not a free-text or split value, and it cannot
  tell "no field" from "a value outside the candidates" (the caller-side form of
  [bug 0120](../../bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md)).

The resolver that decides is `fieldVerdict` (`packages/md/src/model/field-verdict.ts:196`), shared by
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
  | { readonly kind: 'absent'; readonly message: string }
  | { readonly kind: 'unreadable'; readonly causes: readonly Undecided[] }

export type FieldReadingOptions = FieldOptions & { readonly oneOf?: never }

export function resolveFieldValue(doc: MdDocument, options: FieldReadingOptions): FieldReading
```

- **The arm is the predicate's rule**, so the reader and `predicateHaveField` share one mapping:
  resolved → `value`; otherwise any `unreadable` cause → `unreadable`; otherwise `absent`. So:
  - `value`: the one occurrence `haveField` resolves; its `notes` are the causes beside a resolved
    value (prose that disagrees, a label in a form not read).
  - `absent`: no field, **and a section region whose section the document lacks**
    ([plan 0505](./0505-a-field-read-inside-a-named-section.md)'s decided "no"), with
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
- If [plan 0581](../0581-md-a-field-written-empty-can-mean-absent.md) ships first, its
  `empty: 'absent'` maps an empty value to `absent`, under the same arm rule; no arm is added.

## Phases

- [x] **1a. The internal projection, pinned to today.** No public change.
  - [x] Before any rewire, capture a **golden table** from `main`: for every document of a fixture
        corpus × these specs: the header (`forms: ['bold', 'plain']`), the header with `aliases`, a
        named section present and missing, `split`, `value`, and `oneOf`: `predicateHaveField(spec)`'s
        `test()` and `undecided()` messages and the `docs(c).should().haveField(spec)` messages.
        Done: `packages/md/tests/fixtures/field-reading-golden.json`, 126 rows (21 documents × 6
        specs), captured from `main` at 8969ee6b in a worktree with its own install. The first
        capture held 16 documents; the build review asked for the five it lacked (a value outside a
        present section, [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s Measured rows 1 and 3, two causes, two notes), and the table
        was re-captured from the same `main`. The fixture is
        `packages/md/tests/helpers/field-reading-fixture.ts`.
  - [x] Add `fieldOutcome`; rewrite the predicate's decision onto it. The golden table is
        unchanged, every row, compared in both directions with its own counted rows
        (`it('every row is as captured, in both directions: predicate test, undecided causes, condition messages')`).
  - [x] Changeset: `'@nielspeter/eess-md': none` (no consumer-visible change, pinned by the table).
- [x] **1b. The public reader.**
  - [x] `resolveFieldValue`, `FieldReading` and `FieldReadingOptions` on the eess-md root, over
        `fieldOutcome`; the option refusals (an empty label or alias, `forms: []`, a malformed
        region, a `oneOf`).
  - [x] `docs/markdown.md`: a section "Reading a field yourself: `resolveFieldValue`", beside
        `resolveLink`'s, with an example that shows where `doc` comes from, a "which reader" table
        (`fields()`, `predicateHaveField`, `findState`, `resolveFieldValue`: what each is for, what it
        returns and where it differs), and a sentence at the end of the `findState` paragraph
        pointing to it. A linked line in `packages/md/README.md`.
  - [x] `scripts/vacuity-matrix.mjs`: the export's exemption row, its reason stating where
        emptiness is proven.
  - [x] Changeset: `'@nielspeter/eess-md': minor`, additive, no break; its body says `haveField`'s
        output is unchanged (the golden table).
- [x] **2. The import edges, held.** In `arch.rules.ts`, as `eess/md-one-field-resolver` and
      `eess/md-one-field-verdict`, each also asserting `beImported()`:
  - [x] `field-resolve.ts` only imported via `field-verdict.ts`.
  - [x] `field-verdict.ts` only imported via `builders/have-field.ts`,
        `conditions/agree-with-folder.ts` and `src/index.ts`, which re-exports `resolveFieldValue`
        as it does `resolveLink`.
  - [x] Each rule's comment states what it can and cannot see. The first version claimed the
        zero-examined finding would catch an orphaned resolver, which is false for a rule that
        selects its file by path (the build review, measured): `beImported()` was added for it.
  - [ ] done-otherwise — one `scripts/check-nonvacuity.mjs` row, `arch/md-one-field-reading`, but it
        mutates the real `builders/docs.ts` (as the link-resolver row does) rather than planting a
        module: both rule ids fire on it, each naming the importer, and a second case orphans
        `field-resolve.ts` and reds through `beImported()` (measured: exit 1, both cases). The row is
        claimed by `check:arch` in the harness's gate coverage.

## Test inventory

- [x] **Agreement (Tier 2)**, `packages/md/tests/builders/resolve-field-value.test.ts`: 21 documents ×
      5 specs without `oneOf`, 105 pairs. Per pair: `value` ⇔ `test()` true; `unreadable` ⇔
      `undecided()` equal to the arm's causes, whole (file, line, element, message); `absent` ⇔
      `test()` false and `undecided()` empty; the condition's findings (line and message) equal the
      arm's causes, notes or message. Each class is asserted by its cause, with its count
      (`it('each outcome class occurs, by its cause, with its count')`): a conflict, disagreeing and
      agreeing; an empty value; a label only in an unread form, once and twice; an unclosed fence;
      an indented block; outside the header; outside a present section; a missing section; no field,
      with and without labels; a value with a prose note, with an unread-form note, and with both;
      [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s Measured rows 1 and 3. Row 4, the waiver, is a `corpus()` fixture of its own.
      Agreement is with `haveField` without `oneOf`.
- [x] **The reader's own rows**: the value arm and its notes; the `value` option; a missing section
      is absent with its message; no arm but `value` carries a value; a `haveField` spec carrying
      `oneOf` does not type-check (an `@ts-expect-error` held by `typecheck`); the six refusals.
- [x] **The sabotage matrix (Tier 2)**, run 2026-11-06 in a worktree with its own install at
      0f411203, each mutant applied, built (a mutant that fails to build is reported, never counted
      as a survivor), run against the golden, reader and `haveField` test files, and restored; the
      restored tree passed 38 of 38. Every mutant red:

      | mutant | exact edit | red in |
      | --- | --- | --- |
      | notes dropped | `notes: o.notes.map(toUndecided),` → `notes: [],` | each outcome class occurs, by its cause, with its count; the fixture holds 21 documents and 5 agreeing specs: 105 pairs, each judged; the value arm carries the resolved occurrence and its notes |
      | notes truncated to the first | `return { kind: 'value', occurrence: v.occurrence, notes: unr` → `return { kind: 'value', occurrence: v.occurrence, notes: unr` | each outcome class occurs, by its cause, with its count; the fixture holds 21 documents and 5 agreeing specs: 105 pairs, each judged |
      | causes truncated to the first | `return { kind: 'unreadable', causes: o.causes.map(toUndecide` → `return { kind: 'unreadable', causes: o.causes.slice(0, 1).ma` | each outcome class occurs, by its cause, with its count; the fixture holds 21 documents and 5 agreeing specs: 105 pairs, each judged |
      | absent without its message | `return { kind: 'absent', message: o.cause.message }` → `return { kind: 'absent', message: '' }` | a section the document lacks is absent, with haveField's message, not unreadable; each outcome class occurs, by its cause, with its count; the fixture holds 21 documents and 5 agreeing specs: 105 pairs, each judged |
      | a value on the unreadable arm | `return { kind: 'unreadable', causes: o.causes.map(toUndecide` → `return { kind: 'unreadable', causes: o.causes.map(toUndecide` | no arm but the value arm carries a value |
      | a cause's file mangled | `file: doc.file,` → `file: doc.relPath,` | the fixture holds 21 documents and 5 agreeing specs: 105 pairs, each judged |
      | values transformed again | `values: o.occurrence.values,` → `values: o.occurrence.values.map((x) => x.toLowerCase()),` | the value arm carries the values after the value option, as haveField reads them |
      | a missing section mapped to unreadable | `const unreadable = v.causes.filter((c) => c.kind === 'unread` → `const unreadable = v.causes.filter((c) => c.kind !== 'disall` | a section the document lacks is absent, with haveField's message, not unreadable; each outcome class occurs, by its cause, with its count; every row is as captured, in both directions: predicate test, undecided causes, condition messages; no occurrence: no field, naming the labels the document does carry |
      | oneOf not refused | `if (loose.oneOf !== undefined)` → `if (loose.oneOf === Symbol.for('never'))` | a haveField spec carrying oneOf does not type-check as the reader's options; a oneOf throws ArchConfigError |
      | the option checks removed | `checkReaderOptions(options)` → `` | a haveField spec carrying oneOf does not type-check as the reader's options; a malformed region throws ArchConfigError; a oneOf throws ArchConfigError; a whitespace label throws ArchConfigError; an empty alias throws ArchConfigError; an empty label throws ArchConfigError; no forms throws ArchConfigError |
      | first-wins on a conflict | `if (r.kind === 'conflict') {` → `if (r.kind === 'conflict' && r.occurrences.length < 0) {` | a waiver comment does not apply: the reader is not a rule; each outcome class occurs, by its cause, with its count; every row is as captured, in both directions: predicate test, undecided causes, condition messages; selects only the allowed documents; reports the unreadable ones; is silent on an open bug and on a README; several agreeing plain occurrences resolve; disagreeing ones conflict; the same spec in both positions gives one finding per cause; two rules forked from one base do not share their haveField specs; two structured occurrences conflict, agreeing or not; without the region the register is a conflict |
      | a 'closed-fences' reading | `const r = resolveField(doc, spec, 'code-blocks')` → `const r = resolveField(doc, spec, 'closed-fences')` | a value after a code fence that never closes is reported, in either position, not taken as absent; a value in an indented code block names the indented block, not a fence; each outcome class occurs, by its cause, with its count; every row is as captured, in both directions: predicate test, undecided causes, condition messages |
      | a section region with no cause | `if (section !== undefined && regionSections(doc, section).le` → `if (section !== undefined && regionSections(doc, section).le` | a section the document lacks is absent, with haveField's message, not unreadable; each outcome class occurs, by its cause, with its count; every row is as captured, in both directions: predicate test, undecided causes, condition messages |
      | an empty value read as a value | `if (r.kind === 'empty') {` → `if (r.kind === 'empty' && r.occurrence.line < 0) {` | an empty value is unreadable, not present; each outcome class occurs, by its cause, with its count; every row is as captured, in both directions: predicate test, undecided causes, condition messages |
      | aliases ignored | `const labels = [options.label, ...(options.aliases ?? [])]` → `const labels = [options.label]` | every row is as captured, in both directions: predicate test, undecided causes, condition messages; the value arm carries the resolved occurrence and its notes |
      | the value option ignored | `const cut = options.value ?? cleanValue` → `const cut = cleanValue` | every row is as captured, in both directions: predicate test, undecided causes, condition messages; the value arm carries the values after the value option, as haveField reads them |
      | split ignored | `value === '' || options.split === undefined ? [value] : opti` → `[value]` | the value arm carries the resolved occurrence and its notes; with split and oneOf, a field is allowed only when every value is |

      _Correction 2026-11-06 (the build review): an earlier matrix in this record was run in place,
      not in a worktree, named no edits, and its `split` row was wrong. Its edit made the expression
      `value === '' || [value]`, which crashes, so the rows it named went red for the crash; the
      `split` option is caught by the two value rows above, not by the golden table, which cannot
      see a split (its `split.md` row has no message either way). This table replaces it._

- [x] **Phase 2 (Tier 1)**: the non-vacuity row red on the mutated importer, both ids, and on the
      orphaned resolver.

## Out of scope

- Ask 2 (the same over text) and its own mutant, a second parse path: held on
  [bug 0520](../../bugs/0520-waivers-in-a-text-corpus-are-refused.md) and a measurement.
- `findState`'s reading and the ledger: [plan 0498](../0498-honestyatclose-places-a-record-with-block-5.md)
  and [bug 0623](../../bugs/fixed/0623-the-ledger-reads-the-first-of-two-states.md).
- `fields()`' header boundary: [bug 0622](../../bugs/fixed/0622-an-indented-line-like-a-heading-ends-the-field-header.md).
- deferred→[bug 0588](../../bugs/0588-agree-with-folder-never-checks-its-region.md): `agreeWithFolder`'s region check, and moving its own three-way
  mapping (`packages/md/src/conditions/agree-with-folder.ts:356`) onto `fieldOutcome`, a second copy
  of the projection that nothing yet holds to the first. The bug now names both.
- `haveField` accepting an empty label, and malformed options from a plain-JavaScript caller (a made-up
  form, a missing `forms`): [bug 0625](../../bugs/0625-a-field-rule-accepts-an-empty-label.md).
- The non-vacuity harness's rule-id coverage audit reads only `check:corpus`'s ids, so an `eess/…`
  arch rule's id is covered by its row's gate claim alone: [bug 0628](../../bugs/0628-the-nonvacuity-rule-id-audit-reads-only-corpus-ids.md).
- Whether "one resolver per concept" (links, fields) should become an ADR rather than one
  architecture rule per concept: an open question that stays in
  [proposal 028](../../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s review, its home; this plan builds two such rules and does not
  settle it.

Deferred: [bug 0588](../../bugs/0588-agree-with-folder-never-checks-its-region.md)
