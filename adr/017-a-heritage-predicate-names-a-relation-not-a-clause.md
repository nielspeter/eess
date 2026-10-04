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
   type alias, which has no chain, the reading is unchanged — which is not the same as
   working ([bug 0376](../work/bugs/0376-extendtype-on-a-type-alias-reads-the-alias-name.md)).
4. **Each level of the walk is compared as before** — as written and as resolved (bug 0296).
   A level the checker cannot resolve still matches by its text, so the predicate holds for
   every subject it held for under the direct check, and for more. (Under `not(…)` that
   reverses: a negated predicate holds for fewer.)
5. **The walk ends.** A cycle between interfaces ends it by a guard. A cycle between classes
   needs none: the checker breaks every circular chain, leaving some class on it with no base
   class.
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
grandchild. No documented rule means that, and rule 7 gives it a home if one appears. Under
`not(…)` both reverse: a negated selector selects fewer, so a rule can stop reporting, and a
negated condition reports more.

## Consequences

- `eess-ts` ships a breaking change, marked as such: `minor` on `0.x`.
- `eess-mermaid` breaks rule 6 today. Its `extend` reads one diagram edge
  ([bug 0374](../work/bugs/0374-eess-mermaid-extend-reads-one-edge.md)).
- The walk stops where it cannot climb, and says nothing. Above a base the checker cannot
  resolve nothing is known ([bug 0373](../work/bugs/0373-an-unresolved-base-ends-the-heritage-walk-silently.md));
  three resolved shapes also end it — a class expression, an intersection, a class named in
  `implements` ([bug 0375](../work/bugs/0375-the-heritage-walk-cannot-climb-three-resolved-shapes.md)).
  This ADR does not decide whether a stop must be reported. Whether
  [ADR-016](./016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) applies is 0373's
  question, and its ruling amends this ADR.
- Matching by text now happens at every level, including in a library's declarations. A
  condition can therefore pass a class whose distant ancestor names an unrelated class with the
  same name. Bug 0296 kept the text match on purpose, for bases the checker cannot resolve; the
  walk widens where it applies.

## Enforcement

| Clause                                                                    | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Status  |
| ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **C1** — `extend(X)` holds at any depth, as a selector                    | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('extend() as a selector reaches a grandchild, so its violation is reported')` and, past depth 2, `it('extend() reaches a great-grandchild written through an aliased import, and a generic base two levels up')` — red when the chain is the subject alone, and red when it is capped at depth 2                                                                                                                                                                                                                             | gated   |
| **C1** — `extend(X)` holds at any depth, as a condition                   | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('extend() as a condition accepts a grandchild of the base it names')`, the depth-3 test above, and the shipped preset: `packages/ts/tests/presets/data-layer.test.ts` · `it('accepts a repository that extends the base through an intermediate class (bug 0295)')`                                                                                                                                                                                                                                                          | gated   |
| **C2** — `implement(I)` reaches through ancestors and extended interfaces | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('implement() as a selector reaches a class that implements the interface indirectly')`, `it('implement() as a condition accepts a class that implements the interface indirectly')`, `it('implement() reaches through an ancestor that implements a sub-interface')` and `it('implement() and extendType() recurse through more than one extended interface')` — red when ancestors are ignored, and red when the interface walk does not recurse                                                                            | gated   |
| **C3** — `extendType(X)` reaches through the interface chain              | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('extendType() reaches an interface that extends the base through another interface')` and `it('implement() and extendType() recurse through more than one extended interface')`. Covers interfaces only; the type-alias reading is not tested, and is broken ([bug 0376](../work/bugs/0376-extendtype-on-a-type-alias-reads-the-alias-name.md))                                                                                                                                                                              | gated   |
| **C4** — each level matches as written and as resolved                    | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('the walk still matches by name where a level of the chain cannot be resolved')`, `it('an unresolved name in an implements or interface extends clause still matches by its text')` and `it('CONTROL — extend() selects a generic base and a base the checker cannot resolve')`, with `packages/ts/tests/predicates/heritage-predicates-compare-the-clause-text.test.ts` for the resolved arm. Each of the six arms — written and resolved, for `extend`, `implement` and `extendType` — reds at least one test when removed | gated   |
| **C5** — the walk ends                                                    | 2    | `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` · `it('a heritage cycle ends the walk instead of looping')` — red when the interface guard is removed. The class chain has no guard because none can fire: the checker broke the cycle in every circular shape probed for bug 0295, and those seven shapes run in the same file as `it('a circular chain ends — JS file')` and its six siblings. If that ever stopped holding, the test would crash the worker rather than time out, since the loop is synchronous                                                                 | gated   |
| **C6** — one word means one thing across the family                       | 2    | **False today for `eess-mermaid`**, whose `extend` reads one diagram edge. Break class: _a three-level diagram where `extendName('Base')` drops the grandchild_. [Bug 0374](../work/bugs/0374-eess-mermaid-extend-reads-one-edge.md)                                                                                                                                                                                                                                                                                                                                                                         | pending |
| **C7** — no direct-only variant ships                                     | 5    | Ratification. A rule that needs the clause reading asks for a predicate named for it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | manual  |
