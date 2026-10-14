# Migrating to 0.12

> Written for the release tagged `v0.12.0`. Four packages move. Check what you have with
> `npm ls @nielspeter/eess @nielspeter/eess-ts @nielspeter/eess-mermaid @nielspeter/eess-md`.

| package                    | from   | to     |
| -------------------------- | ------ | ------ |
| `@nielspeter/eess`         | 0.6.0  | 0.6.1  |
| `@nielspeter/eess-ts`      | 0.11.0 | 0.12.0 |
| `@nielspeter/eess-mermaid` | 0.5.0  | 0.6.0  |
| `@nielspeter/eess-md`      | 0.8.0  | 0.9.0  |

`eess-crossvalidate` (0.7.0) and `eess-gherkin` (0.5.0) do not move; the kernel is a patch, so
they take it within the range they already have.

**The tag is not the kernel's version.** The kernel moves only to 0.6.1, and `v0.6.0` already
names an `eess-ts`-only release, so this train takes the next free tag after `v0.11.0`.

**Five breaking changes, in three packages.** Two in `eess-ts` and `eess-mermaid`, covered first,
and three in `eess-md`'s rules, covered in [In `eess-md`](#in-eess-md).

**The heritage words now walk the inheritance chain, in two dialects** —
`extend`, `implement` and `extendType` in `eess-ts`, and `extendName`, `extend` and
`notExtendStereotype` in `eess-mermaid`. No export is removed or renamed, and no signature
changes. What changes is which classes the words match. And `extendType` now also selects a
type alias that intersects the named type — see below.

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

## In `eess-md`

Three changes to the presets, none to a signature. The first two can turn a passing ledger red;
the third can turn a red ADR check green, which is the one to act on.

**`honestyAtClose` and `ledgerStats` refuse half a vocabulary.** Passing `states` without
`terminalStates`, or the reverse, now throws an `ArchConfigError` on the first run. Before, the
missing one kept its default, so a closing token you declared in `states` alone was never treated
as closed and its open boxes were never checked — a clean pass with a denominator
([bug 0284](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)).
Pass both:

```ts
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

honestyAtClose(c, {
  states: ['Draft', 'Ready', 'Open', 'Done', "Won't-do", 'Promoted'],
  terminalStates: ['Done', "Won't-do", 'Promoted'],
})
```

Passing neither, or both, behaves as before.

**A state spelled differently in the two lists is read the same in both checks.** With
`states: ['Draft', 'done']` beside `terminalStates: ['Done']`, the placement check compared
case-sensitively and treated a closed record as open, so `ledger/state-folder-mismatch` went
missing (or fired falsely inside a done-folder). The comparison now folds case and apostrophe
glyphs everywhere. A new orphaned-close finding after upgrading is real
([bug 0379](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0379-a-case-variant-across-the-vocabulary-pair-drops-the-placement-check.md)).

**`adrEnforcement` no longer checks cited test titles — only cited file paths.** It matched an
`it('…')` title as a prefix of any test's text, so a renamed test kept its citation green
([bug 0111](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0111-md-adr-citations-resolve-by-prefix.md)).
**If your ADRs cite test titles, add `adrCitationsResolve`**, which reads the test AST. With
`eess-md` alone, nothing verifies a title any more:

```ts
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'

adrCitationsResolve(corpus({ roots: ['docs/**'] }), project('tsconfig.json'), {
  dir: 'docs/adr/**',
})
```

**New in `eess-md` 0.9, nothing to migrate:** `resolveLink(link, corpus)`, the resolver
`links().resolve()` uses, for custom rules over links; `links().that().areLabelled(label)` and
`.areInSection(name)`, which select the links a record declares under a label or heading;
`.should().beLinkedBack()` and the `.haveLiveTargets()` selector; and YAML front matter is no
longer read as a heading, so it adds no phantom section to `sections` or a table's `sectionPath`
([bug 0087](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md)).

## Also in 0.12: `extendType` reads an intersection alias

`types(p).that().extendType('BaseConfig')` now selects `type X = BaseConfig & { … }` — and an
intersection member written through an aliased import, or an interface that reaches the type
by its own chain. Before, it read the alias's printed type, which is the alias's own name, so
an intersection was never selected
([bug 0376](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0376-extendtype-on-a-type-alias-reads-the-alias-name.md)). A selector
can report new violations; an alias that matched before still matches, and one that only
holds the type in a property (`{ inner: BaseConfig }`) still does not.

## Also in 0.12: a deferred warning's `accepted` list is portable

In `eess-ts`, `.asSeverity('warn', { accepted })` matched raw subjects, which carry absolute paths, so a list
written on one machine matched nothing on another. The advice now prints a portable form,
`<root:NAME>/relative/path`, and a finding matches by either form, so an existing list keeps
working in the checkout it was written in. Only for a builder that names its project. Kernel 0.6.1 and `eess-ts` 0.12.0
([bug 0389](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md)).

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
- **`extendType` on an alias reads one level.** `type Derived = Inner & {…}`, where `Inner` is
  itself an intersection with the type, is not selected, nor is a plain alias of a
  sub-interface or a wrapped member like `Partial<BaseConfig> & {…}`
  ([bug 0383](https://github.com/nielspeter/eess/blob/main/work/bugs/0383-extendtype-stops-at-one-alias-level.md)).
  And its older printed-type test can select by a module's file name
  ([bug 0384](https://github.com/nielspeter/eess/blob/main/work/bugs/0384-extendtype-printed-type-matches-by-module-path.md)).
- **`eess-mermaid`'s `extend` also means "implements"**, so it agrees with `eess-ts` on depth
  and not yet on edge kinds.
  [Bug 0377](https://github.com/nielspeter/eess/blob/main/work/bugs/0377-eess-mermaid-extend-also-means-implement.md).
