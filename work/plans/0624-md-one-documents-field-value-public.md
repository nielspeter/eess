# Plan 0624: one document's field value, as `haveField` decides it, public

## Status

- **State:** Draft — written 2026-11-05 from the review of
  [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md), at the
  maintainer's direction: to be built after the coming release.
- **Implements:** [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)
  (ask 1; ask 2 stays held)
- **Priority:** Medium. No false green, but a tool that shows one record's value has no public reader
  that agrees with `haveField`, and a consuming project's plan waits on one.
- **Effort:** Small: Phase 1 about an hour, Phase 2 under an hour.
- **Created:** 2026-11-05
- **Decided on the review (2026-11-05), each overrulable:**
  - The name is `resolveFieldValue(doc, options)`, on `resolveLink`'s verb-plus-noun precedent. The
    internal `resolveField` (`packages/md/src/model/field-resolve.ts:48`) is renamed so no public
    name equals an internal one with another contract (the review's architect lens, M-6).
  - The bundled fix of [bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md) is
    **not** taken: option validation moves into the resolver only for the new public door, and
    0588's `agreeWithFolder` keeps its own record. Bundling would widen this plan to a condition's
    behaviour.
  - `findState` is not touched: its future is
    [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md)'s question.

## Problem

A view that shows one record's labelled value (a board's `Status` column) has three public readers,
and none returns the value `haveField` decides:

- `fields().select()` hands back every occurrence and reads indented and unclosed-fence code, by
  design (`SetAside`, `packages/md/src/model/prose.ts:294`).
- `findState` (`packages/md/src/rules/ledger.ts:274`) has the ledger's reading: the first of two
  values wins ([bug 0623](../bugs/0623-the-ledger-reads-the-first-of-two-states.md)), its region is
  larger, and an unclosed fence gives `null` with no cause.
- `predicateHaveField` gives the decision and the causes, and with `oneOf` the value of a
  single-valued field with a finite vocabulary, but not a free-text or split value, and it cannot
  tell "no field" from "a value outside the candidates".

The resolver that decides is `fieldVerdict` (`packages/md/src/model/field-verdict.ts:68`), shared by
`haveField` and `agreeWithFolder` and exported nowhere.

## Design

```ts
import { resolveFieldValue } from '@nielspeter/eess-md'

const r = resolveFieldValue(doc, { label: 'Status', forms: ['bold', 'plain'], region: 'header' })
if (r.kind === 'value')
  show(r.values, r.notes) // notes: decided, still reported (ADR-021 clause 4)
else if (r.kind === 'absent')
  show('—', r.hint) // the label it does write, when one is near
else show('?', r.causes) // 'unreadable': each cause with its line and remedy
```

- **A discriminated union in which the causes replace the value** ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)):
  - `value`: the split `values`, the occurrence's `line` and written `label`, and `notes` for
    the causes the verdict does not depend on (disagreeing prose, a label in a form not read);
  - `absent`: no field, with the hint `haveField` gives;
  - `unreadable`: each cause (a conflict, two agreeing structured occurrences included; an empty
    value; a value past an unclosed fence or in an indented block; a value outside the region; a
    missing section), with its line and remedy.

  There is no `conflict` arm carrying occurrences and no value on a non-value arm, so first-wins is
  not one `[0]` away.

- **A projection of `fieldVerdict`**, not a second reading. `haveField`'s predicate and condition are
  rewritten to project the same result, so the three cannot drift.
- **Options validated in the resolver**: a malformed region or an empty or whitespace-only label is
  an `ArchConfigError` naming the option. A rule has an `examined` floor; a returned value does not.
- **Occurrences as the public `MdTerm`**, not a new `FieldOccurrence` export.
- **[Proposal 025](../proposals/025-md-a-field-written-empty-can-mean-absent.md)'s `empty: 'absent'`**,
  if [plan 0581](./0581-md-a-field-written-empty-can-mean-absent.md) ships first, maps an empty value
  to `absent`; otherwise the union is built so that member adds no arm.

## Phases

1. **The public resolver.** `resolveFieldValue` on the eess-md root over `fieldVerdict`; the internal
   `resolveField` renamed; `haveField`'s predicate and condition read through the same projection;
   the union's types exported; a `docs/markdown.md` section beside `haveField` (when to use it, and
   when `fields()` or `predicateHaveField` is the right door) and a line in `packages/md/README.md`.
2. **One reader, held.** An architecture rule in `arch.rules.ts` on the precedent of
   `eess/md-one-link-resolver`: only `packages/md/src/model/field-verdict.ts` imports the internal
   occurrence resolver, and only the field modules import `field-verdict.ts`. A
   `scripts/check-nonvacuity.mjs` row plants a second importer and reds it.

## Files changed

- Phase 1: `packages/md/src/model/field-verdict.ts`, `packages/md/src/model/field-resolve.ts`,
  `packages/md/src/builders/have-field.ts`, `packages/md/src/index.ts`, `packages/md/tests/`,
  `docs/markdown.md`, `packages/md/README.md`, `scripts/vacuity-matrix.mjs` (the new export's row),
  `.changeset/` (`@nielspeter/eess-md` minor).
- Phase 2: `arch.rules.ts`, `scripts/check-nonvacuity.mjs`.

## Test inventory

- **Agreement**, over a fixture corpus that asserts its own count and holds every outcome kind:
  for each document, `resolveFieldValue` and `docs(c).should().haveField()` agree. The rows include
  [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s Measured table: `real` for an indented example then a real value; `unreadable`
  naming an unclosed fence; the value below an indented `## Notes`; `unreadable` for two
  occurrences, agreeing or not; `unreadable` outside the header.
- **The sabotages [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s review lists**, each red under its own mutant: the first occurrence
  returned on a conflict; disagreeing prose dropped from `notes`; an empty value read as `''`;
  aliases, `value` or `split` ignored; a section region with no cause; absence without its hint;
  a reading with `'closed-fences'`.
- An empty label and a malformed region each throw `ArchConfigError` naming the option.
- Phase 2's non-vacuity row red on a planted second importer.

## Out of scope

- Ask 2 (the same over text): held on
  [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) and a measurement.
- `findState`'s reading and the ledger: [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md)
  and [bug 0623](../bugs/0623-the-ledger-reads-the-first-of-two-states.md).
- `fields()`' header boundary: [bug 0622](../bugs/0622-an-indented-line-like-a-heading-ends-the-field-header.md).
- `agreeWithFolder`'s region check: [bug 0588](../bugs/0588-agree-with-folder-never-checks-its-region.md).
