# Plan 0582: a document has a section that satisfies a predicate

## Status

- **State:** Done — built 2026-11-07 on `plan/0582-have-section-satisfying`: frozen in 866a6600
  against `main` 971e9d5f (after [plan 0636](./0636-md-the-section-holding-predicates-public.md),
  PR #323), built in e039dd9a, ledger and matrix in 09186f76, the build review's fixes (product,
  enforcement, method) in 5f22c715 and after. Its code pointers are as at 971e9d5f. The build review
  changed one frozen decision, the condition's finding (one per document, not one per section,
  below), and found two mutants the frozen inventory had not named (10 and 11 below)
- **Implements:** [proposal 026](../../proposals/promoted/026-md-a-document-has-a-section-that-satisfies-a-predicate.md)
- **Priority:** Medium. No false green, but "every record has at least one relation section that
  cites code" cannot be written without a hand step, and both forms an adopter reaches for red
  documents that satisfy it.
- **Effort:** Medium (the former Phase 2; the former Phase 1 is
  [plan 0636](./0636-md-the-section-holding-predicates-public.md)).
- **Created:** 2026-11-01
- **Decided on the review (2026-11-01) and in Phase 0 (2026-11-07), each overrulable:**
  - **The five section-holding predicate forms** (content, code block, list item, link, code
    pointer: `packages/md/src/model/section-holds.ts:15`) are exported first, by
    [plan 0636](./0636-md-the-section-holding-predicates-public.md) (Phase 0, below).
  - **Phase 2 is an option on `haveSection` / `predicateHaveSection`** that takes a section
    predicate (the review's layering (b)), not a new name-free lift. The group's name stays the
    argument the API records itself (`packages/md/src/predicates/document.ts:53`), never read
    through the predicate, so `and()` and `not()` cannot hide it.
  - **A condition form on `docs().should()`** ships with it: the only form with no `not()`, with
    per-document findings and with `examined` counting the documents in scope.
  - **The conditional rule is its own guard** in the condition form (Phase 0, corrected
    2026-11-07): `.that().haveSection(G).should().haveSection(G, { satisfying })` selects exactly
    what a guard would, and a misspelt `G` reds it with the kernel's zero-examined finding. The
    review's guard, as in [plan 0503](./0503-in-sections-boxes-by-section.md), is for an
    absence-rule spelling (`notExist()`), which is green over nothing; the docs say an absence
    spelling needs it.

- **At the freeze (2026-11-07), each overrulable:**
  - **The option** is `satisfying?: Predicate<MdSectionElement>` on the published
    `HaveSectionOptions` (`packages/md/src/model/sections.ts:29`), additive. `docs().haveSection()`
    dispatches both phases (`packages/md/src/builders/docs.ts:85`); the condition is
    `packages/md/src/conditions/structure.ts:16`, the predicate
    `packages/md/src/predicates/document.ts:53`.
  - **The description** with the option is `have a section "G"[ at depth N] satisfying "<p's
description>"`, so `sectionsWithCodePointer()` reads `… satisfying "hold a code pointer"`; the
    article carries "at least one". Without the option both descriptions stay byte-identical.
  - **The condition's findings**, per document: no section matches `G` is today's
    `missing section "G"` at line 1 with its notes, unchanged; sections match and none satisfies
    `p` is one finding per such section, at its heading's line, `section "<name>" does not satisfy
"<p's description>", and no section "G" in this document does`, its line cited with
    `citesHeadings` (_changed at the build review, 2026-11-07, on the product lens: one finding per
    document, keyed `relPath` as "missing section" is, at the first section of the name, naming
    every one, `no section "G" satisfies "<p's description>" (the sections at lines 3, 7)`, all lines
    cited, with a remedy that says renaming the heading only moves the document out of scope. One
    cause, one finding ([ADR-009](../../../adr/009-agent-first-failure-surfaces.md) rule 2); per section, a run could print more findings than
    documents examined, an agent could read N fixes for one, and `.excluding('<relPath>')` would
    waive "missing section" and not this_); sections match, none satisfies and some cannot be judged is only the causes,
    through the kernel's `undecidedViolations`, as `haveField` reports them
    (`packages/md/src/builders/field-findings.ts:54`), since the verdict depends on them.
  - **The predicate form** is strong Kleene over the sections matching `G`: selected when one
    satisfies `p`, undecided when none does and one cannot be judged, otherwise not. It declares
    `undecided` only when `p` does, and its `test()` refuses an undecided document
    (`refuseUndecided`), as `inSections`' does.
  - **One fold.** The strong Kleene "any" over sections in `inSections`
    (`packages/md/src/predicates/in-documents.ts:141-164`, written twice there) moves to one model
    helper, which `inSections` and the option both call.
  - **Section names** `p` reads are recorded for the section-name scan (`sectionDeclarationsOf`), as
    `inSections` records them; `G` is recorded as `haveSection` records it today, by the predicate
    always and by the condition with a depth.

## Problem

`inSections` already computes, per document, the strong-Kleene "some section satisfies p"
(`packages/md/src/predicates/in-documents.ts:159`), and publishes it only for scope diagnosis. No
public form lets a `docs()` rule say "has a section named G that satisfies p": `haveSection` selects
by name only, and the holding predicates behind `haveCodePointer()` and the rest are unexported
(`sectionsHolding`, `packages/md/src/predicates/section.ts:80`). The review measured the
proposal's own rule shape, `satisfy(not(<lift>(and(sectionsNamed(G), <holds>)))).should().notExist()`:
the inner `and()` hides the name
([bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)), the outer
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
- [x] **Mutants and the non-vacuity mechanism.** The mutants are the Test inventory's below.
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

   An example under `examples/md/` shows the conditional rule and its guard reading one `const`
   (_corrected 2026-11-07: the conditional and the strict rule, as Phase 0's first box records; the
   guard was dropped there and this line was missed at the freeze_),
   and `docs/markdown.md` and `packages/md/README.md` gain the "at least one section" line beside
   the every-section one. [Bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)
   gains a cross-reference to this workaround and keeps the general fix.

Phase 2's ledger:

- [x] The `satisfying` option on `haveSection` / `predicateHaveSection` and its condition form on
      `docs().should()`, with the absent-safe pin on the description and message (e039dd9a):
      `packages/md/src/model/section-any.ts` holds the one fold (`anyMembership`), which
      `inSections` now calls too; the md suite was 1,246 of 1,246 green after that refactor (12 s).
      `packages/md/tests/have-section-satisfying.test.ts` drives both rules, both phases, the
      predicate inside `satisfy()` and `not()`, the undecided paths and the name scan. _At build it
      held 15 tests, and the method lens found its claims overstated: the condition's description
      was not pinned, no `p` carried a section name, `inDocuments()` was claimed and not driven, and
      the undecided remedy was not applied. The review's fixes added each, and the enforcement lens's
      two missing break classes (a pointer under another heading; `depth` beside `satisfying`):
      20 tests now, 42 with `in-sections.test.ts`._
- [x] The example under `examples/md/`, `a-relations-section-cites-code.test.ts`, the conditional and
      the strict rule reading one `const`, with `clean/`, `violating-links-only/` and
      `violating-no-section/`, and the docs' note that an absence spelling needs a guard. Its swaps,
      run by hand as `check:nonvacuity` runs them (`EESS_EXAMPLE_SWAP`, about 2 s each): each
      `violating-<j>=clean` fails only its `violating-<j>:` test, each `clean=violating-<j>` fails
      the first `clean:` test and no `violating-*:` test.
- [x] The docs and README lines, [bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)'s
      cross-reference, and the `@nielspeter/eess-md` changeset (`md-have-section-satisfying.md`).
      `check:docs-code` compiles the new fence (117 fences).
- [x] The sabotage matrix, run 2026-11-07 on 5f22c715 (the build review's fixes) in a worktree with
      its own install (5 s) and build (7 s), one mutant at a time, md rebuilt after each (the
      example imports `dist`) and the kernel for its row: 58 s for the matrix. The restored tree red
      0 before and after; every mutant red:

      | mutant | option tests red | example tests red |
      | --- | --- | --- |
      | 1 only the first group section tested | 8 | 3 |
      | 2 every section required instead of any | 9 | 3 |
      | 3 undecided treated as false | 2 | 0 |
      | 4 the name not recorded (predicate form) | 1 | 0 |
      | 5 the option ignoring `p` (every matching section accepted) | 9 | 1 |
      | 6 and 7: one kernel edit, the zero-examined and dead-glob returns removed | 2 | 1 |
      | 8 undecided treated as true | 2 | 0 |
      | 9 the predicate's `test()` not refusing undecided (added at build) | 1 | 0 |
      | 10 a pointer anywhere credited (added at review) | 6 | 1 |
      | 11 `depth` dropped beside `satisfying` (added at review) | 1 | 0 |
      | 12 undecided causes dropped in the condition (added at review) | 1 | 0 |

      Mutant 5 is restated: it ignores `p`, the false green "a link accepted for a pointer" reaches,
      since the option passes `p` through and has no kind of its own. Mutants 6 and 7 are the
      kernel's: the dead scope and the misspelt `const` are caught by its zero-examined finding,
      which no md mutant can remove, so one kernel edit removes it, and the dead-glob return beside
      it, for both rows.

      _The first counted run (09186f76, on e039dd9a, 43 s) had rows 1 to 9 green-to-red as well;
      the review's enforcement lens then found mutants 10 and 11 surviving it, fully green on the
      suite and the example. Five runs were discarded in all, each for a fault of the harness, not
      the code: the kernel mutant did not compile (code after an early `return`); the md mutants
      read 0 on an example that imports a `dist` not rebuilt; the failed kernel build had still
      emitted a mutated `dist` (no tsconfig here sets `noEmitOnError`:
      [bug 0637](../../bugs/0637-a-failed-build-still-writes-dist.md)), so the restored tree read 2 red;
      mutant 11 did not compile (an unused parameter); and a mutant with two edits to one file was
      restored to its first edit. Each counted run started from a clean build._

- [x] The build review (2026-11-07, product, enforcement, method). Fixed from it, in 5f22c715 and
      after: one finding per document, with a remedy (product, Important); the two surviving
      mutants, pinned by a record citing code under another heading (in the tests and in the
      example's `violating-links-only` fixture) and a mixed-depth record (enforcement, Important);
      the four tests the method lens found claimed and missing; the builder method's JSDoc names
      the option; the docs say the name scan covers the option's predicate, that a pointer under
      another heading does not count, and that present is not live; the Phase 2 body's guard line,
      the mutant count and "Files changed" corrected; [bug 0637](../../bugs/0637-a-failed-build-still-writes-dist.md)
      recorded. Left as decided: the nested quotes in a composed description, `"are named "X" and
hold …"` (product: a family inconsistency with `inSections`' unquoted form, recorded here, not
      fixed), and a `RegExp` name rendered `"/^X$/"`, as "missing section" renders it.

