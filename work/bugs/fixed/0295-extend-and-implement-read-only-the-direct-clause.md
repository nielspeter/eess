# Bug 0295: `extend()` and `implement()` read only the direct clause, so a grandchild is never selected

## Status

- **State:** Fixed — [ADR-017](../../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md)
  rules that a heritage predicate names a relation; `extend`, `implement` and `extendType`
  walk the chain, as selectors and as conditions. Breaking, marked `minor`.
- **Severity:** High — **false green.** As a selector, `extend('Base')` drops every
  class that reaches `Base` through an intermediate class, and `examined` stays
  above zero, so the ADR-010 floor has nothing to fire on. As a condition the same
  comparison reds the grandchild. The docs teach the reading this breaks:
  `docs/index.md:224` says `.extend('BaseRepository')` is "filter to subclasses".
- **Origin:** self-found · probing `eess-ts` against the findings of an external
  code-quality audit of an adopter monorepo.
- **Reported:** 2026-09-14

## Symptom

Measured by the tests under Verification, over in-memory projects:

| predicate                  | subject                                           | as a selector | as a condition |
| -------------------------- | ------------------------------------------------- | ------------- | -------------- |
| `extend('BaseRepository')` | direct child                                      | selected      | passes         |
|                            | grandchild, through `ScopedRepository`            | **dropped**   | **reds**       |
| `implement('IBase')`       | `implements IBase`                                | selected      | passes         |
|                            | `implements IChild`, where `IChild extends IBase` | **dropped**   | **reds**       |
|                            | `extends DirectImpl`, which implements `IBase`    | **dropped**   | **reds**       |
| `extendType('BaseConfig')` | `interface Mid extends BaseConfig`                | selected      | —              |
|                            | `interface GrandCfg extends Mid`                  | **dropped**   | —              |

Two shapes work today and must keep working: a generic base
(`extends Generic<string>` is selected by `extend('Generic')`) and a base the
checker cannot resolve (`extends Model`, imported from an uninstalled package, is
selected by `extend('Model')` — by its text).

A base written through an alias, a namespace or a mixin call was a **different**
defect with a different fix: [0296](./0296-heritage-predicates-compare-the-clause-text.md),
since fixed — the predicates now match the direct clause as written or as resolved.

## Root cause

_Pointers are to main at `cc95c48`, before the fix._

Every heritage predicate compared the text of the class's **own** clause:

- `extend` — the predicate in `packages/ts/src/predicates/class.ts` and `shouldExtend` in
  `packages/ts/src/conditions/class.ts`, both through `extendsByName`
- `implement` — the predicate and `shouldImplement`, both through `implementsByName`
- `extendType` — `packages/ts/src/predicates/type.ts`

Nothing walked the chain. The builder's JSDoc on `extend()`, which is what an IDE shows, said
"filter classes that extend the given class"; only the standalone predicate's docstring
mentioned the text match.

## Why it matters

- **The shipped preset has it.** `dataLayer`'s base-class rule is
  `.should().extend(options.baseClass)` (`packages/ts/src/presets/data-layer.ts:92`),
  so an adopter with an intermediate base class gets a false red today and is
  nudged toward an exclusion.
- **The docs teach the subclass reading:** `docs/index.md:224`,
  `docs/classes.md:31` and `docs/classes.md:60`.
- **ADR-009's inherited evidence carries this shape** — rows `notImportFrom('picomatch')`
  and `onlyImportFrom`: real subjects examined, blind to one form. ADR-010's Notes
  name the class as its adequacy limit, which the evidence type cannot close.

## Fix

**Ruled in [ADR-017](../../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md):
the relation.** `packages/ts/src/helpers/heritage.ts` walks the class chain through
`getBaseClass()` and the interface chain through each clause's resolved declarations, and at
every level keeps 0296's comparison (as written, or as resolved). Every documented use and
`dataLayer`'s own rationale read `extend` as "an ancestor"; the clause reading failed open as a
selector. The ruling's reasoning is in the ADR. What follows is the question as it was filed.

### As filed

It is a ruling on DSL semantics ([ADR-003](../../../adr/003-fluent-builder-dsl.md)),
and the ruling has to cover more than `extend`:

- **Transitive `extend`/`implement`/`extendType`, or a separately named transitive
  predicate.** Not `inheritFrom()`: in a README it is a synonym of `extend`, and a
  stranger cannot tell which one walks.
- **The family, not one dialect.** `eess-mermaid`'s `extend` is a direct edge
  (`packages/mermaid/src/predicates/class.ts:67`), and `eess-crossvalidate` binds
  the two dialects. One word should mean one thing.
- **A walk must not drop what text matches today.** `getBaseClass()` returns
  nothing for a base it cannot resolve — measured, `UnresolvedEntity extends Model`
  has an empty chain. A walk-only fix moves this record's false green onto every
  adopter with a missing type or an unconfigured `paths`. Union with the text match,
  or make an unresolved base a configuration finding; the CONTROL test pins that it
  stays selected.
- **Both directions of change are breaks.** A transitive selector selects more
  (new violations, including for `withBaseline` users). A transitive condition gets
  more lenient: a rule meaning "directly extends" starts passing grandchildren.
  Either is a marked break on `0.x`, and `dataLayer` changes with it.
- **Keeping direct semantics does not close this record as filed.** The KNOWN-GAP
  tests would stay green forever as design pins; closing would mean reclassifying
  the behaviour as documented, and correcting the docs and the builder JSDoc.

