# ADR-021: A predicate that cannot judge a subject says so

- **Status:** Accepted (2026-10-18)
- **Extends:** [ADR-009](./009-agent-first-failure-surfaces.md) · [ADR-014](./014-the-emitter-refuses-a-verdict-without-evidence.md)
- **Context:** [plan 0470](../work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md),
  [spike 0485](../work/spikes/0485-what-a-predicate-that-cannot-judge-does-to-a-rule.md),
  [plan 0469](../work/plans/completed/0469-havefield-a-document-has-a-value.md)
- **Supersedes nothing.**

## The question

Every predicate in the family answers `true` or `false`. Some cannot always answer. eess-md's
`haveField` reads a labelled value, and a document can give it twice, give it empty, or give it in a
form the rule does not read; the value cannot be told. Answering `false` for such a document drops it
from the rule's subjects, and the build says nothing. That is [ADR-009](./009-agent-first-failure-surfaces.md)'s silent drop, made inside a
selector.

[Plan 0469](../work/plans/completed/0469-havefield-a-document-has-a-value.md) kept the finding by keying it on the predicate's identity inside one builder. The spike
measured where that fails: inside every `not()`/`and()`/`or()`, which build new objects; through
`.select()`, which hands back elements and nothing else; in eess-ts's own builder and combinators;
through a hand-written wrapper around `test`; and in eess-md's `inScope` and `fields()` scans. The
question is whether a predicate may say "I cannot judge this subject", and what every part of the
family must do when it does.

## Decision

**A predicate may declare that it cannot judge a subject. Its subject is then neither selected nor
dropped silently: every application of a rule's predicates either reports it or refuses to run.**

1. **The member.** `Predicate<T>` gains an optional method, `undecided?(this: void, element: T):
readonly Undecided[]`. A non-empty result means the predicate cannot judge that element, and says
   why: each `Undecided` carries a file, a line, an element and a message. It takes no rule context,
   so a producer can memoize it per subject; the builder makes the finding. It is method syntax, as
   `test` is, so `Predicate<T>` stays bivariant; a function-typed property would make it invariant
   and break every builder that widens its predicates.
2. **Membership is strong Kleene, from one truth table.** One kernel function evaluates predicates
   for a subject in three values. `and` is false when any input is decided false, otherwise unknown
   when any is unknown; `or` is true when any input is decided true, otherwise unknown when any is
   unknown; `not` keeps unknown unknown. Every combinator in the family takes its `undecided` from
   that table, and its `test` either from the table or, for `not`, by refusing an unknown input, so
   selection and reporting cannot disagree.
3. **Only a definitely-selected subject reaches the rule's conditions and `examined`** ([ADR-010](./010-a-pass-is-constructed-from-evidence.md)). An
   undecided subject is represented by its causes. A finding about what the rule's own instrument
   could not read (a box mark no rule declared, a label in a form the rule does not read) still
   reaches a subject whose membership is undecided: there the undecided case is in scope, fail-closed.
4. **A cause is reported where the verdict depends on it, and only there.** A subject another input
   decides (a folder that excludes it, an `or` branch that is true) is decided, and its unreadable
   value is not this rule's finding. A value that resolved is decided even beside a cause about the
   document (prose that disagrees, a label in another form): the verdict does not depend on it. A
   rule that wants every value readable and consistent asserts it in condition position.
