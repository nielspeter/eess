# ADR-017: A heritage predicate names a relation, not a clause

- **Status:** Accepted (2026-10-04)
- **Context:** [bug 0295](../work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md),
  [bug 0296](../work/bugs/fixed/0296-heritage-predicates-compare-the-clause-text.md)
- **Supersedes nothing.** Decides a question of DSL semantics under
  [ADR-003](./003-fluent-builder-dsl.md), using the fail-closed test of
  [ADR-009](./009-agent-first-failure-surfaces.md).

## The question

`extend('BaseRepository')` compared the text of the subject's **own** `extends` clause. A class
that reached `BaseRepository` through `ScopedRepository` was not selected by it, and was red by
it as a condition. `implement` and `extendType` behaved the same way. Bug 0296 had already
widened each comparison to cover a base written as an alias, a namespace member or a mixin call,
and left this open on purpose: it is not a bug in the comparison but a question about what the
word means.

Two readings were possible:

- **A clause.** `extend(X)` means "the `extends` clause names `X`".
- **A relation.** `extend(X)` means "`X` is an ancestor": the subject reaches `X` through its
  chain.

## Decision

**A heritage predicate names a relation.** In a selector and in a condition alike:

1. **`extend(X)` holds when `X` is reachable through the `extends` chain**, at any depth.
2. **`implement(I)` holds when `I` is reachable** through the subject's own `implements`
   clause, an ancestor class's `implements` clause, or an interface either one extends.
3. **`extendType(X)` holds when an interface reaches `X` through its `extends` chain.** For a
   type alias, which has no chain, the reading is unchanged.
4. **Each level of the walk is compared as before** — as written and as resolved (bug 0296).
   A level the checker cannot resolve still matches by its text, so the walk adds matches to
   the direct check and never removes one.
5. **The walk ends.** A cycle between interfaces ends it; the checker already gives a class on
   a circular chain no base class.
6. **One word means one thing across the family.** A dialect that offers `extend` or
   `implement` gives it this meaning.
7. **No direct-only variant ships.** If a rule needs "extends `X` and nothing in between", that
   is a new predicate with a name that says so, added when someone needs it.

## Why this, and not the alternatives

**Every documented use is the relation.** The docs, the getting-started guide and the API
reference use `extend` as "filter to subclasses", to apply a body rule (`notContain(call(…))`)
to them. A grandchild repository that calls `parseInt` breaks that rule exactly as a direct
child does. None of the examples needs the clause reading.

**The shipped preset's own rationale is the relation.** `dataLayer`'s base-class rule says a
repository that does not extend the base "silently opts out of whatever the base guarantees".
A grandchild does not opt out of anything. Under the clause reading the preset red correct code
and pushed its adopter toward an exclusion, which hides the class from the rule for good.

**The clause reading fails open as a selector.** It drops subjects silently, and `examined`
stays above zero because the direct children are still selected, so the ADR-010 floor has
nothing to fire on. ADR-009's first test asks whether a check can pass while the drift it exists
to catch is present. Under the clause reading the answer was yes.

**"Keep `extend` direct and add a transitive predicate under a new name."** Considered, because
it avoids a breaking change. Rejected: the false green stays the default, every documented
example stays wrong, and an agent reaches for the word it reads in the docs. A safe default
that has to be found by name is not a default.

**The cost is a break in both directions, and it is stated.** As a selector the relation selects
more, so a rule can report new violations on an unchanged tree, including for an adopter with a
baseline. As a condition it accepts more, so a rule that meant "directly extends" now passes a
grandchild. No documented rule means that, and rule 7 gives it a home if one appears.

## Consequences

- `eess-ts` ships a breaking change, marked as such: `minor` on `0.x`.
- `eess-mermaid` breaks rule 6 today. Its `extend` reads one diagram edge
  ([bug 0374](../work/bugs/0374-eess-mermaid-extend-reads-one-edge.md)).
- The walk stops where the checker cannot see: above a base it cannot resolve, nothing is
  known, and nothing says so ([bug 0373](../work/bugs/0373-an-unresolved-base-ends-the-heritage-walk-silently.md)).
  That is the shape [ADR-016](./016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)
  rules on, and the clause that covers it is `pending` until 0373 is decided.

## Enforcement

| Clause                                                                     | Tier | Mechanism                                                                                                                                                                                                                                                                                                                        | Status  |
| -------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **C1** — `extend(X)` holds at any depth, as a selector                     | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('extend() as a selector reaches a grandchild, so its violation is reported')` — red before the fix, and red again when the walk is replaced by the direct check                                                                                  | gated   |
| **C1** — `extend(X)` holds at any depth, as a condition                    | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('extend() as a condition accepts a grandchild of the base it names')`, and the shipped preset: `packages/ts/tests/presets/data-layer.test.ts` · `it('accepts a repository that extends the base through an intermediate class (bug 0295)')`      | gated   |
| **C2** — `implement(I)` reaches through ancestors and extended interfaces  | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('implement() as a selector reaches a class that implements the interface indirectly')` and `it('implement() as a condition accepts a class that implements the interface indirectly')`                                                           | gated   |
| **C3** — `extendType(X)` reaches through the interface chain               | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('extendType() reaches an interface that extends the base through another interface')`                                                                                                                                                            | gated   |
| **C4** — each level matches as written and as resolved; the walk only adds | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('the walk still matches by name where a level of the chain cannot be resolved')` and `it('CONTROL — extend() selects a generic base and a base the checker cannot resolve')` — both red when a level is compared as resolved only                | gated   |
| **C5** — the walk ends                                                     | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('a heritage cycle ends the walk instead of looping')` — red when the interface guard is removed. The class chain has no guard, because none can fire: the checker gave no base class to a circular chain in all seven shapes probed for bug 0295 | gated   |
| **C6** — one word means one thing across the family                        | 1    | **False today for `eess-mermaid`**, whose `extend` reads one diagram edge. Break class: _a three-level diagram where `extendName('Base')` drops the grandchild_. [Bug 0374](../work/bugs/0374-eess-mermaid-extend-reads-one-edge.md)                                                                                             | pending |
| **C4** — the walk says when it cannot see further                          | 2    | **No mechanism.** Above a base the checker cannot resolve the walk stops silently. [Bug 0373](../work/bugs/0373-an-unresolved-base-ends-the-heritage-walk-silently.md), under ADR-016 clause 1                                                                                                                                   | pending |
| **C7** — no direct-only variant ships                                      | 5    | Ratification. A rule that needs the clause reading asks for a predicate named for it                                                                                                                                                                                                                                             | manual  |
