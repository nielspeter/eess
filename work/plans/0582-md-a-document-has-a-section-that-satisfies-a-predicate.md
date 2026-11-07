# Plan 0582: a document has a section that satisfies a predicate

## Status

- **State:** Draft — Phase 0 settled 2026-11-07 (below); its Phase 1 is now
  [plan 0636](./0636-md-the-section-holding-predicates-public.md), and this plan is frozen after
  that one ships, against the exports it builds on
- **Implements:** [proposal 026](../proposals/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
- **Priority:** Medium. No false green, but "every record has at least one relation section that
  cites code" cannot be written without a hand step, and both forms an adopter reaches for red
  documents that satisfy it.
- **Effort:** Medium (the former Phase 2; the former Phase 1 is
  [plan 0636](./0636-md-the-section-holding-predicates-public.md)).
- **Created:** 2026-11-01
- **Decided on the review (2026-11-01), each overrulable:**
  - **The five section-holding predicate forms** (content, code block, list item, link, code
    pointer: `packages/md/src/model/section-holds.ts:15`) are exported first, by
    [plan 0636](./0636-md-the-section-holding-predicates-public.md) (Phase 0, below).
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
(`sectionsHolding`, `packages/md/src/predicates/section.ts:80`). The review measured the
proposal's own rule shape, `satisfy(not(<lift>(and(sectionsNamed(G), <holds>)))).should().notExist()`:
the inner `and()` hides the name
([bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)), the outer
`not()` hides the lift's registration from the rule's scan, and the conditional rule is fully green
on a misspelt group with `examined` at 0 (its Critical 1 and 2).

## Phase 0: the proposal's changes, before this plan can be promoted

The review's recommended next step lists these, recorded in the proposal itself. Settled
2026-11-07, each overrulable; the proposal's submission is kept as filed, its corrections recorded
in its Review.

- [x] **The rules, in words** (Critical 3). The adopter's is the **conditional** rule: documents in
      scope that have a section of the group must have one that satisfies `p`. It ships with its
      **guard**, reading the same `const G`: some document in scope has a group section
      (`.that()…haveSection(G).should().haveSection(G)`, red only when nothing is selected), as
      [plan 0503](./completed/0503-in-sections-boxes-by-section.md) did. The **strict** rule, every
      document in scope has a group section that satisfies `p`, is the same condition without the
      selecting `haveSection(G)`, and needs no guard: a misspelt group reds every document. The
      example under `examples/md/` shows the conditional rule and its guard; the acceptance below
      has one row per rule.
- [x] **The condition form's criteria.** A misspelt string name held directly is reported, with
      `headingNotes`' near miss. A `RegExp` group's typo is caught by the guard only (Critical 1d; a
      `RegExp` never gets a near miss, `packages/md/src/model/sections.ts:189`). `examined` counts the
      documents in scope in the condition form only (Critical 2), and a dead scope reds with the
      kernel's zero-examined finding. An undecided section is reported only where the verdict
      depends on it: one decided-true section decides the document.
- [x] **Mutants and the non-vacuity mechanism.** The seven mutants are the Test inventory's below.
      The mechanism is an `examples/md/<name>.test.ts` with `clean/` and `violating-<x>/` folders,
      made load-bearing by `check:nonvacuity`'s example swap (`scripts/check-nonvacuity.mjs:1155`),
      plus the recorded sabotage matrix. `scripts/vacuity-matrix.mjs` exempts md's section
      predicates as "used inside a builder", so it is not the mechanism.
- [x] **Dogfooding, measured:** no dogfood gate. Of 63 completed plans, 32 have a `## Files changed`
      section, and 0 of those 32 hold a `path:line` pointer (the review, 1.9–2.0 s); `completed/` is
      frozen, so the gate would red every plan with no remedy.
- [x] **Ask B has five kinds**, `content` included: built by
      [plan 0636](./0636-md-the-section-holding-predicates-public.md).
- [x] **Names** (the review's open question 1). The option's key is **`satisfying`**:
      `haveSection(G, { satisfying: sectionsWithCodePointer() })`. It mirrors the kernel's
      `satisfy()`, while `that` would read as the phase word inside a `should()` call. Phase 1's
      names are five noun-first factories (`sectionsWithCodePointer()` and its siblings), decided in
      [plan 0636](./0636-md-the-section-holding-predicates-public.md).
- [x] **Several names in `haveSection` natively: not taken.** A `RegExp` already names a group, the
      guard catches its typo, and widening a published method's argument is a change of its own;
      nothing here needs it. Out of scope, below.
- [x] **Split.** Phase 1 is its own plan,
      [plan 0636](./0636-md-the-section-holding-predicates-public.md): about an hour, additive,
      useful without ask A, and closable by itself. This plan keeps ask A and is frozen after 0636
      ships, so it builds against the exports as published.

## Phases

1. **The holding predicates, public:** moved to
   [plan 0636](./0636-md-the-section-holding-predicates-public.md) (Phase 0).
2. **A section that satisfies a predicate.** An option on `haveSection` / `predicateHaveSection`
   (dispatched at `packages/md/src/builders/docs.ts:85`), under the key `satisfying`, taking a
   `Predicate<MdSectionElement>`:
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

Phase 2's ledger:

- [ ] The `satisfying` option on `haveSection` / `predicateHaveSection` and its condition form on
      `docs().should()`, with the absent-safe pin on the description and message.
- [ ] The example under `examples/md/`, the conditional rule and its guard reading one `const`, with
      `clean/` and `violating-<x>/` folders.
- [ ] The docs and README lines, [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)'s
      cross-reference, and the `@nielspeter/eess-md` changeset.
- [ ] The sabotage matrix over the seven mutants in the Test inventory, recorded here.

## Files changed

- Phase 1: [plan 0636](./0636-md-the-section-holding-predicates-public.md)'s.
- Phase 2: `packages/md/src/predicates/document.ts`, `packages/md/src/conditions/structure.ts`,
  `packages/md/src/builders/docs.ts`, `packages/md/tests/`, `examples/md/`, `docs/markdown.md`,
  `packages/md/README.md`, `.changeset/` (`@nielspeter/eess-md` minor).

## Test inventory

- Phase 1: [plan 0636](./0636-md-the-section-holding-predicates-public.md)'s; mutant 5 below is
  its mutant 1, red on a test of the export itself.
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
- Accepting several names in `haveSection` natively (Phase 0): a `RegExp` names a group.
- A container-member form for eess-ts or eess-mermaid: this word becomes the family precedent, and
  nothing is built for it here.