5. **The finding is unsuppressable, one per cause per rule.** It is about the instrument, not about
   the subject's content, as with [ADR-016](./016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s exhausted walk and [plan 0454](../work/plans/completed/0454-box-marks-are-the-callers.md)'s unread box, so it carries
   `bypassFilters`: `.excluding()`, `.warn()`, an exclusion comment, a baseline and diff-aware mode do
   not remove it (only removing the rule does). It is one finding per cause **within a rule**, however
   many subjects share it ([ADR-009](./009-agent-first-failure-surfaces.md) rule 4), and deliberately not one per cause across rules, which
   is where it departs from [ADR-016](./016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 3: whether a verdict depends on a cause is decided per rule,
   so each rule that depends on it says so.
6. **A door that hands no findings back refuses.** `matchingElements`, `.select()`, and a predicate's
   `test` called on a subject its `undecided` reports each throw an `ArchConfigError` naming the door
   and the first cause. That is [ADR-014](./014-the-emitter-refuses-a-verdict-without-evidence.md)'s rule for a door that hands nothing back. `.select()` is
   usually called while a rule file loads, so its refusal stops that file, not one rule: it fails
   closed, naming the first of the causes. Carrying the findings through a selection instead is
   reopened when a consumer needs a side of `correspondence()` filtered by a predicate that can be
   undecided. **A producer's contract:** a predicate that declares `undecided` must not answer from
   `test` on a subject it reports; the family's own producers refuse there.
7. **A rule that reports undecided subjects is never green on them,** even when nothing was selected:
   the findings are made before the empty-selection return, and no generic zero-examined finding or
   declared emptiness is added beside them. The channel only adds findings; it never removes an
   element or a violation.

## Why this, and not the alternatives

- **A dialect registry keyed on identity** (the spike's candidate A, and [plan 0469](../work/plans/completed/0469-havefield-a-document-has-a-value.md)'s mechanism) is
  lost inside every combinator, because the combinators are kernel code. A dialect cannot reach them.
- **Report every unreadable subject the rule read** (scope (a)) fails closed but reports what the
  rule's verdict does not depend on. Of the records each adopter's field rules do not target, 54, 89
  and 14 have an unreadable Status. Each one an adopter excludes by hand is a place a later real
  defect hides.
- **A suppressible finding,** as revision 1's architecture review argued ("correct for a data
  defect"), is overruled: the finding says the rule could not judge, and a rule that is told to stop
  saying so judges nothing about that subject. Records a rule does not depend on are already out of
  it by clause 4, which is what made suppression look necessary.
- **A findings field on `Selection`.** No adopter binds a field-filtered set through
  `correspondence()`, and a reader of `.elements` would still drop silently. Refusing closes the door
  with no new public member (clause 6 says when it reopens).
- **Refuse the lift altogether** (candidate C). It is fail-closed, but it makes "done records hold no
  open box" two rules, and it is the rule all three adopters want.

## Consequences

- `@nielspeter/eess` gains a root-API member and `Undecided`, an additive change: no existing
  predicate declares the member, so no existing rule changes. The evaluation helpers are `/internal`.
- eess-ts's builders do not report undecided subjects themselves; they refuse them through
  `matchingElements`. That is the floor clause 6 allows.
- The one door left is a raw predicate whose `test` answers on a subject its `undecided` reports,
  wrapped by hand in a raw `{ test }`: the kernel never sees the member. Clause 6's producer contract
  is the mechanism, and it is a requirement on producers, not a check.

## Enforcement

Built by [plan 0486](../work/plans/completed/0486-a-predicate-that-cannot-judge-says-so.md). The
tests are `packages/core/tests/undecided.test.ts` (kernel), `packages/md/tests/builders/have-field-undecided.test.ts`
(eess-md, with a lift onto boxes built in the test, as [plan 0457](../work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md)'s `inDocuments` will forward
`undecided`) and `packages/ts/tests/core/a-predicate-that-cannot-judge-is-refused.test.ts` (eess-ts).
Each sabotage named below is a row of [plan 0486](../work/plans/completed/0486-a-predicate-that-cannot-judge-says-so.md)'s matrix, red on the test it guards. The kernel and
eess-md titles are not cited by `it('…')`, since `check:crossval` resolves eess-ts's tests only
([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)).

> **Correction, 2026-10-19 ([plan 0457](../work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md), PR #245).** The eess-md test no longer builds its own lift: it
> drives the shipped `inDocuments`, and plan
> [0457](../work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md)'s
> sabotage matrix rows 13 to 16 now prove the forwarding of `undecided` that [plan 0486](../work/plans/completed/0486-a-predicate-that-cannot-judge-says-so.md)'s rows proved
> over the test-local lift. The paragraph above is kept as written.

| Clause                                                                                                                             | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Status |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **1** — The member is optional, method syntax with `this: void`, and takes the element only                                        | 1    | `tsc` over `packages/core/src/predicate.ts` and eess-ts's build, which widens predicates; a type-level test in `packages/core/tests/undecided.test.ts` pins the parameter list and the return type                                                                                                                                                                                                                                                        | gated  |
| **2** — One truth table; `not`'s `test` refuses an unknown input                                                                   | 2    | Kernel and eess-ts tests of `not`/`and`/`or` over decided-false, decided-true and unknown inputs, through `packages/core/src/combinators.ts` and `packages/ts/src/core/combinators.ts`, including `not` over a predicate whose `test` does not refuse; sabotage: a combinator stops forwarding, and `not`'s `test` goes back to negating                                                                                                                  | gated  |
| **3** — Only a definitely-selected subject reaches conditions and `examined`; instrument findings still reach an undecided subject | 2    | A `not()` rule over a document with three boxes reports the cause once, no box, `examined` decided-only; a document whose only box is unread reports the cause and the unread-box finding; sabotage: membership by `test` alone, and `inScope` back to two values                                                                                                                                                                                         | gated  |
| **4** — Reported only where the verdict depends on it; a resolved value is decided                                                 | 2    | `and(folder, p)` with the subject outside the folder and `or(decided-true, p)` report nothing; a resolved value beside disagreeing prose is selected, and one outside `oneOf` beside a label in another form is decided false; sabotage: the short-circuit removed, and deciding on `has` rather than on `resolved`                                                                                                                                       | gated  |
| **5** — Unsuppressable, one per cause per rule                                                                                     | 2    | `.excluding()` naming the cause leaves it reported; `.warn()` fails; the finding carries the unsuppressable sentence; one cause over three boxes is one finding; baseline and diff-aware mode refuse it through `bypassFilters`, inherited from every such finding (`packages/ts/tests/core/unsuppressable-sentence.test.ts`); no test runs them on this finding                                                                                          | gated  |
| **6** — A door that hands no findings back refuses; producers' `test` refuses                                                      | 2    | `.select()` throws naming `select()` and the cause, in the kernel and in eess-ts with a remedy true there; an eess-ts rule throws; `fields()` and `inScope` report rather than throw; `haveField`'s `test` throws on its own undecided subject; sabotage: `matchingElements` filters by `test`, `selectMatching` filters by `test`, eess-ts's `select()` takes the kernel's door, and `haveField`'s `test` stops refusing, each red on the test it guards | gated  |
| **7** — Never green on undecided subjects, even when nothing was selected                                                          | 2    | `packages/core/tests/undecided.test.ts`: every subject undecided reports each cause, no generic zero-examined finding and no declared emptiness, for a condition and for `.notExist()` (sabotages 9 and 16); `scripts/check-nonvacuity.mjs` rows `corpus/closed-records-sit-in-done-folders` and `corpus/closed-records-undecided` plant a live record under this repository's selector-position rule and require the finding on its id                   | gated  |
| Rationale: why not a registry, scope (a), suppression, a carry or a refusal                                                        | 5    | Context; the measurements are in the spike                                                                                                                                                                                                                                                                                                                                                                                                                | n/a    |
