# Spike 0485: what a predicate that cannot judge a subject does to a rule

Measured 2026-10-18 for [plan 0470](../plans/completed/0470-a-lifted-predicate-carries-its-findings.md),
after plan 0469 shipped `haveField` as a `docs()` method only. It ran as a throwaway prototype in a
scratch worktree, in two revisions, each reviewed. Nothing here is built. The ruling is recorded in
[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md), and the build is
[plan 0486](../plans/0486-a-predicate-that-cannot-judge-says-so.md).

## The question

`haveField` reports the causes that make a document's value unreadable, in either position, through
`docs()`'s `collectViolations` (plan 0469): a conflict, an empty value, a label in a form the rule
does not read, a value after a code fence that never closes, a value outside the header, and prose
that disagrees. Block 12's example, "documents whose Status is done hold no open box", needs the same
judgement one level down, through plan 0457's `inDocuments`:

```ts
taskItems(c)
  .that()
  .satisfy(inDocuments(haveField({ label: 'Status', forms: ['bold'], oneOf: /done/ })))
  .and()
  .areOpen()
  .should()
  .notExist()
```

Lifted as a bare `Predicate`, `haveField` would drop a document whose Status cannot be read, and its
boxes with it, without a word (ADR-009). The spike asks where that diagnosis lives, what `.select()`
and `correspondence()` do with it, and which public predicate `haveField` then exports.

## What the code does today (measured)

- **Plan 0469 keys its findings on predicate identity.** `DocsRuleBuilder.haveField()` records
  `{ spec, predicate }`; `collectViolations` reports a spec's causes for the documents the rule's
  other predicates keep (`packages/md/src/builders/docs.ts`).
- **The combinators build new objects** and forward one structured field, `globs`
  (`packages/core/src/combinators.ts`). Anything keyed on a predicate's identity, such as 0469's spec
  list or plan 0457's `SCOPES` registry, is lost inside `not()`/`and()`/`or()`, silently.
