# Bug 0296: heritage and decorator predicates compare the clause's text, so a base written any other way is missed

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests. No ruling needed.
- **Severity:** High — **false green** as a selector, false red as a condition, on
  a direct parent. An aliased import is an ordinary way to avoid a name collision.
- **Origin:** self-found · probing `eess-ts` against the findings of an external
  code-quality audit of an adopter monorepo; split from
  [0295](./0295-extend-and-implement-read-only-the-direct-clause.md) by review,
  because this half needs no semantics ruling.
- **Reported:** 2026-09-14

## Symptom

Every subject below names its base **directly** — no grandchild is involved.
Measured by the tests under Verification:

| predicate                     | written as                                       | result                                 |
| ----------------------------- | ------------------------------------------------ | -------------------------------------- |
| `extend('BaseRepository')`    | `extends Base` (aliased import)                  | dropped as selector, reds as condition |
|                               | `extends base.BaseRepository` (namespace import) | dropped as selector, reds as condition |
|                               | `extends Scoped(BaseRepository)` (mixin call)    | dropped as selector, reds as condition |
| `implement('IBase')`          | `implements B` (aliased import)                  | dropped as selector, reds as condition |
| `extendType('BaseConfig')`    | `extends BC` (aliased import)                    | dropped                                |
|                               | `extends cfg.BaseConfig` (namespace import)      | dropped                                |
| `haveDecorator('Controller')` | `@C()` (aliased import)                          | dropped                                |

## Root cause

The predicates compare the clause as written:

- `extend` — `packages/ts/src/predicates/class.ts:13`, `packages/ts/src/conditions/class.ts:14`
- `implement` — `packages/ts/src/predicates/class.ts:26`, `packages/ts/src/conditions/class.ts:25`
- `extendType` — `packages/ts/src/predicates/type.ts:87`, a regex anchored at the
  start of the clause, so `cfg.BaseConfig` cannot match
- `haveDecorator` — `packages/ts/src/predicates/class.ts:38`, the decorator's local name

## Why this is its own record

The class **is** a direct child of the base it names, so there is no semantics
question. For `extend`, ts-morph already resolves the base: measured,
`getBaseClass()` returns `BaseRepository` for the aliased, namespaced and mixin
forms. A fix that matches **either** the clause text or the resolved declaration's
name only ever adds matches — nothing selected today stops being selected, which
is the direction review warned a resolution-only fix gets wrong. Matching by name
conflates two same-named classes from different modules, but today's text match
already does.

The resolution for `implement`, `extendType` and `haveDecorator` is not measured
here.

If [0295](./0295-extend-and-implement-read-only-the-direct-clause.md) rules for a
transitive walk, the walk subsumes this for `extend`; this record does not wait
for that ruling.

## Fix

Union the text comparison with the resolved declaration's name, per predicate and
per condition. Release: a selector that selects more can turn a green gate red
where an alias was hiding a violation — a behavioural break, marked on `0.x`.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/predicates/heritage-predicates-compare-the-clause-text.test.ts` ·
      `it('KNOWN GAP — extend() as a selector drops a base written through an alias, a namespace or a mixin call')`,
      `it('KNOWN GAP — extend() as a condition reds a base written through an alias, a namespace or a mixin call')`,
      `it('KNOWN GAP — implement() drops and reds an interface imported under an alias')`,
      `it('KNOWN GAP — extendType() drops a base interface written through an alias or a namespace')` and
      `it('KNOWN GAP — haveDecorator() drops a decorator imported under an alias')`.
      They assert the escape, so **fixing this bug turns them red**.
- [x] the covered half is pinned —
      `it('CONTROL — each predicate matches a base written as its own imported name')`.
- [ ] the union fix for all four predicates and both conditions, KNOWN-GAP tests
      inverted into red-first tests
- [ ] `npm run validate` green.

Deferred: none.
