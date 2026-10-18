# Plan 0486: a predicate that cannot judge a subject says so

## Status

- **State:** Draft — filed 2026-10-18 from [spike 0485](../spikes/0485-what-a-predicate-that-cannot-judge-does-to-a-rule.md),
  whose decision is [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md).
- **Implements:** proposal 017
- **Priority:** Medium. Block 12's example, "documents whose Status is done hold no open box", needs
  it. So do all three adopters' versions of that rule and the rebuild of `honestyAtClose` from
  public blocks.
- **Effort:** Medium. The prototype touched nine files; the build adds eess-ts's combinators,
  memoization, the zero-examined message, the tests and the gate rows.
- **Created:** 2026-10-18
- **Builds after:** [plan 0469](./completed/0469-havefield-a-document-has-a-value.md). It lands
  before or after plan 0457 (`inDocuments`), whichever is first (see Out of scope).

## Problem

Spike 0485 measured six doors through which a subject a predicate cannot judge is dropped without a
word: the kernel's and eess-ts's combinators, `.select()`, eess-ts's builders, a hand wrapper around
`test`, and eess-md's `inScope`. ADR-021 decides the fix: an optional `Predicate.undecided`, strong
Kleene membership decided in one place, one unsuppressable finding per cause, and a refusal on every
door that hands no findings back. This plan builds it.

## Design

The prototype's second revision is the reference (spike 0485). Code shape:

```ts
// packages/core/src/predicate.ts
export interface Undecided {
  readonly file: string
  readonly line: number
  readonly element: string
  readonly message: string
}
export interface Predicate<T> {
  // …
  undecided?(element: T): readonly Undecided[]
}

// packages/core/src/undecided.ts (/internal)
export type Membership = true | false | readonly Undecided[]
export function membership<T>(ps: readonly Predicate<T>[], op: 'all' | 'any', e: T): Membership
export function partition<T>(
  elements: readonly T[],
  ps: readonly Predicate<T>[],
): { elements: T[]; undecided: Undecided[] }
export function kleene<T>(
  ps: readonly Predicate<T>[],
  op: 'all' | 'any',
): Pick<Predicate<T>, 'test' | 'undecided'>
```

### Phase 1: the kernel

- `Undecided` and the member on `Predicate`, with doc comments stating the contract: method syntax,
  context-free, and a `test` that refuses a subject `undecided` reports.
- `undecided.ts`: `membership` (the one truth table), `partition`, `kleene`, `undecidedViolations`
  (rule context, `bypassFilters`, one per cause), and `refuseUndecided`.
- `partition` keeps today's path when no predicate declares the member, so no existing rule pays for
  it.
- `combinators.ts`: `not` forwards `undecided`; `and`/`or` take `test` and `undecided` from `kleene`
  when an input declares it.
- `matchingElements` and `selectMatching` partition and refuse an undecided subject.
- `RuleBuilder.collectViolations`: partition once, report undecided causes before the empty-selection
  return, and append them after the conditions (deduplicated against what the conditions reported).
- **The zero-examined finding names the undecided count** when every subject is undecided. In the
  prototype it printed the generic dead-selector text, sending the reader to the wrong remedy.

### Phase 2: eess-ts

- `packages/ts/src/core/combinators.ts`: the predicate branch of `not`/`and`/`or` forwards the member
  through the kernel's `kleene`.
- eess-ts's builders refuse an undecided subject through `matchingElements`. A test proves it: an
  eess-ts rule with `not(<a predicate that cannot judge>)` throws.

### Phase 3: eess-md

- `haveFieldPredicate` declares `undecided` for every unreadable cause, and its `test` refuses one.
  The verdict is memoized per document and spec (a `WeakMap` per spec). On 2,000 records with 5 boxes
  each, the prototype took 450 ms against 42 ms for a plain predicate. Measure again after
  memoizing.
- Export `haveField` as a free predicate from the root, beside `docs().haveField()`.
- Delete `DocsRuleBuilder`'s identity-keyed override (plan 0469); its tests move with it.
- `inScope` (`packages/md/src/builders/box-mark-findings.ts`) uses `membership`: an unread box whose
  membership is unknown is reached (fail-closed), and its causes are reported.
- Fold the behaviour change into the pending `md-have-field` changeset (`haveField` is unreleased).
  `.select()` over an undecided document throws, and an undecided document is no longer asserted
  against by the rule's condition.

### Phase 4: dogfood and the gates

- A `check:corpus` rule using `haveField` in selector position over this repository's records, which
  plan 0469 left condition-only. Plan 0457's `inDocuments` is not built, so the rule scopes `docs()`;
  the block-12 form follows 0457.
- `check:nonvacuity`: plant a live record with two State lines under that rule; the gate must red
  with the cause on that rule's id.
- The vacuity matrix covers the new `/internal` exports.
- ADR-021's Enforcement rows move from `pending` to `gated` as each test lands.

## Test inventory

- Kernel, `not`/`and`/`or` with decided-false, decided-true and unknown inputs, kernel and eess-ts.
- `not(haveField)` over a document with three boxes: the cause once, no box, `examined` decided-only.
- `and(folder, haveField)` with the document outside the folder, and `or(haveField, true)`: nothing.
- Every subject undecided: each cause, and the zero-examined finding names the count.
- `.select()`, a hand wrapper, and an eess-ts rule each throw, naming the cause.
- `.excluding(<the cause>)` leaves it reported; `.warn()` with an undecided subject fails.
- A document whose only box is unread: both the cause and plan 0454's unread-box finding.
- The cost measurement after memoizing, reported.
- Sabotage rows: each combinator stops forwarding; `membership` loses its short-circuit; membership by
  `test` alone; `matchingElements` filters by `test`; the empty-selection return drops the causes;
  `bypassFilters` removed; the memo returns a stale verdict.

## Out of scope

- **`inDocuments` (plan 0457).** It forwards `undecided`; if 0457 is built before this plan, it
  refuses a predicate that declares the member, so the lift never ships fail-open.
- **Carrying findings through `Selection`** for a `correspondence()` side. No adopter uses it, and
  the refusal closes the door. It is a new plan when one asks.
- **eess-ts honouring the member in its own `collectViolations`.** The floor is the refusal. It
  becomes a plan when an eess-ts predicate declares the member, such as the undecided heritage walk
  of bugs 0373/0375/0383.
- **Plan 0457's `SCOPES` registry** has the same combinator blindness. It is recorded for 0457.
- **Bugs 0482, 0483, 0484**, recorded from plan 0469.

## Progress ledger

- [ ] Phase 1: the kernel
- [ ] Phase 2: eess-ts
- [ ] Phase 3: eess-md
- [ ] Phase 4: dogfood, non-vacuity, vacuity matrix, ADR-021 rows
- [ ] Sabotage rows red on their named tests; durations reported
- [ ] `npm run validate` green; duration reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
