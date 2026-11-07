# Plan 0636: the section-holding predicates, public

## Status

- **State:** Ready — frozen 2026-11-07 against `main` 27086083 (v0.20.0). Split out of
  [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md) as its Phase 1, on
  that plan's Phase 0 decision; everything it builds on is internalised below.
- **Implements:** [proposal 026](../proposals/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
  (ask B; ask A is [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md))
- **Priority:** Medium. No false green. A section predicate that composes, such as
  `inSections(<a section that holds a code pointer>)`, cannot be written today without a hand step,
  and [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md) needs these
  exports for its option.
- **Effort:** Small, about an hour.
- **Created:** 2026-11-07
- **Decided, each overrulable:**
  - **Five noun-first factories**, one per `SectionHolding` kind, as the
    [proposal 026](../proposals/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
    review's product lens recommended: `sectionsWithContent()`,
    `sectionsWithCodeBlock({ lang? })`, `sectionsWithListItem()`, `sectionsWithLink()`,
    `sectionsWithCodePointer()`. They mirror the builder words, as `haveSubsection` maps to the
    published `sectionsWithSubsection`. Not one `sectionsHolding` over an exported union: its `kind`
    strings carry spaces, and the union would become public API for one factory.
  - **No new word for a twin.** The factories are root functions, not builder methods, and no
    published name equals any of them, so [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)
    takes no prefix here; `check:surface` runs to confirm it (clause 2).
  - `sectionsWithCodeBlock` takes the published `SectionCodeBlockOptions`, the type
    `sections().haveCodeBlock()` already takes, so one option shape serves both.
  - The internal `sectionsHolding` keeps its name and file, and the factories call it: one function
    per kind, so the dual-use method and the export cannot drift apart.

## Problem

`sections().that().haveCodePointer()` and its four siblings select sections by what they hold, but
only as builder methods. The predicate behind them, `sectionsHolding(h)`
(`packages/md/src/predicates/section.ts:80`), is not on the root, so it cannot be passed to
`inSections()`, to `satisfy()` with `and()`/`not()`, or to
[plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s option.
`SectionHolding` has five kinds (`packages/md/src/model/section-holds.ts:15`): `content`,
`code block` (with an optional `lang`, matched through `tagIsLanguage` in any letter case,
[ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md), `:73`),
`list item`, `link` and `code pointer`. Only `link` can be undecided: a section whose only links are
HTML links eess-md cannot read (`packages/md/src/predicates/section.ts:80-106`).

## Phase 1 — the five factories

- [ ] `packages/md/src/predicates/section.ts`: the five factories, each a one-line call to
      `sectionsHolding`, each with JSDoc naming its builder twin and, for `sectionsWithLink`, the
      undecided case.
- [ ] `packages/md/src/index.ts`: export them beside `sectionsWithSubsection`.
- [ ] `scripts/vacuity-matrix.mjs`: one `SIBLING_NOT_CONSTRUCTORS` row per export, "predicate
      factory, used inside inSections (plan 0636)", as its siblings read; `check:vacuity` fails an
      export with no row.
- [ ] `docs/markdown.md` and `packages/md/README.md`: the root section predicates' sentence under
      "Inside matching sections: `inSections`" names the five, with one example that composes one.
- [ ] `.changeset/`: `@nielspeter/eess-md` minor, additive.

## Files changed

`packages/md/src/predicates/section.ts`, `packages/md/src/index.ts`,
`packages/md/tests/section-holding-predicates.test.ts` (new), `scripts/vacuity-matrix.mjs`,
`docs/markdown.md`, `packages/md/README.md`, `.changeset/`.

## Test inventory

Through the public root, as an adopter calls them:

- [ ] Each factory, through `docs(c).that().satisfy(inSections(<factory>()))` over a corpus where
      one section holds that kind and another holds every other kind but it, selects only the
      document element on the first section's lines: each export selects its own kind. A
      `sections(c).that().satisfy(<factory>())` case shows it selects the same sections as the
      builder twin.
- [ ] `sectionsWithCodeBlock({ lang: 'TS' })` selects a block tagged `ts` (any letter case) and not
      one tagged `js`.
- [ ] `sectionsWithLink()` over a section whose only link is an HTML link eess-md cannot read: the
      rule reports the undecided site at its own line rather than drop or select the section
      ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)).
- [ ] The sabotage matrix, run in a worktree with its own install, one mutant at a time against the
      new test file, recorded here:
  1. an export wired to the wrong kind (`sectionsWithCodePointer` to `link`, the review's mutant 5:
     a false green);
  2. `sectionsWithCodeBlock` dropping `lang`;
  3. `sectionsWithLink` built without its `undecided` (a plain `test` over `holds`).

## Out of scope

- [Plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s option on
  `haveSection` (ask A).
- Exporting `SectionHolding` or `sectionsHolding`: the five factories are the public form.
- Accepting several names in `haveSection` natively (decided in
  [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s Phase 0: not
  taken).
