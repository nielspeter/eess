# Plan 0582: a document has a section that satisfies a predicate

## Status

- **State:** Draft — awaiting the review's changes (see the proposal's Review, 2026-11-01); not ready to build
- **Implements:** [proposal 026](../proposals/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
- **Priority:** Medium. No false green, but "every record has at least one relation section that
  cites code" cannot be written without a hand step, and both forms an adopter reaches for red
  documents that satisfy it.
- **Effort:** Small for Phase 1 (about an hour); Medium for Phase 2.
- **Created:** 2026-11-01
- **Decided on the review (2026-11-01), each overrulable:**
  - **Phase 1 exports the five section-holding predicate forms** (content, code block, list item,
    link, code pointer: `packages/md/src/model/section-holds.ts:14`). Whether Phase 1 closes on its
    own, as a plan of its own, or this stays one plan in two phases, is decided before Ready
    (Phase 0); the review left it to the author.
  - **Phase 2 is an option on `haveSection` / `predicateHaveSection`** that takes a section
    predicate (the review's layering (b)), not a new name-free lift. The group's name stays the
    argument the API records itself (`packages/md/src/predicates/document.ts:53`), never read
    through the predicate, so `and()` and `not()` cannot hide it.
  - **A condition form on `docs().should()`** ships with it: the only form with no `not()`, with
    per-document findings and with `examined` counting the documents in scope.
  - **The conditional rule ships with its guard rule**, as in
    [plan 0503](./completed/0503-in-sections-boxes-by-section.md): one `const` per name, read by the
    rule and its guard, so a misspelt name leaves the rule green and the guard red.

## Problem

`inSections` already computes, per document, the strong-Kleene "some section satisfies p"
(`packages/md/src/predicates/in-documents.ts:159`), and publishes it only for scope diagnosis. No
public form lets a `docs()` rule say "has a section named G that satisfies p": `haveSection` selects
by name only, and the holding predicates behind `haveCodePointer()` and the rest are unexported
(`sectionsHolding`, `packages/md/src/predicates/section.ts:74`). The review measured the
proposal's own rule shape, `satisfy(not(<lift>(and(sectionsNamed(G), <holds>)))).should().notExist()`:
the inner `and()` hides the name
([bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)), the outer
`not()` hides the lift's registration from the rule's scan, and the conditional rule is fully green
on a misspelt group with `examined` at 0 (its Critical 1 and 2).

## Phase 0: the proposal's changes, before this plan can be promoted

The review's recommended next step lists these, recorded in the proposal itself.

- [ ] Settle which rule the adopter's is, the conditional or the strict one, and name both in words
      (Critical 3). Rewrite the example as the conditional rule plus its existence guard, and give
      the Acceptance one row per rule.
- [ ] Restate the criteria for the condition form: a misspelt string name held directly is
      reported; a `RegExp` group's typo is caught by the guard only (Critical 1d); `examined`
      counts documents in scope in the condition form only (Critical 2); an undecided section is
      reported only where the verdict depends on it.
- [ ] Add the mutant list and name the non-vacuity mechanism: `examples/md/` with `clean/` and
      `violating-<x>/` fixtures made load-bearing (`scripts/check-nonvacuity.mjs:5506`), plus a
      recorded sabotage matrix.
- [ ] Replace the Dogfooding question with the measured answer: no dogfood gate, because 0 of the 32
      completed plans with a "Files changed" section hold a code pointer in it.
- [ ] Ask B lists five kinds, adding `content`.
- [ ] The author's naming calls, the review's open question 1: the option's key (`that` or
      `satisfying`), and Phase 1's names (five noun-first factories, such as
      `sectionsWithCodePointer()`, or one exported union).
- [ ] Whether `haveSection` accepts several names natively for the `RegExp` residual. If it does,
      that widening is its own listed item.

- [ ] One plan in two phases, or Phase 1 split into a plan of its own: decided before Ready.

## Phases

1. **The holding predicates, public.** Five predicate forms on the eess-md root, one per
   `SectionHolding` kind, over the existing `sectionsHolding`. `lang` stays routed through
   `tagIsLanguage` ([ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md),
   `packages/md/src/model/section-holds.ts:71`). Each export is tested itself, not only through the
   dual-use method that shares its function. `scripts/vacuity-matrix.mjs` gains a row per export,
   and `check:surface` runs ([ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)
   clause 2).
2. **A section that satisfies a predicate.** An option on `haveSection` / `predicateHaveSection`
   (dispatched at `packages/md/src/builders/docs.ts:85`) taking a `Predicate<MdSectionElement>`:
   - without it, the description and message (`packages/md/src/conditions/structure.ts:23`, `:34`)
     stay byte-identical, pinned by a test;
   - it reuses `inSections`' fold, writes no third Kleene `any`, stays two-valued unless the
     predicate declares `undecided`, and does not register in `SCOPES`;
   - the condition form's finding names its cause per document: no section matches G (line 1, with
     `headingNotes`' near miss, as `packages/md/src/conditions/structure.ts:28` does), or N sections
     match and none satisfies p (each section's line);
   - an undecided cause keeps its own `file` and `line`.

   An example under `examples/md/` shows the conditional rule and its guard reading one `const`,
   and `docs/markdown.md` and `packages/md/README.md` gain the "at least one section" line beside
   the every-section one. [Bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)
   gains a cross-reference to this workaround and keeps the general fix.

## Files changed

- Phase 1: `packages/md/src/predicates/section.ts`, `packages/md/src/index.ts`,
  `packages/md/tests/`, `scripts/vacuity-matrix.mjs`, `.changeset/` (`@nielspeter/eess-md` minor).
- Phase 2: `packages/md/src/predicates/document.ts`, `packages/md/src/conditions/structure.ts`,
  `packages/md/src/builders/docs.ts`, `packages/md/tests/`, `examples/md/`, `docs/markdown.md`,
  `packages/md/README.md`, `.changeset/` (`@nielspeter/eess-md` minor).

## Test inventory

- Phase 1: each export selects its kind; mutant 5 below reds a test of the export itself.
- Phase 2, the mutants the review lists, each red under its own sabotage:
  1. only the first group section tested (a record with one qualifying and one link-only section
     reds: a false red);
  2. every section required instead of any;
  3. undecided treated as false;
  4. the name not recorded, run on the direct name-argument form;
  5. an exported holding predicate wired to the wrong kind (pointer to link): a false green;
  6. the condition form over a dead scope;
  7. the guard over a misspelt `const G`.
- Each remedy a finding names, applied by a test that shows the finding clears.

## Out of scope

- An "at least one" cardinality on `correspondence()`: its join stays one-to-one.
- Whether the cited code exists: a second rule, `pointers(c)…resolve()`.
- The general fix for a name inside a kernel combinator:
  [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md).
- A container-member form for eess-ts or eess-mermaid: this word becomes the family precedent, and
  nothing is built for it here.
