# Migrating to 0.12

> Written for the release that will be tagged `v0.12.0`. Two packages move. Check what you have
> with `npm ls @nielspeter/eess-ts @nielspeter/eess-mermaid`.

| package                    | from   | to     |
| -------------------------- | ------ | ------ |
| `@nielspeter/eess-ts`      | 0.11.0 | 0.12.0 |
| `@nielspeter/eess-mermaid` | 0.5.0  | 0.6.0  |

**One breaking change, in two dialects: the heritage words now walk the inheritance chain** —
`extend`, `implement` and `extendType` in `eess-ts`, and `extendName`, `extend` and
`notExtendStereotype` in `eess-mermaid`. No export is removed or renamed, and no signature
changes. What changes is which classes the words match.

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

- **Under `not(…)` both reverse.** `.that().satisfy(not(extend('BaseEntity')))` now selects
  fewer classes: every grandchild of `BaseEntity` leaves the rule, so it can stop reporting on code
  you did not change. A negated condition reports more. If you use a baseline, this is the case
  where violations disappear.

On its own, each predicate still holds for every class it held for before. Every level is
compared as written and as the checker resolves it (aliases, namespace members, mixin calls), so
a base the checker cannot resolve — `extends Model` from a package without types — is still
matched by its name.

## If you meant "directly extends"

No built-in predicate says that, deliberately: no documented rule needed it. Until one does, a
custom predicate gives you the old reading:

```ts
import { definePredicate, classes } from '@nielspeter/eess-ts'
import type { ClassDeclaration } from 'ts-morph'

const extendsDirectly = (name: string) =>
  definePredicate<ClassDeclaration>(
    `extend "${name}" directly`,
    (cls) => cls.getExtends()?.getExpression().getText() === name,
  )

// "Nothing extends LegacyBase directly — go through the adapter."
classes(p).that().satisfy(extendsDirectly('LegacyBase')).should().notExist().check()
```

It reads the clause as written, so a base imported under an alias is not matched. If you need this, open
an issue so it can become a named predicate.

## In `eess-mermaid`

The same change, over a diagram's edges. Given `Base <|-- Mid` and `Mid <|-- Leaf`:

| you wrote                               | before                         | from `eess-mermaid` 0.6 |
| --------------------------------------- | ------------------------------ | ----------------------- |
| `.that().extendName('Base')`            | `Mid` only                     | `Mid` and `Leaf`        |
| `.should().extend('Base')`              | **red** on `Leaf`              | passes on `Leaf`        |
| `.should().notExtendStereotype('repo')` | the direct parent's stereotype | any ancestor's          |

Which edges count is unchanged: inheritance and realization (`<|..`) alike, in either arrow
direction — so in a diagram `extend` still also means "implements"
([bug 0377](https://github.com/nielspeter/eess/blob/main/work/bugs/0377-eess-mermaid-extend-also-means-implement.md)).
A cycle drawn in the diagram ends the walk; a class on it counts as reaching itself.

## Also in 0.12: one message changed wording

A dead-glob finding for a glob naming a file where a directory is read no longer states its
scope twice, and no longer chooses between its two fixes for you
([bug 0372](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0372-the-file-not-folder-sentence-says-it-can-never-match-twice.md)).
No verdict changes. [Migrating to 0.11](./migrating-to-0.11.md) quotes the new text.

## What this release does not fix

- **Above a base the checker cannot resolve, the walk stops**, and nothing says so. For
  `class Order extends OrmModel`, where `OrmModel` comes from a package without types,
  `extend('OrmModel')` matches and anything `OrmModel` extends is unknown.
  [Bug 0373](https://github.com/nielspeter/eess/blob/main/work/bugs/0373-an-unresolved-base-ends-the-heritage-walk-silently.md).
- **Three shapes end the walk even though the checker resolves them:** a class whose parent is
  a class expression, an interface extending an intersection, and a class named in
  `implements`.
  [Bug 0375](https://github.com/nielspeter/eess/blob/main/work/bugs/0375-the-heritage-walk-cannot-climb-three-resolved-shapes.md).
- **`extendType` on a type alias** reads the alias's own name, so
  `type X = BaseConfig & { … }` is not selected by `extendType('BaseConfig')`. Not new in 0.12.
  [Bug 0376](https://github.com/nielspeter/eess/blob/main/work/bugs/0376-extendtype-on-a-type-alias-reads-the-alias-name.md).
- **`eess-mermaid`'s `extend` also means "implements"**, so it agrees with `eess-ts` on depth
  and not yet on edge kinds.
  [Bug 0377](https://github.com/nielspeter/eess/blob/main/work/bugs/0377-eess-mermaid-extend-also-means-implement.md).
