# Plan 0579: the scenario presets take a test side from any language

## Status

- **State:** Draft — awaiting the review's changes (see the proposal's Review, 2026-11-01); not ready to build
- **Implements:** [proposal 014](../proposals/014-crossvalidate-tests-in-any-language.md)
- **Priority:** Medium. A project whose tests are not TypeScript cannot use the scenario presets,
  and the composition it writes instead fails open on an empty or failed source.
- **Effort:** Medium. A refactor of the three presets onto sites, then one new entry over it.
- **Created:** 2026-11-01
- **Decided (2026-11-01, the maintainer, on the review):**
  - The citations come from code only. eess neither reads a declared file nor runs the supplier
    (the review's open question 1), so a stale list is the caller's by construction (its open
    question 3).
  - The input is a source value carrying sites, the supplier's errors and a count of files read,
    not a bare `TestCitationSite[]`.
  - The work is a refactor: `itTitles` (`packages/crossvalidate/src/gherkin-ts.ts:85`) becomes one
    source over a shared core, and the supplied form is a new eess-crossvalidate sub-path. It is
    not named `gherkin-tests`, which a reader cannot tell apart from `gherkin-ts`.

## Problem

The three scenario presets read their test side through `itTitles(project)`, and
`packages/crossvalidate/src/gherkin-ts.ts:9` imports eess-ts at runtime to get it. Everything after
`itTitles` reads `TestCitationSite`s (`packages/crossvalidate/src/gherkin-ts.ts:58`), so a pytest
suite, or any suite eess does not parse, has no way in. The composition such a project writes by
hand is green on an empty binding and red where two tests cite one scenario (the proposal's
Measured section). The review found that a bare array of sites cannot tell "the extractor failed"
from "the suite cites nothing", which makes the supplied form fail open three ways (its Critical 1).

## Phase 0: the proposal's changes, before this plan can be promoted

The review's recommended next step, step 2, lists what must land in the proposal first. Each box
is closed when the proposal says it, not when this plan does.

- [ ] Record the Ruling, and the correction to the proposal's own break class 4, kept beside the
      original text: `scenarioExemptionsCurrent` with exempt scenarios and no citations is green
      today, so the class is stated per preset (Critical 2). The proposal says which form, supplied
      or TypeScript, the criterion covers.
- [ ] Ask A's input becomes a source value with sites, errors and a file count, and the proposal
      says the errors travel inside the input (Critical 1).
- [ ] Add the break class for a site that does not parse (a finding at its own `file:line`) and the
      refusal of a malformed element with `ArchConfigError` (Critical 3).
- [ ] Name the TypeScript reader exported from `/gherkin-ts` as a source, so a polyglot suite passes
      one combined input (Important 1).
- [ ] Replace the parity row with red fixtures per break class, negative controls, sabotage rows
      and probes (Important 3).
- [ ] State the tier ("binds the citations you supply") and the skip contract (Important 3 and 4).
- [ ] Fold Ask B into Ask A's docs, with a section on what a supplier must emit (Important 7).
- [ ] The maintainer decides which ADR sets how many findings one supplier error produces:
      [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 3 (one
      per failure, across rules) or
      [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rules 4 and 5 (one
      per cause per rule, where the verdict depends on it). Critical 4; it blocks the freeze.
- [ ] The maintainer decides whether "a verdict resting on a supplier eess does not own" is an ADR
      or an extension of [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)
      (Important 2). If it is, the ADR is written and linked before this plan is Ready.
- [ ] The sub-path's name is chosen (the review's candidate is `gherkin-citations`).

## Phases

1. **The shared core.** The three presets' bodies move from `gherkin-ts.ts` into one internal
   module that reads sites. `/gherkin-ts` becomes `itTitles` plus a call into it, with its
   signatures and verdicts unchanged. The core uses `\0` as its key separator, as
   `packages/crossvalidate/src/md-gherkin.ts:113` does, not the space at
   `packages/crossvalidate/src/gherkin-ts.ts:136`. The type-only ts-morph import at
   `packages/crossvalidate/src/shared.ts:1` is split out, or the core uses only the neutral half
   (the review's Important 5; decided in this phase).
2. **The supplied entry.** A new sub-path takes the source value:
   - each supplier error is a finding at the error's own location, counted as Phase 0 decides;
   - zero files read is its own finding, which cannot be suppressed and outranks `expectEmpty`;
   - a site that does not parse is a finding at its `file:line`, never skipped as
     `packages/crossvalidate/src/gherkin-ts.ts:143` skips an `it()` title that cites nothing;
   - a malformed element is refused with `ArchConfigError` (the `corpusFromText` precedent,
     `packages/md/src/corpus.ts:233`);
   - `/gherkin-ts` exports its reader as a source for the polyglot union.

   An arch rule holds the new module's import closure free of eess-ts and runtime ts-morph, and
   the bookkeeping lists at `arch.internal.rules.ts:95` and `family.rules.ts:42` are updated.
   `docs/crossvalidate.md` gains the supplied form, its producer contract and its tier.

## Files changed

- Phase 1: `packages/crossvalidate/src/gherkin-ts.ts`, `packages/crossvalidate/src/shared.ts`, a new
  internal module under `packages/crossvalidate/src/`.
- Phase 2: a new sub-path module under `packages/crossvalidate/src/`,
  `packages/crossvalidate/package.json` (`exports`), `arch.rules.ts`, `arch.internal.rules.ts`,
  `family.rules.ts`, `scripts/vacuity-matrix.mjs`, `scripts/nonvacuity/`, `docs/crossvalidate.md`,
  `.changeset/` (an additive minor for `@nielspeter/eess-crossvalidate` only).

## Test inventory

- Phase 1: the existing `/gherkin-ts` tests and nonvacuity rows green, unchanged.
- Phase 2:
  - one red fixture per break class against the supplied entry, in the `CLASSES` discipline of
    `scripts/nonvacuity/bad-gherkin-ts.mjs`;
  - negative controls: two tests citing one scenario is green; an uncited exempt scenario is silent;
  - sabotage rows: the core emptied, the errors channel dropped, the malformed-site refusal
    reverted to `continue`;
  - a `SIBLING_PROBES` entry per new export, for scenarios present with the source empty or failed;
  - an end-to-end fixture in the `scripts/nonvacuity/bad-crossval-gherkin-e2e.mjs` shape that feeds
    a JSON source through a real script, since this repository has no non-TypeScript suite to
    dogfood the errors channel.

## Out of scope

- Reading Python, or any other language, inside eess.
- Any change to the TypeScript form's verdicts.
- The TypeScript form's green on a zero-file project under `expectEmpty`, found by the review
  (Important 8): recorded as [bug 0584](../bugs/0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md).
- Folding md-gherkin's twin resolve loop into the core (Important 6): recorded as a note, not
  bundled.
- [Proposal 016](../proposals/016-eess-py-a-python-dialect.md)'s Ask D disposition, which that
  record updates when this proposal is ruled.
