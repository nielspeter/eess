# Bug 0497: `corpus()` freezes two folder names by default

## Status

- **State:** Draft — recorded 2026-10-19 as [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1's known exception; the default is read
  from the code and its reach measured, the fix not started.
- **Severity:** Low — no false green on its own: a frozen document's links are still gated. It is a
  document shape on the root, which [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) rules out, and it decides what `pointers().areLive()`
  and every rule built on `frozen` examine for a caller who never named a frozen folder.
- **Origin:** self-found · [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md), second Review, decision 2 ("Records owed": "`corpus()`'s
  frozen default"), filed with [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md).
- **Reported:** 2026-10-19

## Symptom

`corpus({ roots })` with no `frozen` option marks every document under `**/completed/**` or
`**/archived/**` frozen (`packages/md/src/corpus.ts:61`, read at line 78). Those are two lane
folders' names, the working method's, not the caller's. A caller whose done folder is `fixed/` gets
nothing frozen; a caller with a `completed/` folder that is not history gets it frozen anyway.

Measured 2026-10-19 with eess-md's built root over this repository at `9675402`:
`corpus({ roots: ['work/plans/**'] })` reads 73 documents and freezes 47 of them, all in
`work/plans/completed/`; `corpus({ roots: ['work/**', 'docs/**', 'adr/**'] })` reads 523 and freezes
the same 47. Line pointers in this record are to the tree that files it.
`work/bugs/fixed/` (136 records) is not frozen by the default.

`frozen` is read by `pointers()` (`areLive()`/`areFrozen()`), by the linked-back condition, by the
live-target predicate and by the pointer resolver, so the default changes what each examines.

## Fix

Remove the default: a corpus built without `frozen` marks no document frozen. It is a flagged break
(it reds a corpus that relied on the default, since pointers in `completed/` become live), shipped
with a migration line, `frozen: ['**/completed/**', '**/archived/**']`, and naming its dependants
in the changeset ([bug 0185](./fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)). If [plan 0455](../plans/completed/0455-a-corpus-built-from-text.md)'s `corpusFromText` has shipped by then sharing the
default, as that plan writes it, it loses the default in the same change and the same release: one
break for both constructors ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1). If it has not shipped, [plan 0455](../plans/completed/0455-a-corpus-built-from-text.md) builds it without
the default. Every caller in this repository that omits `frozen` is listed and given its own globs in
the same change; `scripts/check-ledger.mjs` is one.

## Verification

- [ ] Red first: a corpus built without `frozen` over a `completed/` folder marks a document frozen
- [ ] Green: it marks none, and `frozen` given explicitly still freezes
- [ ] The same two rows for `corpusFromText`, if it has shipped
- [ ] Every caller here that omitted `frozen` names its globs, and the gates stay green
- [ ] The changeset carries `**Breaking**`, the migration line and the dependants

Deferred: none