- **eess-ts has its own `not`/`and`/`or`** (`packages/ts/src/core/combinators.ts`) and its own
  `RuleBuilder` (`packages/ts/src/core/rule-builder.ts`, extending `TerminalBuilder`, not the
  kernel's `RuleBuilder`). Both apply predicates through the kernel's `matchingElements`.
- **`.select()` has no findings channel.** It returns `{ elements, label, identify }`, and callers
  read `.elements` directly: `correspondence()`, `packages/md/src/rules/ledger.ts`, and
  `packages/crossvalidate/src/md-ts.ts`.
- **eess-md applies predicates in more than one place:** the builders, and `inScope` in
  `packages/md/src/builders/box-mark-findings.ts`, which decides which unread boxes a rule reaches.

## The adopters' answers (measured in each repository, read-only)

The three adopters behind proposal 017 were each asked the same four questions.

|                                                                                               | adopter 1                    | adopter 2                  | adopter 3                   |
| --------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------- | --------------------------- |
| records                                                                                       | 360                          | 1,828                      | 312                         |
| unreadable Status                                                                             | 54                           | 97                         | 15                          |
| of those, outside the folders their field rules target                                        | 54                           | 89                         | 14                          |
| selects other elements by a field today                                                       | by folder; wants it by field | by folder                  | yes, two rules              |
| NOT / OR on a field                                                                           | both, within one field       | both, within one condition | OR in a gate, NOT in a view |
| binds a field-filtered set through `correspondence()`                                         | no                           | no                         | no                          |
| wants (a) report every unreadable subject, or (b) only where the rule's verdict depends on it | (b)                          | (b)                        | (b)                         |

Under (a), the three would see 54, 89 or more, and 15 findings respectively on records their rules do
not cover.

## Revision 1: a kernel field, three-valued for reporting

`Predicate<T>` gained an optional `undecided?(element, context)`. `not()`/`and()`/`or()` evaluated it
in strong Kleene logic: `and` is false if any input is decided false, otherwise unknown if any is
unknown; `or` is the dual. The kernel `RuleBuilder` reported the findings of every element whose
conjunction came out unknown, and `select()` attached a thunk that `correspondence()` reported.

- All 23 of plan 0469's `haveField` tests passed with the kernel mechanism replacing eess-md's
  identity-keyed override.
- On this repository's `work/` corpus of 447 documents, scope (a) yields 2 undecided documents, both
  proposals, and Kleene yields 0.
- A property-syntax member made `Predicate<T>` invariant and broke eess-ts's build, so the member
  uses method syntax, as `test` does.

Three reviewers (architect, enforcement, product) agreed on the kernel placement and on Kleene, and
found the channel fail-open everywhere it was not called:

- eess-ts's builder and combinators ignored it;
- `inScope` applied predicates two-valued, so a document whose only box is unread lost both its
  Status finding and its unread-box finding. The enforcement reviewer reproduced this;
- `.select().elements` read directly dropped undecided subjects;
- a hand wrapper, `satisfy({ test: d => done.test(d) })`, dropped them;
- `.excluding()` and `.warn()` could hide the finding;
- selection stayed two-valued, so under `not()` an undecided document's boxes were selected,
  asserted and counted in `examined`: one cause fanned out over K boxes.

## Revision 2: one owner, three-valued membership, loud by default

- **One owner.** A kernel `partition(elements, predicates)` evaluates every subject once, in strong
  Kleene, and returns the subjects that are definitely selected and the causes of those that are
  undecided. Both kernel combinators and eess-ts's combinators take their `test`/`undecided` pair from
  the same truth table.
- **Membership is definitely-true.** An undecided subject is not selected, is not counted in
  `examined`, and is represented by its findings alone.
- **A door that hands no findings back refuses.** `matchingElements` (and so `select()`, eess-ts's
  builder and every other caller of it), and a diagnosing predicate's own `test` called on a subject
  it cannot judge, throw an `ArchConfigError` naming the first cause.
- **The producer is context-free.** `undecided(element)` returns causes, `{ file, line, element,
message }`; the builder makes them findings with the rule's context, `bypassFilters: true`, one per
  cause.

Measured, each by a test in the prototype:

| door                                                        | revision 1                                             | revision 2                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| block 12, a conflicting Status                              | reported once                                          | reported once                                                   |
| a document whose only box is unread                         | both findings lost                                     | both reported                                                   |
| `not()` over a document with three boxes                    | three "should not exist" plus the cause                | the cause once; `examined` 1                                    |
| `or()` decided by the other branch                          | not reported                                           | not reported                                                    |
| `and()` with a folder that excludes the document            | not reported                                           | not reported                                                    |
| every subject undecided                                     | the cause                                              | the cause, plus the generic zero-examined finding (to be named) |
| `.select()`                                                 | carried to `correspondence()` only; `.elements` silent | throws, naming the cause                                        |
| `satisfy({ test: d => done.test(d) })`                      | silent                                                 | throws, naming the cause                                        |
| `.excluding('<the cause>')`                                 | hides it                                               | cannot hide it                                                  |
| an eess-ts rule with `not(<a predicate that cannot judge>)` | silent                                                 | throws                                                          |

- **Cost.** On a synthetic corpus of 2,000 records with 5 boxes each, the lifted rule takes 450 ms
  against 42 ms for the same rule with a plain text predicate, because each box recomputes its
  document's verdict several times. Both report the same 1,333 open boxes. The build memoizes the
  verdict per document and spec.
- **What revision 2 changes in plan 0469's tests:** five of 23 assertions move. Four `.select()`
  calls over an undecided document now throw where they dropped it, and an undecided document is no
  longer asserted against by the rule's condition. Each is the change the reviews asked for.
  `haveField` is unreleased, so this rides its pending changeset.

## Decision

Decided by the coordinator from ADR-009, ADR-010 and ADR-014 and the measurements above, as the
maintainer asked ("decide it yourself"). Overrulable. The binding part is
[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md):

1. **Revision 2's design.** It is a kernel member of `Predicate`, membership is strong Kleene with
   only definitely-true subjects selected, every undecided subject is one unsuppressable finding per
   cause, and every door that hands no findings back throws.
2. **Scope is (b), by construction.** A cause is reported only where the rule's membership of a
   subject depends on it. The adopters chose this unanimously, and Kleene is the only candidate that
   computes it inside a combinator.
3. **`.select()` refuses; it carries nothing.** No adopter binds a field-filtered set through
   `correspondence()`, and a throw needs no new public member on `Selection` and no amendment to
   ADR-014: it is ADR-014's own rule for a door that hands nothing back.
4. **The member is root API** (ADR-011), because it is a member of a root type. The evaluation
   helpers stay in `/internal`.
5. **`haveField` is exported as a free predicate** beside `docs().haveField()`. It declares
   `undecided` for every unreadable cause.
6. **Plan 0457's `inDocuments` forwards `undecided`.** Candidate C's interim refusal is not needed
   if 0486 lands first; if 0457 lands first, it refuses a predicate that declares the member.

Candidate A, an eess-md registry keyed on identity, is rejected. It fails open inside every
combinator, and the reviews showed the same is true of every door that does not consult it.

## Deferred

- **Carrying findings through `Selection`**, for a `correspondence()` side that should report rather
  than throw. There is no consumer. → [plan 0486](../plans/0486-a-predicate-that-cannot-judge-says-so.md)'s Out of scope.
- **Plan 0457's `SCOPES` registry** has the same combinator blindness. It is recorded for 0457's own
  review, not changed here.
- **A second producer.** The undecided heritage walk of bugs 0373/0375/0383 (ADR-017) is the natural
  second user. It is not built here.
