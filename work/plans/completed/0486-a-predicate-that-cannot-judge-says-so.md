# Plan 0486: a predicate that cannot judge a subject says so

## Status

- **State:** Done — built 2026-10-18 from [spike 0485](../../spikes/0485-what-a-predicate-that-cannot-judge-does-to-a-rule.md),
  whose decision is [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md),
  revised after PR #243's review of the prototype's second revision. ADR-021's seven rows are
  `gated`.
- **Implements:** proposal 017
- **Priority:** Medium. Block 12's example, "documents whose Status is done hold no open box", needs
  it, through plan 0457's `inDocuments`. All three adopters want a version of that rule.
- **Effort:** Medium. The prototype's second revision touched 13 source files and 3 test files; the
  build adds the review's answers, the tests, the gate rows and the changesets.
- **Created:** 2026-10-18
- **Builds after:** [plan 0469](./0469-havefield-a-document-has-a-value.md), and before
  [plan 0457](../0457-a-rule-limited-to-the-documents-the-caller-chooses.md), whose `inDocuments`
  forwards the member this plan adds.

## Problem

Spike 0485 measured the doors through which a subject a predicate cannot judge is dropped without a
word: the kernel's and eess-ts's combinators, `.select()`, eess-ts's builders, a hand wrapper around
`test`, and eess-md's `inScope` and `fields()` scans. ADR-021 decides the fix: an optional
`Predicate.undecided`, strong Kleene membership from one truth table, one unsuppressable finding per
cause within a rule, and every application of a rule's predicates either reporting or refusing.
This plan builds it.

## Design

```ts
// packages/core/src/predicate.ts (root)
export interface Undecided {
  readonly file: string
  readonly line: number
  readonly element: string
  readonly message: string
}
export interface Predicate<T> {
  // …
  undecided?(this: void, element: T): readonly Undecided[]
}

// packages/core/src/undecided.ts (/internal)
export type Membership = boolean | readonly Undecided[]
export function membership<T>(ps: readonly Predicate<T>[], op: 'all' | 'any', e: T): Membership
export function partition<T>(
  elements: readonly T[],
  ps: readonly Predicate<T>[],
): { readonly elements: T[]; readonly undecided: readonly Undecided[] }
export function kleene<T>(
  ps: readonly Predicate<T>[],
  op: 'all' | 'any',
): Required<Pick<Predicate<T>, 'test' | 'undecided'>>
export function negatedTest<T>(input: Predicate<T>): (element: T) => boolean
export function undecidedViolations(
  u: readonly Undecided[],
  ctx: ConditionContext,
  already?: readonly ArchViolation[],
): ArchViolation[]
export function refuseUndecided(u: readonly Undecided[], door: string): void
```

### Every application of a rule's predicates

Every call site that applies a rule's predicates either partitions and reports, or refuses (ADR-021
clause 6). The sites, from `grep -rn "matchingElements(" packages/*/src`:

| site                                                                                                    | hands findings back? | does                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------- |
| kernel `RuleBuilder.collectViolations`                                                                  | yes                  | partitions, reports                                            |
| kernel `selectMatching` (`.select()`)                                                                   | no                   | refuses, naming `select()`                                     |
| kernel `matchingElements`                                                                               | no                   | refuses, naming its caller's door                              |
| eess-ts `RuleBuilder` (`packages/ts/src/core/rule-builder.ts`), `CallRuleBuilder`, `GraphqlRuleBuilder` | no                   | refuse, through `matchingElements`                             |
| eess-md `inScope` (`box-mark-findings.ts`)                                                              | yes                  | three-valued; an undecided box is reached, its causes reported |
| eess-md `unnamedFormFindings` (`field-findings.ts`)                                                     | yes                  | three-valued, as `inScope`                                     |

### Phase 1: the kernel

