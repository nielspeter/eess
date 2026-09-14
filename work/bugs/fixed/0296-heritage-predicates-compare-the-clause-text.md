# Bug 0296: heritage and decorator predicates compare the clause's text, so a base written any other way is missed

## Status

- **State:** Fixed — `extend`, `implement`, `extendType`, `haveDecorator` and
  `haveDecoratorMatching` match a direct base as written or as the checker resolves it; red test
  first.
- **Severity:** High — **false green** as a selector, false red as a condition, on a direct
  parent. An aliased import is an ordinary way to avoid a name collision.
- **Origin:** self-found · probing `eess-ts` against the findings of an external code-quality
  audit of an adopter monorepo; split from
  [0295](../0295-extend-and-implement-read-only-the-direct-clause.md) by review, because this
  half needs no semantics ruling.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported. Every subject names its base **directly** — no grandchild is involved:

| predicate                     | written as                                       | result                                 |
| ----------------------------- | ------------------------------------------------ | -------------------------------------- |
| `extend('BaseRepository')`    | `extends Base` (aliased import)                  | dropped as selector, reds as condition |
|                               | `extends base.BaseRepository` (namespace import) | dropped as selector, reds as condition |
|                               | `extends Scoped(BaseRepository)` (mixin call)    | dropped as selector, reds as condition |
| `implement('IBase')`          | `implements B` (aliased import)                  | dropped as selector, reds as condition |
| `extendType('BaseConfig')`    | `extends BC` (aliased import)                    | dropped                                |
|                               | `extends cfg.BaseConfig` (namespace import)      | dropped                                |
| `haveDecorator('Controller')` | `@C()` (aliased import)                          | dropped                                |

`haveDecoratorMatching` had the same gap — measured while preparing the fix
(`haveDecoratorMatching(/^Controller$/)` selected the plainly decorated class and not `@C()`) — and
is fixed with it.

## Root cause

Each predicate and condition compared the clause's text: the `extends` expression, each
`implements` expression, an interface's `extends` clause through a regex anchored at its start,
and the decorator's local name. Nothing asked the checker what the clause resolves to. The line
pointers this record carried were removed at close: the comparisons they named were replaced.

## Fix

`packages/ts/src/helpers/heritage.ts` holds the one definition the predicates and conditions now
share. Each check keeps the written comparison — so a namespace-qualified name and a base the
checker cannot resolve still match exactly as before — and adds the resolved name. It only ever
adds matches:

- `extendsByName` adds the class `getBaseClass()` resolves to;
- `implementsByName` and `clauseResolvesTo` add the symbol a heritage clause's type resolves to,
  which `extendType`'s interface branch uses too;
- `decoratorNames` adds, for a decorator that is an imported alias, the name of the declaration it
  stands for; only an alias symbol is asked for a target.

Only the direct clause is read, so a grandchild is still not matched — 0295's pins stay green.
Two limits are stated rather than fixed:

- **A mixin resolves only when TypeScript types it as one**, which needs the mixin's constructor
  to take `...args: any[]`; any other signature leaves the result without a base class, and the
  predicates fall back to the written text.
- **Matching by resolved name conflates two classes of the same name** from different modules.
  Written the same way, `extends Base`, the text already conflated them. Imported under
  different aliases, it did not: `import { Base as A } from './a'` and `import { Base as B } from './b'`
  matched neither under `extend('Base')` before and both now (measured in review). That is the
  mechanism that fixes the alias, not a separate path, so it is stated rather than guarded.

The changeset is a `minor` marked breaking: a selector can select classes it used to skip.

## Verification

- [x] Red test first — `packages/ts/tests/predicates/heritage-predicates-compare-the-clause-text.test.ts`,
      its KNOWN-GAP tests inverted into the target behaviour and run against the shipped predicates:
      five tests failed for the reason they exist (`extend` selected `{DirectRepository}` of four,
      `implement` `{DirectImpl}` of two, `extendType` `{DirectCfg}` of three, `haveDecorator` one of
      two), while `it('CONTROL — each predicate matches a base written as its own imported name')`
      and `it('CONTROL — a decorator declared in the same file, not imported, is matched by its name')`
      passed.
- [x] The fix turns them green:
      `it('extend() as a selector matches a base written through an alias, a namespace or a mixin call')`,
      `it('extend() as a condition accepts a base written through an alias, a namespace or a mixin call')`,
      `it('implement() matches an interface imported under an alias, as a selector and as a condition')`,
      `it('extendType() matches a base interface written through an alias or a namespace')` and
      `it('haveDecorator() and haveDecoratorMatching() match a decorator imported under an alias')`.
      The first run after the fix still failed the two `extend` mixin cases: the fixture declared
      the mixin with `...args: never[]`, which TypeScript does not type as a mixin. The fixture was
      corrected to the valid signature, with the reason written beside it, and the limit is stated
      above. The predicate, condition, builder and integration suites around it — 302 tests,
      including 0295's pins — pass.
- [x] Sabotage matrix in the 0296 worktree (per-entry `node_modules`, `@nielspeter/eess` proven to
      resolve inside it, verdicts read by test title, source restored by hash after every row), over
      this file and 0295's: removing the resolved base, the resolved `implements` clause, the shared
      clause resolution or the decorator's aliased target each reds exactly the tests that depend on
      it; making `extend` walk the whole chain reds 0295's two grandchild pins, so an over-broad fix
      cannot pass as this one; a total break reds every guard. One row was first under-enumerated —
      the total break also reds 0295's condition pin — and was corrected and re-run. One row was
      measured rather than asserted: asking a same-file decorator's symbol for an aliased target does
      not throw, so the helper's comment says the guard exists because only an alias has a target,
      not because the checker would assert.
- [x] `npm run validate` green.

Deferred: none.
