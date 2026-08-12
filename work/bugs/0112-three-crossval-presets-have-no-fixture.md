# Bug 0112: three of `check:crossval`'s five presets have no non-vacuity fixture — emptying any of them leaves the gate green

## Status

- **State:** Draft — the gap is enumerated against the gate list and the script;
  the measurement that proved the class was done for the md↔ts direction (now
  fixed), not for these three.
- **Severity:** Medium — a missing capability in the harness, not a live false
  green: each preset is exercised by package unit tests. What is missing is the
  proof that the **gate** can fail.
- **Origin:** self-found · enforcement review of [0104](./fixed/0104-it-title-capture-stops-at-any-quote.md)'s
  fix, which measured the same gap for `crossval/adr-citations-resolve`
- **Reported:** 2026-08-12

## Symptom

`scripts/check-crossval.mjs` runs five presets. After 0104 added
`crossval/md-ts`, three still have no violating fixture:

| preset                                  | fixture                |
| --------------------------------------- | ---------------------- |
| `diagramMatchesCode` — diagram→code     | `bad-crossval.mjs`     |
| `adrCitationsResolve`                   | `bad-md-ts.mjs` (0104) |
| `scenarioTestsResolve`                  | `bad-gherkin-ts.mjs`   |
| `diagramMatchesCode` — **code→diagram** | **none**               |
| `scenarios().haveUniqueTitles()`        | **none**               |
| `scenariosCovered`                      | **none**               |

`bad-crossval.mjs` asserts the diagram→code direction specifically (`/has no
matching TS class/`), so the completeness check's other half is unproven — a
kernel class absent from the diagram would go unnoticed if that direction were
deleted.

## Root cause

The gate list was keyed to npm scripts, and `check:crossval` is one script
running five presets. Until 0104 the coverage guard mapped it to a single row
and printed "every check:\* accounted for" — a reassurance one level too coarse
for the thing it measured. 0104 made `GATE_FOR` list-valued and added the
reverse check (every gate row must be claimed by some `check:*`), which is what
makes this gap countable; it did not close it.

## Why it matters

This is the harness's own vacuity, and it is the failure mode
[0109](./fixed/0109-nonvacuity-fixtures-read-a-crash-as-a-pass.md) and
[0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) were
about, one level up. A package unit test proves the preset works; only a fixture
proves the _gate wired to this repo_ can go red. The distinction is stated in
`scripts/check-nonvacuity.mjs`'s own header.

## Fix

Three fixtures, each following `bad-md-ts.mjs`'s shape — assert the ruleId, guard
the denominator, and (where cheap) prove the clean direction so a permanently red
gate cannot pass for a working one:

- **code→diagram**: a diagram missing a kernel class that exists →
  `crossval/diagram-completeness` with the `/has no matching diagram class/`
  half. Can reuse `ghost-diagram.mmd`'s sibling.
- **`haveUniqueTitles`**: a feature set with two identically-titled scenarios in
  one file. `packages/crossvalidate/tests/fixtures/gherkin-ts/features/dup.feature`
  and `nested/dup.feature` are close but deliberately distinct — a new fixture is
  cleaner than perturbing counts other tests assert.
- **`scenariosCovered`**: a scenario no test cites. The `green` fixture project
  already leaves two dup scenarios uncovered; a dedicated root avoids moving the
  existing denominators.

Then extend `GATE_FOR['check:crossval']` to all six rows.

## Verification

- [ ] Each new fixture exits 1 on its violating input and is rejected (exit 0 or 2) when its preset is stubbed out.
- [ ] `gateCoverage` lists six gates for `check:crossval`.
- [ ] `npm run validate` green.

Deferred: none.