- `Undecided` and the member, documented with the producer's contract (ADR-021 clause 6).
- `undecided.ts`. `partition` keeps the two-valued path when no predicate declares the member.
  `kleene` remembers its last element, so a nested combinator is evaluated once per level rather
  than 2^depth times (PR #243's review measured 8 to 424 leaf calls from depth 1 to 6 without it).
  The finding carries the rule's context, `bypassFilters`, and a suggestion that ends with
  `UNSUPPRESSABLE`.
- `not` forwards `undecided` and takes `negatedTest`; `and`/`or` take `kleene` when an input
  declares the member.
- `matchingElements` takes the door's name from its caller and refuses; `selectMatching` refuses as
  `select()`.
- `RuleBuilder.collectViolations` partitions once and reports the causes before the empty-selection
  return, beside the assertion-less finding, and after the conditions (deduplicated against them).
  The receipt carries `undecided`, the number of causes, and the terminal then adds no generic
  zero-examined finding and claims no declared emptiness.

### Phase 2: eess-ts

- `packages/ts/src/core/combinators.ts`: the predicate branch of `not`/`and`/`or` forwards the member
  through `negatedTest` and `kleene`.
- eess-ts's builders refuse through `matchingElements`. Honouring the member in eess-ts's own
  `collectViolations` is dropped on purpose until an eess-ts predicate declares it (ADR-021's
  Consequences).

### Phase 3: eess-md

- `haveFieldPredicate` declares `undecided` when the value cannot be read, and only then: a value
  that resolved is decided (ADR-021 clause 4). Its `test` refuses an undecided document. The verdict
  is memoized per document in a `WeakMap` closed over by the predicate instance. Measure the spike's
  cost case again after the memo.
- Export `haveField` as a free predicate from the root, and re-export `Undecided` (`check:family`).
- Delete `DocsRuleBuilder`'s identity-keyed override (plan 0469).
- `inScope` and `unnamedFormFindings` read `membership`: an undecided candidate is reached, and its
  causes are reported once, deduplicated against the rule's own result.
- Plan 0469's tests change where ADR-021 changes the behaviour: three `.select()` calls over an
  undecided document (a conflict, an empty value, a register read without the header region) now
  refuse. A value that resolved beside disagreeing prose stays selected (ADR-021 clause 4), as it
  was in plan 0469. Each changed assertion says why.
- Fold the change into the pending `md-have-field` changeset (`haveField` is unreleased).

### Phase 4: dogfood, the gates, the release notes

- **Dogfood.** A `check:corpus` rule, `corpus/closed-records-sit-in-done-folders`, that uses
  `haveField` in selector position: no plan or bug record whose State is a closing word sits outside
  its lane's done folders (`notExist()`). This repository already believes it (`check:ledger`'s
  close ritual moves a record when it closes); "done records hold no open box" is not the claim,
  since a done record may keep a box with a disposition token. The rule never goes through
  `.select()`, so an undecided record is a finding on this rule's id, not an import crash. The
  `check:corpus` summary prints the number of undecided causes. A record whose State is a word
  outside the vocabulary is decided false here; `corpus/state-in-vocabulary-<lane>` reports it.
- **`check:nonvacuity`.** Plant a live record with two State lines; the gate must red with the
  cause on that rule's id.
- **The vacuity matrix** covers the new `/internal` exports.
- **Changesets:** the kernel minor (a root member and type, additive), eess-ts minor (a new
  refusal), eess-md folded into its pending changeset, and the dependents the kernel's changeset
  must name.
- ADR-021's rows move from `pending` to `gated` as each test lands.

## Test inventory

Kernel (`packages/core/tests/undecided.test.ts`):

- `and()`, `or()`, `not()` over decided-false, decided-true and unknown inputs; no member on a
  combinator over inputs that cannot be undecided; a combinator's `test` refuses, naming the cause.
- `not()` over a third-party predicate whose `test` does not refuse: `not(p).test` refuses, and a
  hand wrapper around it in a rule refuses.
- A rule over an undecided subject: the cause once, `bypassFilters`, only decided subjects
  selected, `examined` decided-only.
