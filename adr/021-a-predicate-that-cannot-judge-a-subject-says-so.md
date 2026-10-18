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
from the rule's subjects, and the build says nothing. That is ADR-009's silent drop, made inside a
selector.

Plan 0469 kept the finding by keying it on the predicate's identity inside one builder. The spike
measured where that fails: inside every `not()`/`and()`/`or()`, which build new objects; through
`.select()`, which hands back elements and nothing else; in eess-ts's own builder and combinators;
through a hand-written wrapper around `test`; and inside eess-md's own `inScope`. The question is
whether a predicate may say "I cannot judge this subject", and what every part of the family must do
when it does.

## Decision

**A predicate may declare that it cannot judge a subject. Its subject is then neither selected nor
dropped silently: it is a finding, and every door either reports it or refuses to run.**

1. **The member.** `Predicate<T>` gains an optional method, `undecided?(element: T): readonly
Undecided[]`. A non-empty result means the predicate cannot judge that element, and says why: each
   `Undecided` carries a file, a line, an element and a message. The method takes no rule context, so
   a producer can memoize it per subject; the builder makes the finding. It is method syntax, as
   `test` is, so `Predicate<T>` stays bivariant. That is deliberate: a property would make it
   invariant and break every builder that widens its predicates.
2. **Membership is strong Kleene, decided once.** One kernel function evaluates a rule's predicates
   for a subject in three values. `and` is false when any input is decided false, otherwise unknown
   when any is unknown. `or` is true when any input is decided true, otherwise unknown when any is
   unknown. `not` keeps unknown unknown. Every combinator in the family takes its `test` and
   `undecided` from that one truth table, so selection and reporting cannot disagree.
3. **Only a definitely-selected subject is selected.** An undecided subject is not passed to the
   rule's conditions and not counted in `examined` (ADR-010). Its causes represent it.
4. **A cause is reported where the verdict depends on it, and only there.** A subject that another
   input decides (a folder that excludes it, or an `or` branch that is true) is decided, and its
   unreadable value is not this rule's finding. A rule that wants every value readable asserts it in
   condition position.
5. **The finding is unsuppressable and appears once per cause.** It is about the instrument, not
   about the subject's content, as with ADR-016's exhausted walk and plan 0454's unread box. So it
   carries `bypassFilters`, and no `.excluding()`, `.warn()`, baseline or diff-aware mode removes it.
   Within a rule, one cause is one finding however many subjects it affects (ADR-009 rule 4).
6. **A door that hands no findings back refuses.** `matchingElements`, `.select()`, and a diagnosing
   predicate's own `test` called on a subject it cannot judge each throw an `ArchConfigError` naming
   the first cause. That is ADR-014's existing rule ("throws on every door that hands nothing back"),
   applied to a door it did not yet reach.
7. **A rule that reports undecided subjects is never green on them.** That holds even when nothing was
   selected: the findings are made before the empty-selection return. The channel can only add
   findings, never remove an element or a violation.

## Why this, and not the alternatives

- **A dialect registry keyed on identity** (the spike's candidate A, and plan 0469's mechanism) is
  lost inside every combinator, because the combinators are kernel code. A dialect cannot reach them.
- **Report every unreadable subject the rule read** (scope (a)) fails closed but reports what the
  rule's verdict does not depend on. The three adopters measured 54, 89 and 14 such records in their
  frozen folders. Each one an adopter excludes by hand is a place a later real defect hides.
- **Report through a findings field on `Selection`.** No adopter binds a field-filtered set through
  `correspondence()`, and a reader of `.elements` would still drop silently. Refusing closes the door
  with no new public member. Carrying can be added when a consumer asks.
- **Refuse the lift altogether** (candidate C). It is fail-closed, but it makes "done records hold no
  open box" two rules, and it is the rule all three adopters want.

## Consequences

- `@nielspeter/eess` gains a root-API member and `Undecided`, a minor and additive change: no
  existing predicate declares the member, so no existing rule changes. The evaluation helpers live in
  `/internal`.
- eess-ts's `not`/`and`/`or` forward the member from the kernel's truth table. eess-ts's builders
  refuse an undecided subject through `matchingElements`. That is the floor; honouring it in
  eess-ts's own `collectViolations` can follow when an eess-ts predicate declares the member.
- eess-md's `haveField` declares the member for every unreadable cause and is exported as a free
  predicate. Plan 0469's identity-keyed override is deleted.
- A third-party predicate that declares the member and whose `test` does not refuse an undecided
  subject can still be wrapped silently by hand. The kernel cannot reach a raw object. The member's
  documentation states the contract, and the family's own producers keep it.

## Enforcement

The build is [plan 0486](../work/plans/0486-a-predicate-that-cannot-judge-says-so.md), so every
row is `pending` until it lands. Each row names the test or gate the build owes.

| Clause                                                                                | Tier | Mechanism                                                                                                                                                                                                                                                                     | Status  |
| ------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **1** — The member is optional, method syntax, context-free                           | 1    | `tsc` over `packages/core/src/predicate.ts`, and eess-ts's build, which widens predicates and broke on a property member in the spike                                                                                                                                         | pending |
| **2** — One truth table for every combinator in the family                            | 2    | Kernel and eess-ts combinator tests over `not`/`and`/`or` with a decided-false, a decided-true and an unknown input, each through `packages/core/src/combinators.ts` and `packages/ts/src/core/combinators.ts`; sabotage: either combinator stops forwarding, and a test reds | pending |
| **3** — Only a definitely-selected subject is selected; `examined` excludes undecided | 2    | A `not(haveField)` rule over a document with three boxes reports the cause once, no box, and `examined` counts only decided subjects; sabotage: membership by `test` alone, and the test reds                                                                                 | pending |
| **4** — A cause is reported only where the verdict depends on it                      | 2    | `and(folder, haveField)` with the document outside the folder, and `or(haveField, decided-true)`, report nothing; sabotage: the short-circuit removed, and both red                                                                                                           | pending |
| **5** — Unsuppressable, once per cause                                                | 2    | `.excluding()` naming the cause leaves it reported; `.warn()` with an undecided subject exits non-zero; the block-12 rule over three boxes of one document reports one finding                                                                                                | pending |
| **6** — A door that hands no findings back refuses                                    | 2    | `.select()` over an undecided subject throws naming the cause; a hand wrapper around `test` throws; an eess-ts rule with `not(<a predicate that cannot judge>)` throws; sabotage: `matchingElements` filters by `test`, and all three red                                     | pending |
| **7** — Never green on undecided subjects, even when nothing was selected             | 2    | A rule whose every subject is undecided reports each cause; a `check:nonvacuity` fixture plants a live record with two State lines under this repository's own lifted rule and requires the cause by its rule id                                                              | pending |
| Rationale: why not a registry, scope (a), a carry or a refusal                        | 5    | Context; the measurements are in the spike                                                                                                                                                                                                                                    | n/a     |
