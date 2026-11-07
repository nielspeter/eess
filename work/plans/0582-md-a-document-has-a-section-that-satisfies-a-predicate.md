# Plan 0582: a document has a section that satisfies a predicate

## Status

- **State:** Draft — Phase 0 settled 2026-11-07 (below); its Phase 1 is now
  [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md), and this plan is frozen after
  that one ships, against the exports it builds on
- **Implements:** [proposal 026](../proposals/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
- **Priority:** Medium. No false green, but "every record has at least one relation section that
  cites code" cannot be written without a hand step, and both forms an adopter reaches for red
  documents that satisfy it.
- **Effort:** Medium (the former Phase 2; the former Phase 1 is
  [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md)).
- **Created:** 2026-11-01
- **Decided on the review (2026-11-01) and in Phase 0 (2026-11-07), each overrulable:**
  - **The five section-holding predicate forms** (content, code block, list item, link, code
    pointer: `packages/md/src/model/section-holds.ts:15`) are exported first, by
    [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md) (Phase 0, below).
  - **Phase 2 is an option on `haveSection` / `predicateHaveSection`** that takes a section
    predicate (the review's layering (b)), not a new name-free lift. The group's name stays the
    argument the API records itself (`packages/md/src/predicates/document.ts:53`), never read
    through the predicate, so `and()` and `not()` cannot hide it.
  - **A condition form on `docs().should()`** ships with it: the only form with no `not()`, with
    per-document findings and with `examined` counting the documents in scope.
  - **The conditional rule is its own guard** in the condition form (Phase 0, corrected
    2026-11-07): `.that().haveSection(G).should().haveSection(G, { satisfying })` selects exactly
    what a guard would, and a misspelt `G` reds it with the kernel's zero-examined finding. The
    review's guard, as in [plan 0503](./completed/0503-in-sections-boxes-by-section.md), is for an
    absence-rule spelling (`notExist()`), which is green over nothing; the docs say an absence
    spelling needs it.

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
      scope that have a section of the group must have one that satisfies `p`, written in the
      condition form, `.that().haveSection(G).should().haveSection(G, { satisfying: p })`. The
      **strict** rule, every document in scope has a group section that satisfies `p`, is the same
      condition without the selecting `haveSection(G)`: a misspelt group reds every document. The
      example under `examples/md/` shows both, reading one `const G`; the Acceptance section below
      has one row per rule.

      _Corrected 2026-11-07, on the build review's enforcement lens, which measured it on `dist`:
      this box first shipped the conditional rule with a guard,
      `.that()…haveSection(G).should().haveSection(G)`, as the proposal review's decision 2 said.
      In the condition form the guard adds nothing. The conditional rule selects exactly the
      documents the guard selects, so whenever the guard is red the rule is red, with the kernel's
      zero-examined finding. Plan 0503's guard exists because its ratchet is an absence rule, which
      is green over nothing. The guard is load-bearing only for an absence spelling of this rule or
      one that declares `.expectEmpty()`; the docs say so. The box also said "the acceptance
      below" before the plan had an Acceptance section._

- [x] **The condition form's criteria.** A misspelt name held directly reds the conditional rule
      (zero examined) and every document under the strict rule. A case or spacing drift of a string
      name also gets `headingNotes`' near miss (`packages/md/src/model/sections.ts:187-191`); a letter
      typo does not, and a `RegExp` never does (Critical 1d), so those red without naming the
      heading meant: the strict form's "missing section", the conditional form's generic
      zero-examined finding. A test pins each message. `examined` counts the
      documents in scope in the condition form only (Critical 2), and a dead scope reds with the
      kernel's zero-examined finding. An undecided section is reported only where the verdict
      depends on it: one decided-true section decides the document.
- [x] **Mutants and the non-vacuity mechanism.** The seven mutants are the Test inventory's below.
      The mechanism is an `examples/md/<name>.test.ts` with `clean/` and `violating-<x>/` folders,
      made load-bearing by `check:nonvacuity`'s example swap (`scripts/check-nonvacuity.mjs:1155`),
      plus the recorded sabotage matrix. `scripts/vacuity-matrix.mjs` lists the predicates this
      option is added to, `haveSection` and `predicateHaveSection`, as "condition factory, used
      inside a builder" and "predicate factory, used inside a builder", so it probes
      neither and is not the mechanism.
- [x] **Dogfooding, measured:** no dogfood gate. Of 63 completed plans, 32 have a `## Files changed`
      section, and 0 of those 32 hold a `path:line` pointer (the review, as of 2026-11-01, 1.9–2.0 s;
      re-counted 2026-11-07 by the build review's method lens: 66, 33, 0); `completed/` is
      frozen, so the gate would red every plan with no remedy.
- [x] **Ask B has five kinds**, `content` included: built by
      [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md).
- [x] **Names** (the review's open question 1). The option's key is **`satisfying`**:
      `haveSection(G, { satisfying: sectionsWithCodePointer() })`. It mirrors the kernel's
      `satisfy()`, while `that` would read as the phase word inside a `should()` call. Phase 1's
      names are five noun-first factories (`sectionsWithCodePointer()` and its siblings), decided in
      [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md).
- [x] **Several names in `haveSection` natively: not taken.** A `RegExp` already names a group, the
      guard catches its typo, and widening a published method's argument is a change of its own;
      nothing here needs it. Out of scope, below.
- [x] **Split.** Phase 1 is its own plan,
      [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md): about an hour, additive,
      useful without ask A, and closable by itself. This plan keeps ask A and is frozen after 0636
      ships, so it builds against the exports as published.

## Phases

1. **The holding predicates, public:** moved to
   [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md) (Phase 0).
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
- [ ] The example under `examples/md/`, the conditional and the strict rule reading one `const`,
      with `clean/` and `violating-<x>/` folders, and the docs' note that an absence spelling needs
      a guard.
- [ ] The docs and README lines, [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)'s
      cross-reference, and the `@nielspeter/eess-md` changeset.
- [ ] The sabotage matrix over the Test inventory's mutants, recorded here.

## Acceptance

- **The conditional rule** (the adopter's): over documents in scope, one with no group section is
  not selected; one whose only group section links records but cites no code is red at that
  section's line; one with two qualifying sections, or one qualifying and one link-only, is green; a
  misspelt `G` is red with the zero-examined finding; `examined` counts the documents that have a
  group section.
- **The strict rule:** the same, except that a document in scope with no group section is red at
  line 1 ("missing section", with the near miss where `headingNotes` gives one), a misspelt `G` reds
  every document in scope, and `examined` counts every document in scope.

## Files changed

- Phase 1: [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md)'s.
- Phase 2: `packages/md/src/predicates/document.ts`, `packages/md/src/conditions/structure.ts`,
  `packages/md/src/builders/docs.ts`, `packages/md/tests/`, `examples/md/`, `docs/markdown.md`,
  `packages/md/README.md`, `.changeset/` (`@nielspeter/eess-md` minor).

## Test inventory

- Phase 1: [plan 0636](./completed/0636-md-the-section-holding-predicates-public.md)'s. Its mutant 1 is
  the review's mutant 5, red there on a test of the export itself.
- Phase 2, each red under its own sabotage (the review's list, with 5 run again against the option
  and 7 and 8 restated on the build review, 2026-11-07):
  1. only the first group section tested (a record with one qualifying and one link-only section
     reds: a false red);
  2. every section required instead of any;
  3. undecided treated as false;
  4. the name not recorded, run on the direct name-argument form;
  5. the option reading the wrong holding kind (`sectionsWithCodePointer()` passed, a link
     accepted): a false green, now through the option;
  6. the condition form over a dead scope;
  7. a misspelt `const G` leaving the conditional rule green (its zero-examined finding removed);
  8. undecided treated as true, or dropped: the fail-open direction
     ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). Mutants 3 and 8
     are driven through the public `sectionsWithLink()` over an unread
     `<a href=./a.md title=a/b>`, not a hand-built stand-in, and killed by asserting the site's
     finding at its own line with `bypassFilters`.
- Each remedy a finding names, applied by a test that shows the finding clears.

## Out of scope

- An "at least one" cardinality on `correspondence()`: its join stays one-to-one.
- Whether the cited code exists: a second rule, `pointers(c)…resolve()`.
- The general fix for a name inside a kernel combinator:
  [bug 0512](../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md).
- Accepting several names in `haveSection` natively (Phase 0): a `RegExp` names a group.
- A container-member form for eess-ts or eess-mermaid: this word becomes the family precedent, and
  nothing is built for it here.