- `and(folder, p)` with the subject outside and `or(true, p)`: nothing reported.
- One cause shared by two subjects is one finding.
- Every subject undecided: the cause, no generic zero-examined finding, no declared emptiness; and
  the same for an absence rule.
- `.excluding()` naming the cause leaves it; `.warn()` fails; the suggestion names the remedy and
  `UNSUPPRESSABLE`.
- `matchingElements` and `.select()` refuse, `.select()` naming `select()`; eess-ts's refusal names
  its own door and a remedy true there.
- The suggestion names the cause's fix and `UNSUPPRESSABLE`, never the rule's own suggestion; two
  rules with ids each report the cause.
- A type-level test pins the member's parameter list.

eess-ts (`packages/ts/tests/core/a-predicate-that-cannot-judge-is-refused.test.ts`): `not()` carries
the member and the builder refuses; `or()` with a true branch decides; `and()` with a true branch
refuses.

eess-md (`packages/md/tests/builders/have-field-undecided.test.ts`), with a lift built in the test:

- Block 12 over boxes: each unreadable Status once, and a document whose only box is unread reports
  both findings.
- `not()` over a document with three boxes: the cause once, none of its boxes, `examined` 1.
- A document another input decides: nothing.
- `.select()` refuses, naming `select()`; a hand wrapper refuses; `.excluding()` cannot hide it.
- A resolved value beside disagreeing prose is decided and selected.
- `fields()` over an undecided document reports the cause and keeps its own finding.
- The memo returns the same causes for the same document.

Sabotage rows, each red on the test it guards:

1. The kernel's `not` stops forwarding `undecided`.
2. The kernel's `and`/`or` drop `kleene`.
3. eess-ts's `not` stops forwarding.
4. `not`'s `test` goes back to negating.
5. `membership` loses its short-circuit.
6. Membership by `test` alone in `partition`.
7. `matchingElements` filters by `test`.
   7b. `selectMatching` filters by `test`.
