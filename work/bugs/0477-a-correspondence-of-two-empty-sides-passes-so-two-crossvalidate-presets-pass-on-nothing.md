# Bug 0477: a `correspondence()` of two empty sides passes, so two crossvalidate presets pass on nothing

## Status

- **State:** Draft — found 2026-10-18 by bug 0403's fix, the first run of the vacuity matrix over
  the sibling dialects. Reproduced by the matrix's probes; no red unit test yet.
- **Severity:** High — a silent pass. `diagramMatchesCode()` over an empty diagram and a zero-file
  project, and `adrCitationsResolve()` over an empty corpus and a zero-file project, both pass.
- **Origin:** self-found · bug 0403's fix, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`correspondence().beComplete()` (`packages/core/src/correspondence.ts:109-116`) carries the
cardinality mark: "no element lacks a counterpart" is an absence assertion, and an absence assertion
over nothing is satisfied. When both sides of the join are empty, the join examines nothing and
passes. `diagramMatchesCode()` (`packages/crossvalidate/src/mermaid-ts.ts:35`) and
`adrCitationsResolve()` (`packages/crossvalidate/src/md-ts.ts:130`) end in that join, so a broken
input on both sides (an empty diagram, an unloaded project) is a green build.

The vacuity matrix carries both presets as `KNOWN_FAIL_OPEN` entries naming this bug, expiring
2026-12-31.

## Fix

Not designed. Under ADR-010 §3 an absence rule may legitimately match nothing, but "both sides
empty" is not the same claim as "no element lacks a counterpart": it means neither input loaded.
Candidates:

- a join whose two sides both select nothing is an empty source, reported as such;
- or each preset reports an empty input on either side.

Decide which against ADR-010 §3 and ADR-014. `preserveRelations()` carries the same mark.

## Verification

- [ ] Red first: each preset over two empty inputs passes
- [ ] Green: each reports the empty input, and its `KNOWN_FAIL_OPEN` entry is removed

Deferred: none
