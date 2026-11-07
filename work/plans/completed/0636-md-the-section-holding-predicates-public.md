# Plan 0636: the section-holding predicates, public

## Status

- **State:** Done — built 2026-11-07 on `plan/0582-section-satisfies-predicate` in 88900567, the
  ledger and matrix in 95b1defc, the build review's fixes (product, enforcement, method) after
  them. Split out of [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)
  as its Phase 1, on that plan's Phase 0 decision, and frozen the same day against `main` 27086083
  (v0.20.0) **without a separate review**: the build then departed from the frozen plan three
  times, each recorded below as `done-otherwise` or as added at build: the test form
  `docs(c)…inSections(…)` does not exist, the `lang` case ran the other way round, and the Files
  changed list left out `builders/sections.ts`.
- **Implements:** [proposal 026](../../proposals/promoted/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
  (ask B; ask A is [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md))
- **Priority:** Medium. No false green. A section predicate that composes, such as
  `inSections(<a section that holds a code pointer>)`, cannot be written today without a hand step,
  and [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md) needs these
  exports for its option.
- **Effort:** Small, about an hour.
- **Created:** 2026-11-07
- **Decided, each overrulable:**
  - **Five noun-first factories**, one per `SectionHolding` kind, as the
    [proposal 026](../../proposals/promoted/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
    review's product lens recommended: `sectionsWithContent()`,
    `sectionsWithCodeBlock({ lang? })`, `sectionsWithListItem()`, `sectionsWithLink()`,
    `sectionsWithCodePointer()`. They mirror the builder words, as `haveSubsection` maps to the
    published `sectionsWithSubsection`. Not one `sectionsHolding` over an exported union: its `kind`
    strings carry spaces, and the union would become public API for one factory.
  - **No new word for a twin.** The factories are root functions, not builder methods, and no
    published name equals any of them, so [ADR-023](../../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)
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
[ADR-019](../../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md), `:73`),
`list item`, `link` and `code pointer`. Only `link` can be undecided: a section whose only links are
HTML links eess-md cannot read (`packages/md/src/predicates/section.ts:80-106`).

## Phase 1 — the five factories

- [x] `packages/md/src/predicates/section.ts`: the five factories, each a one-line call to
      `sectionsHolding`, each with JSDoc naming its builder twin and, for `sectionsWithLink`, the
      undecided case. _Added at build:_ `SectionCodeBlockOptions` moved here from
      `builders/sections.ts`, which re-exports it, so a predicate imports no builder; the root
      export is unchanged.
- [x] `packages/md/src/index.ts`: export them beside `sectionsWithSubsection`.
- [x] `scripts/vacuity-matrix.mjs`: one `SIBLING_NOT_CONSTRUCTORS` row per export, "predicate
      factory, used inside inSections (plan 0636)", as its siblings read; `check:vacuity` fails an
      export with no row.
- [x] `docs/markdown.md` and `packages/md/README.md`: the root section predicates' sentence under
      "Inside matching sections: `inSections`" names the five, with one example that composes one,
      and says why it is narrowed by depth (a title section holds what every section under it
      holds). `check:surface` lists none of the five as undocumented. Its summary after the build review's
      fixes:

      ```text
      ✓ public surface — 101 kernel root exports all documented · 839 family exports scanned, 126 dialect-side undocumented (reported) · 7 suffix-named value exports examined, 7 listed as not twins (each matched), 0 twins (ADR-023) (0.14s)
      ```

- [x] `.changeset/`: `@nielspeter/eess-md` minor, additive (`md-section-holding-predicates.md`).

## Files changed

`packages/md/src/predicates/section.ts`, `packages/md/src/builders/sections.ts` (the option type's
re-export, added at build), `packages/md/src/index.ts`,
`packages/md/tests/section-holding-predicates.test.ts` (new), `scripts/vacuity-matrix.mjs`,
`docs/markdown.md`, `packages/md/README.md`, `.changeset/`.

## Test inventory

Through the public root, as an adopter calls them:

- [x] done-otherwise — `inSections` lifts onto line elements (boxes, links, pointers), not onto
      documents, so the plan's `docs(c)…inSections(…)` form does not exist. Each factory is driven
      through `sections(c).that().satisfy(<factory>())` over one document with a section per kind,
      each holding nothing the others hold but content, and selects exactly its kind's sections;
      one test shows each selects what its builder twin selects; a second drives one through
      `taskItems(c).that().satisfy(inSections(and(sectionsAtDepth(2), sectionsWithCodePointer())))`,
      where the depth keeps the title section (which holds every kind) out.
- [x] done-otherwise — the case is the mirror: `sectionsWithCodeBlock({ lang: 'ts' })` selects a
      block tagged `TS` and not one tagged `js`.
- [x] `sectionsWithLink()` over a section whose only link is an HTML link eess-md cannot read: the
      rule reports the undecided site at its own line rather than drop or select the section
      ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)).
- [x] The sabotage matrix, run 2026-11-07 on 88900567 (the worktree was added from that commit) with
      its own install (9 s) and build (7 s), one mutant at a time against the new test file (about
      1 s each). The restored tree red 0
      before and after; every mutant red:

      | mutant | tests red |
      | --- | --- |
      | an export wired to the wrong kind (`sectionsWithCodePointer` to `link`, the review's mutant 5: a false green) | 3 |
      | `sectionsWithCodeBlock` dropping `lang` | 2 |
      | `sectionsWithLink` built without its `undecided` (a plain `test` over `holds`) | 1 |

      _The first run read 1 red on the restored tree: the worktree had no kernel `dist`, so the
      `and` import from `@nielspeter/eess` did not resolve. Built once, it read 0. The `lang` mutant
      first did not apply: its text was written before prettier split the line._

- [x] The build review (2026-11-07, product, enforcement, method). Enforcement re-ran the matrix and
      seven more mutants in its own worktree (each kind swapped for another, `test` returning true,
      `undecided` removed or answering true, `tagIsLanguage` made case-sensitive, the root
      re-exporting `sectionsWithLink` as `sectionsWithCodePointer`): every one red, the restored
      tree 8 of 8 green. Fixed from the review:
  - every factory's JSDoc, and the docs and README, now say a document's title section holds what
    any section in it holds, and name the `not(inSections(…))` form that passes without
    `sectionsAtDepth()` (product, Important);
  - a line after the `sections()` methods table maps each `both` method to its root predicate
    (product);
  - `sectionsWithLink()`'s JSDoc says its `test()` throws on an undecided section (product);
  - the test imports `and` from eess-md's own root, the one-install path the docs promise
    (product);
  - a test drives `sectionsWithLink()` through `inSections()` over an unread link: the site is
    reported at its own line, the box neither selected nor dropped (enforcement);
  - the vacuity rows say where a dead predicate is caught, "a dead one is the consuming rule's
    zero-examined finding" (enforcement).

  The review's findings on [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s
  Phase 0 are fixed there.

Deferred: none.

## Out of scope

- [Plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s option on
  `haveSection` (ask A).
- Exporting `SectionHolding` or `sectionsHolding`: the five factories are the public form.
- Accepting several names in `haveSection` natively (decided in
  [plan 0582](./0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s Phase 0: not
  taken).