8. `haveField`'s `test` stops refusing.
9. The empty-selection return drops the causes.
10. `bypassFilters` removed.
11. `inScope` back to two values.
12. `unnamedFormFindings` back to `matchingElements`.
13. The memo keyed wrongly (returns another document's causes).
14. `kleene`'s one-element cache ignores the element (answers for the last one).
15. The finding inherits the rule's own suggestion.

## Out of scope

- **`inDocuments` (plan 0457).** It forwards the member; plan 0457 records what it owes.
- **Carrying findings through `Selection`.** Dropped on purpose; ADR-021 clause 6 says when it
  reopens.
- **eess-ts honouring the member in its own `collectViolations`.** Dropped on purpose; the floor is
  the refusal.
- **A kernel constructor that builds `test` and `undecided` from one three-valued function**, so a
  third party cannot write a `test` that does not refuse. It would close ADR-021's last door. Dropped
  on purpose until a third-party producer exists.
- **Two rules with the same description and no id** would share `dedupeConfigFindings`' key
  (`file`, `ruleId ?? rule`, `element`) and collapse under its "N rules" note. Rules with ids keep
  their findings apart, and a test pins that; the id-less case is dropped on purpose, since two
  rules with one description are already indistinguishable in every report.
- **Recorded from the review:** the "unused exclusion" warning for a refused exclusion
  ([bug 0487](../../bugs/0487-an-exclusion-refused-by-an-unsuppressable-finding-is-called-stale.md)),
  and `kind: 'configuration'` on a finding whose fix is in a record
  ([bug 0488](../../bugs/0488-a-finding-about-a-records-content-is-labelled-configuration.md)).
- **Bugs 0482, 0483, 0484**, recorded from plan 0469.

## Build notes

Where the build departed from the text above, each overrulable:

- **`refuseUndecided` takes a door with its remedy,** not just a name. The kernel's remedy ("use
  the rule's check(), warn() or violations(), which report it") is false in eess-ts, where those
  calls refuse too; eess-ts passes its own doors (`TS_RULE`, `TS_SELECT`,
  `packages/ts/src/core/undecided-door.ts`). `matchingElements` takes its door from the caller, with
  no default. The `.select()` door was missed in the first cut and caught by PR #244's enforcement
  review.
- **The finding never inherits the rule's suggestion.** The first cut took `context.suggestion`
  when set, which would have told an author to fix what the rule asserts rather than the cause. The
  suggestion is the cause's fix and `UNSUPPRESSABLE`.
- **A value that resolved is decided, allowed or not.** The first cut keyed on `has`, so a value
  outside `oneOf` beside a label in another form was undecided, an unsuppressable finding on a
  record the verdict does not depend on (PR #244's architecture review, reproduced). The verdict
  now carries `resolved`.
- **The receipt carries `undecided` through `violations()` and `check()`,** and `fields()` and
  `taskItems()` add their causes to it. The terminal leaves out only the generic zero-examined
  finding beside undecided causes; a dead glob, a selector fault or an unmet `.expectNonEmpty()`
  still stands.
- **De-duplication is only against unsuppressable findings,** so a suppressible finding with the
  same text cannot stand in for the cause; `fields()` drops its own unread-label finding when a cause
  says the same thing.
- **Plan 0469's selector no longer reports disagreeing prose beside a resolved value:** that value
  is decided (ADR-021 clause 4), and the condition form reports the prose. Plan 0469's test is
  renamed to say so.
- **The dogfood rule** is `corpus/closed-records-sit-in-done-folders` over both lanes, written as
  `or()` of `and()`s. It keeps its own receipt (the first cut borrowed `state-present`'s count,
  caught by three reviewers), and its summary line prints the live-record population beside it (`state-present`'s count, the
  same records: display only, not the receipt). Measured:
  0 closed of 221 live records, 0 undecided causes. Three non-vacuity rows, one per lane plus the
  undecided case; the plans lane had none in the first cut, and dropping it stayed green.
- **Red first:** the kernel tests were written before the code. Measured again on the final file
  against the base (f888eef, the ruling's head): 21 of its 25 tests fail. The 4 that pass pin
  behaviour that must not change (a combinator over inputs that cannot be undecided declares no
  `undecided`; a subject another input decides is not reported; `matchingElements` over decided
  subjects is unchanged) or are the type-level pin, which a run cannot fail.
- **Cost, measured after the memo** (2,000 records with 5 boxes each, three runs): the lifted rule
  takes 72–84 ms against 36–41 ms for the same rule with a text predicate, where the spike measured
  450 against 42 before the memo. With every tenth record undecided it reports those 200 causes.
- **Recorded, not done:** `kleene`'s one-slot cache keeps its last element reachable until the next
  replaces it (dropped on purpose: a predicate is pure, and the slot is per combinator); the
  `TS_RULE` door on `CallRuleBuilder.getMatchedCalls` and the GraphQL builders' selection is the
  same constant as the tested one, with no test of its own (dropped on purpose); `liveRecordIn`
  selects by path prefix, the pattern [bug 0484](../../bugs/0484-state-present-picks-records-by-a-path-prefix.md)
  records for `state-present`.

## Progress ledger

- [x] Phase 1: the kernel
- [x] Phase 2: eess-ts
- [x] Phase 3: eess-md (the cost case re-measured after the memo: see Build notes)
- [x] Phase 4: dogfood, non-vacuity, vacuity matrix, changesets, ADR-021 rows
- [x] Sabotage rows red on their named tests; durations reported (23 rows below)
- [ ] validation-owed: `npm run validate` green; duration reported (it runs after this record is
      written, at the PR's head; its result is recorded on the PR, and CI is the gate)
- [x] Close: this plan → `completed/`; boards

Deferred: none

**Sabotage matrix, 2026-10-18.** Every row but 7b and 14 ran together at fa68d93; rows 7b and 14,
whose anchors the review fixes moved, ran at fa68d93 after re-anchoring; rows 6, 9 and 16 ran again at
91dfebd after a change to `rule-builder.ts`. Row 20 as first written removed the guard that leaves
out the generic finding, which reds a different test than the one it named (its own output said so,
and PR #244's testing and method verifications caught the table claiming otherwise); it was
rewritten to the first cut's line, and it and row 23 ran at 0b7651e. The SHAs here are this branch's commits before
its rebase onto PR #243 and its squash merge; the package trees they ran on are the ones that
merge (fa68d93 and 91dfebd match their rebased 67f7d68 and e1cabf1, `git diff` empty under
`packages/`). Each row: baseline green, sabotage applied, its package
rebuilt, its named test run, the file restored by `git checkout`, tree clean after. The full run
took 54 s, its 21 rows 47 s and the baseline the rest. Rows 11 and 12 are type-correct mutants (an
earlier run's were not, and broke eess-md's type build).

| row | sabotage                                                                       | red      | named test in the failure                                                 | time |
| --- | ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------- | ---- |
| 1   | kernel `not` stops forwarding `undecided`                                      | core     | not(): unknown stays unknown                                              | 1.9s |
| 2   | kernel `and`/`or` drop `kleene`                                                | core     | and(): a decided false input decides false; otherwise unknown wins        | 2.0s |
| 3   | eess-ts `not` stops forwarding                                                 | ts       | not() carries undecided, and the builder refuses naming the cause         | 3.7s |
| 4   | `not`'s `test` back to negating                                                | core     | not()'s test refuses rather than negating a guess                         | 2.0s |
| 5   | `membership` loses its short-circuit                                           | core     | a subject another input decides is not reported                           | 2.0s |
| 6   | membership by `test` alone in `partition`                                      | core     | reports the cause once, unsuppressable, and selects only decided subjects | 2.0s |
| 7   | `matchingElements` filters by `test`                                           | core     | matchingElements throws, naming the first cause                           | 2.0s |
| 7b  | `selectMatching` filters by `test`                                             | core, md | select() throws, naming the first cause                                   | 2.7s |
| 8   | `haveField`'s `test` stops refusing                                            | md       | a hand wrapper around test() refuses, naming the cause                    | 2.2s |
| 9   | the empty-selection return drops the causes                                    | core     | a rule whose every subject is undecided reports the causes …              | 2.0s |
| 10  | `bypassFilters` removed                                                        | core     | the `[bypass]` assertions                                                 | 2.0s |
| 11  | `inScope` back to two values                                                   | md       | block 12                                                                  | 2.2s |
| 12  | `unnamedFormFindings` drops undecided candidates                               | md       | fields() over an undecided document reports the cause …                   | 2.2s |
| 13  | the memo answers with another document's verdict                               | md       | block 12                                                                  | 2.2s |
| 14  | `kleene`'s cache ignores the element                                           | core     | a subject another input decides is not reported                           | 2.0s |
| 15  | the finding inherits the rule's suggestion                                     | core     | … never the rule suggestion                                               | 2.0s |
| 16  | an absence rule claims declared emptiness beside causes                        | core     | an absence rule whose every subject is undecided is not green             | 2.0s |
| 17  | `haveField` decides on `has`, not on `resolved`                                | md       | a resolved value outside oneOf is decided false …                         | 2.2s |
| 18  | eess-ts `select()` takes the kernel's door                                     | ts       | select() refuses with a remedy that is true in eess-ts                    | 3.7s |
| 19  | `violations()` drops the undecided count                                       | core     | one cause shared by many subjects is one finding                          | 2.0s |
| 20  | the terminal drops a specific zero-examined finding too (the first cut's line) | core     | a more specific zero-examined finding still stands beside the causes      | 2.0s |
| 21  | `fields()` keeps its duplicate of a cause                                      | md       | fields() reports a cause once …                                           | 2.2s |
| 22  | `fields()` does not count its causes in the receipt                            | md       | fields() over an undecided document reports the cause …                   | 2.2s |
| 23  | de-duplication against every finding, not only unsuppressable ones             | core     | a condition finding with the same text does not stand in for the cause    | 2.0s |

The matrix script and its output are this session's scratch files, not kept in the repository: the
table is the record.