Deferred: none. Found and recorded: [bug 0637](../../bugs/0637-a-failed-build-still-writes-dist.md).

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

- Phase 1: [plan 0636](./0636-md-the-section-holding-predicates-public.md)'s.
- Phase 2, as built: `packages/md/src/model/section-any.ts` (new), `packages/md/src/model/sections.ts`,
  `packages/md/src/predicates/document.ts`, `packages/md/src/predicates/in-documents.ts`,
  `packages/md/src/conditions/structure.ts`, `packages/md/src/builders/docs.ts` (its JSDoc, at the
  build review; the dispatch already existed), `packages/md/tests/have-section-satisfying.test.ts`,
  `examples/md/`, `docs/markdown.md`, `packages/md/README.md`, the
  [bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md)
  cross-reference, `.changeset/` (`@nielspeter/eess-md` minor).

## Test inventory

- Phase 1: [plan 0636](./0636-md-the-section-holding-predicates-public.md)'s. Its mutant 1 is
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
     ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). Mutants 3 and 8
     are driven through the public `sectionsWithLink()` over an unread
     `<a href=./a.md title=a/b>`, not a hand-built stand-in, and killed by asserting the site's
     finding at its own line with `bypassFilters`.

  Added at the build review (2026-11-07), each a break class the frozen list missed: 10. a pointer anywhere in the document credited, when a section of the name exists (the
  adopter's false green: the section only links, the code is cited under another heading); 11. `depth` dropped beside `satisfying`; 12. the condition dropping an undecided document's causes (mutant 8's "dropped" half).

- Each remedy a finding names, applied by a test that shows the finding clears.

## Out of scope

- An "at least one" cardinality on `correspondence()`: its join stays one-to-one.
- Whether the cited code exists: a second rule, `pointers(c)…resolve()`.
- The general fix for a name inside a kernel combinator:
  [bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md).
- Accepting several names in `haveSection` natively (Phase 0): a `RegExp` names a group.
- A container-member form for eess-ts or eess-mermaid: this word becomes the family precedent, and
  nothing is built for it here.