The docs can be corrected now, without the ruling, to say what the predicates do.

## Verification

- [x] KNOWN-GAP tests pinned the old behaviour (inverted by the fix, below; the titles and file
      name here are the pre-rename ones) —
      `packages/ts/tests/predicates/extend-reads-the-direct-parent.test.ts` ·
      `it('KNOWN GAP — extend() as a selector drops a grandchild, so its violation is never reported')`,
      `it('KNOWN GAP — extend() as a condition reds a grandchild of the base it names')`,
      `it('KNOWN GAP — implement() as a selector drops a class that reaches the interface indirectly')`,
      `it('KNOWN GAP — implement() as a condition reds a class that reaches the interface indirectly')` and
      `it('KNOWN GAP — extendType() drops an interface that reaches the base through another interface')`.
      They detect a fix that makes the predicates transitive. **Under the
      direct-semantics option they stay green**, and whoever closes this must say so.
- [x] CONTROLs that must survive any fix —
      `it('CONTROL — extend() selects a direct child and not an unrelated class')` and
      `it('CONTROL — extend() selects a generic base and a base the checker cannot resolve')`.
- [x] a ruling — [ADR-017](../../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md),
      covering all four. `eess-mermaid`'s `extend` is ruled on and not built:
      deferred→[bug 0374](./0374-eess-mermaid-extend-reads-one-edge.md), and ADR-017's C6 row was
      `pending` on it (built since, in 0374, and the row is gated).
- [x] the docs (`docs/index.md`, `docs/classes.md`, `docs/types.md`, `docs/api-reference.md`)
      and both builders' JSDoc say the predicates walk; `docs/migrating-to-0.12.md` written.
- [x] the fix, with the KNOWN-GAP tests inverted into red-first tests —
      `packages/ts/tests/predicates/heritage-predicates-walk-the-chain.test.ts` (renamed from
      `extend-reads-the-direct-parent.test.ts`): five inverted, all measured red before the walk,
      plus `it('the walk still matches by name where a level of the chain cannot be resolved')`
      and `it('a heritage cycle ends the walk instead of looping')`. The shipped preset:
      `packages/ts/tests/presets/data-layer.test.ts` ·
      `it('accepts a repository that extends the base through an intermediate class (bug 0295)')`.
- [x] sabotage matrix, run on the final tree after review, twelve rows — one per branch of each
      function in the walk — sha256-verified restores, over this file,
      `packages/ts/tests/predicates/heritage-predicates-compare-the-clause-text.test.ts` and the
      preset test (32 tests, 39s). **All twelve red:** chain is the subject alone (9), chain
      capped at depth 2 (2), interface walk does not recurse (2), interface walk absent (7),
      interface cycle guard absent (1), `implement` ignores ancestors (4), and each of the six
      written/resolved arms removed for `extend`, `implement` and `extendType` (1–3 each).
      _A first, seven-row matrix ran before review and missed four mutations that stayed green
      — depth capped at 2, no interface recursion, and the written arm of `implement` and
      `extendType`. Testing review found them; the tests at depth 3 and with unresolved
      `implements`/`extends` clauses were added for them._
- [x] the class-chain cycle guard deleted. Its sabotage row turned nothing red, so it was
      probed: in seven circular shapes (self-extend, pair, cross-file pair, declaration merge,
      JS file, mixin, ambient pair) the checker breaks the cycle — in six no class on it has a
      base class, and in the declaration merge one does (`B→A`) but `A` has none. Every chain
      ends, so the guard could never fire. _First written as "no class on a circular chain has
      a base class", which the merge shape contradicts; method review caught it._
      The seven shapes now run in the suite (block _the checker breaks every circular class
      chain_), each with a positive anchor — the classes loaded, and where the walk enters the
      chain, `extend` selects exactly the classes that reach the named one. _Added after
      post-merge testing review: the first version asserted only an empty result, which a shape
      that stopped loading would also give._
- [x] `npm run validate` green on the tree before review (exit 0, 649s, eess-ts 3926 tests);
      and on the final tree after review (exit 0, 560s, eess-ts 3930 tests).

A walk can only climb what the checker resolves: above an unresolved base it stops and says
nothing — deferred→[bug 0373](../0373-an-unresolved-base-ends-the-heritage-walk-silently.md).
The direct check had the same blind spot one level down, so nothing selected before is dropped.

Review found more the walk cannot climb — a class expression, an intersection, a class named
in `implements` — deferred→[bug 0375](../0375-the-heritage-walk-cannot-climb-three-resolved-shapes.md);
and that `extendType`'s type-alias branch, untouched here, reads the alias's own name —
deferred→[bug 0376](../0376-extendtype-on-a-type-alias-reads-the-alias-name.md).

Two edits outside the record: `docs/migrating-to-0.11.md` now says the bug-0372 wording ships in
0.12.0 rather than 0.11.1, which is true only because this change bumps `minor`; and the
`BUGS.md` header counts were recounted from the files, since main's were already stale
(141/104/1 against 143/108/2 on disk).

Deferred: [bug 0373](../0373-an-unresolved-base-ends-the-heritage-walk-silently.md),
[bug 0375](../0375-the-heritage-walk-cannot-climb-three-resolved-shapes.md),
[bug 0376](../0376-extendtype-on-a-type-alias-reads-the-alias-name.md),
[bug 0374](./0374-eess-mermaid-extend-reads-one-edge.md).
