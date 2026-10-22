# Bug 0544: the one-way crossvalidate presets cannot declare their checked side non-empty

## Status

- **State:** Draft — found 2026-10-22 by PR #258's architect and enforcement reviews; no red test yet.
- **Severity:** Medium — **a one-way crossvalidate preset whose checked side is emptied by a broken
  extractor passes, and its user holds no declaration to close it.** ADR-010 §3 requires a preset to
  thread the declaration to every check it constructs, and these two do not.
- **Origin:** self-found, 2026-10-22, PR #258's reviews of
  [bug 0400](./fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md). Recorded rather than
  fixed there: a new option on two published presets is new surface, and 0400's scope was the count.
- **Reported:** 2026-10-22

## Symptom

Since bug 0400, a one-way `beComplete()` counts only the side it reads, so `.expectNonEmpty()` can turn
an emptied checked side red. `adrCitationsResolve` takes `expectNonEmpty` and passes it on. These do not:

- `diagramMatchesCode` with `completeness: 'left-to-right'` or `'right-to-left'`
  (`packages/crossvalidate/src/mermaid-ts.ts:54`; the default is `'both'`, which counts both sides).
- `embeddedDiagramsMatchCode` with a one-way `completeness`
  (`packages/crossvalidate/src/md-mermaid.ts:78`, default `'left-to-right'`, so its default is
  exposed).

With the checked side empty, each passes and its caller has no option to say that cannot be true.

This repo is not exposed: `scripts/check-crossval.mjs` passes `'both'` for both.

## Fix

Undecided. The shape ADR-010 §3 names is an `expectNonEmpty` option on each preset, threaded to its
`.beComplete()` the way `adrCitationsResolve` does (`packages/crossvalidate/src/md-ts.ts`). The
eess-md `rows()` + `correspondence()` compositions have the same gap if a caller builds one by hand;
there the caller holds the builder and can chain the declaration, so it needs a docs line, not an
option.

Related, not part of this record: eess-ts keeps its own `crossProject` builder with separate
emptiness findings, so the kernel and eess-ts define "examined" differently. That was true before
bug 0400.

## Verification

- [ ] A red test per preset: a one-way check over an empty checked side with `expectNonEmpty: true`
      is reported.
- [ ] The option is in the preset's docs and changeset.
