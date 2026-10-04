---
'@nielspeter/eess-ts': minor
---

`extend`, `implement` and `extendType` walk the inheritance chain

**Breaking — in both directions, on purpose.** Fixes
[bug 0295](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md);
the semantics are decided in
[ADR-017](https://github.com/nielspeter/eess/blob/main/adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md).

Until 0.12 these predicates read only the subject's **own** clause. `classes(p).that().extend('BaseRepository')`
skipped every class that reached `BaseRepository` through an intermediate class. Its violations
were never reported, and `examined` stayed above zero, so nothing noticed. Now:

- `extend(X)` holds when `X` is an ancestor at any depth.
- `implement(I)` holds through the class's own `implements`, an ancestor's, or an interface that
  extends `I`.
- `extendType(X)` holds through an interface's `extends` chain.

The same in a selector and in a condition. What moves:

- **A selector selects more.** A rule can report new violations on a tree you did not change,
  including if you use a baseline. They are real: the grandchild breaks the rule just as a direct
  child would.
- **A condition accepts more.** `.should().extend('BaseRepository')` stops failing a grandchild.
  `dataLayer`'s `baseClass` rule is one of these, and its own rationale says the grandchild
  conforms.

- **Under `not(…)` both reverse.** `.that().satisfy(not(extend('Base')))` selects fewer classes,
  so a rule can stop reporting on code you did not change; a negated condition reports more.

On its own, each predicate still holds for every class it held for before. Each level is
compared as written and as resolved, so a base the checker cannot resolve is still matched by
its name. See `docs/migrating-to-0.12.md`, which also shows a stopgap if you meant "directly
extends".
