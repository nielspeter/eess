# Bug 0295: `extend()` and `implement()` read only the direct clause, so a grandchild is never selected

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests. The fix needs a
  ruling on public DSL semantics before code.
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
defect with a different fix: [0296](./fixed/0296-heritage-predicates-compare-the-clause-text.md),
since fixed — the predicates now match the direct clause as written or as resolved.

## Root cause

Every heritage predicate compares the text of the class's **own** clause:

- `extend` — predicate `packages/ts/src/predicates/class.ts:13`, condition
  `packages/ts/src/conditions/class.ts:14`
- `implement` — predicate `packages/ts/src/predicates/class.ts:26`, condition
  `packages/ts/src/conditions/class.ts:25`
- `extendType` — `packages/ts/src/predicates/type.ts:87`

Nothing walks the chain. The builder's JSDoc, which is what an IDE shows, says
"filter classes that extend the given class" (`packages/ts/src/builders/class-rule-builder.ts:169-172`);
only the standalone predicate's docstring mentions the text match.

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

Not decided. It is a ruling on DSL semantics ([ADR-003](../../adr/003-fluent-builder-dsl.md)),
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

- [x] KNOWN-GAP tests pin today's behaviour —
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
- [ ] a ruling — an ADR if binding — covering `extend`, `implement`, `extendType` and
      `eess-mermaid`'s `extend`
- [ ] the docs (`docs/index.md:224`, `docs/classes.md:31`, `docs/classes.md:60`)
      and the builder JSDoc say what the predicates do
- [ ] the fix, with the KNOWN-GAP tests inverted into red-first tests
- [ ] `npm run validate` green.

Deferred: none.
