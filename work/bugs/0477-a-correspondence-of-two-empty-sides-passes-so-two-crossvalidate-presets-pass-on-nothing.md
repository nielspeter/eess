# Bug 0477: a `correspondence()` of two empty sides passes, so two crossvalidate presets pass on nothing

## Status

- **State:** Draft — found 2026-10-18 by [bug 0403](./fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md)'s fix, the first run of the vacuity matrix over
  the sibling dialects. Reproduced by the matrix's probes; no red unit test yet.
- **Severity:** High — a silent pass. The kernel's `correspondence().beComplete()` over two empty
  selections passes, and so do the two presets that end in it: `diagramMatchesCode()` over an empty
  diagram and a zero-file project, and `adrCitationsResolve()` over an empty corpus and a zero-file
  project.
- **Origin:** self-found · [bug 0403](./fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md)'s fix, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`correspondence().beComplete()` (`packages/core/src/correspondence.ts:109-116`) carries the
cardinality mark: "no element lacks a counterpart" is an absence assertion, and an absence assertion
over nothing is satisfied. When both sides of the join are empty, the join examines nothing and
passes. `diagramMatchesCode()` (`packages/crossvalidate/src/mermaid-ts.ts:35`) and
`adrCitationsResolve()` (`packages/crossvalidate/src/md-ts.ts:130`) end in that join, so a broken
input on both sides (an empty diagram, an unloaded project) is a green build.

The vacuity matrix carries `correspondence()` and both presets as `KNOWN_FAIL_OPEN` entries naming
this bug, expiring 2026-12-31. A fix that only makes the presets report an empty input leaves the
kernel's entry red, which is intended: the join itself is the defect.

## Fix

Not designed. Under [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) §3 an absence rule may legitimately match nothing, but "both sides
empty" is not the same claim as "no element lacks a counterpart": it means neither input loaded.
Candidates:

- a join whose two sides both select nothing is an empty source, reported as such;
- or each preset reports an empty input on either side.

Decide which against [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) §3 and [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md). `preserveRelations()` carries the same mark. Related
limits of the join: [bug 0400](./fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md) and
[bug 0402](./0402-correspondence-checks-leak-between-rules-built-from-one-base.md).

## Verification

- [ ] Red first: each preset over two empty inputs passes
- [ ] Green: the join and each preset report the empty input, and their `KNOWN_FAIL_OPEN` entries are removed

Deferred: none
