# Migrating to 0.12

> Written for the release that will be tagged `v0.12.0`. Only `@nielspeter/eess-ts` moves. Check
> what you have with `npm ls @nielspeter/eess-ts`.

| package               | from   | to     |
| --------------------- | ------ | ------ |
| `@nielspeter/eess-ts` | 0.11.0 | 0.12.0 |

**One breaking change: `extend`, `implement` and `extendType` now walk the inheritance chain.**
No export is removed or renamed, and no signature changes. What changes is which classes the words
match.

## If you only read one thing

```ts
class BaseRepository {}
class ScopedRepository extends BaseRepository {}
class AuditRepository extends ScopedRepository {} // ← this one

classes(p).that().extend('BaseRepository').should().notContain(call('parseInt')).check()
```

Before 0.12 that rule never looked at `AuditRepository`, because its own clause names
`ScopedRepository`. If `AuditRepository` called `parseInt`, the rule passed. And nothing said a
class had been skipped, because the direct children kept `examined` above zero.

From 0.12 it is selected. [ADR-017](../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md)
decides that a heritage predicate names a relation (`X` is an ancestor), not a clause (`extends X`
is written here).

## What moves

| you wrote                            | before 0.12                  | from 0.12                                             |
| ------------------------------------ | ---------------------------- | ----------------------------------------------------- |
| `.that().extend('Base')`             | direct children only         | every descendant                                      |
| `.should().extend('Base')`           | **red** on a grandchild      | passes on a grandchild                                |
| `.that().implement('I')`             | own `implements` clause      | also an ancestor's, and an interface that extends `I` |
| `.should().implement('I')`           | **red** on those             | passes on those                                       |
| `types(p).that().extendType('Base')` | an interface's own `extends` | its whole `extends` chain                             |

So the change goes both ways:

- **As a selector, a rule can report new violations** on a tree you did not change. They are
  real: the grandchild breaks the rule the same way a direct child would. If you use a baseline,
  **read them before you regenerate it**.
- **As a condition, a rule can stop reporting.** `dataLayer`'s `baseClass` rule is the shipped
  example: a repository that extends the base through an intermediate class now conforms. If you
  had excluded such a class to get past the old behaviour, the exclusion is no longer needed and
  can go.

Nothing that matched before stops matching. Every level is still compared as written and as the
checker resolves it (aliases, namespace members, mixin calls), so a base the checker cannot
resolve — `extends Model` from a package without types — is still matched by its name.

## If you meant "directly extends"

No predicate says that today, deliberately: no documented rule needed it. If yours does, open an
issue. It would be a new predicate with a name that says "directly", not a flag on `extend`.

## What this release does not fix

- **Above a base the checker cannot resolve, the walk stops**, and nothing says so. For
  `class Order extends OrmModel`, where `OrmModel` comes from a package without types,
  `extend('OrmModel')` matches and anything `OrmModel` extends is unknown.
  [Bug 0373](https://github.com/nielspeter/eess/blob/main/work/bugs/0373-an-unresolved-base-ends-the-heritage-walk-silently.md).
- **`eess-mermaid`'s `extend` still reads one diagram edge.** ADR-017 says the word means the
  same thing across the family, and that dialect does not yet comply.
  [Bug 0374](https://github.com/nielspeter/eess/blob/main/work/bugs/0374-eess-mermaid-extend-reads-one-edge.md).
