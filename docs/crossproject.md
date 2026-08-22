# Cross-Project Correspondence

`crossProject()` asserts that two independently-derived sets of names agree.

Most architecture rules ask a question about one thing — does this class extend
that base, does this module import that folder. `crossProject` asks a question no
single element can answer: **are these two lists the same list?** Every route has a
handler. Every schema has a migration. Every feature flag in the code is declared
in the config.

```typescript
import { project, classes, crossProject, byName } from '@nielspeter/eess-ts'

const p = project('tsconfig.json')

export default [
  crossProject(p)
    .side(
      'services',
      classes(p)
        .that()
        .haveNameMatching(/Service$/),
      byName(),
    )
    .side('registry', ['UserService', 'OrderService'])
    .beComplete()
    .because('every service must be registered in the container')
    .rule({ id: 'di/registered', suggestion: 'add it to the container registry' }),
]
```

## The two sides

A **side** is a name and a set of keys. Keys are plain strings, and the two sides
are compared as sets — so how you derive them is up to you.

```typescript
import { project, classes, crossProject, byName } from '@nielspeter/eess-ts'

const p = project('tsconfig.json')

// From a selection, with a key function
crossProject(p).side('classes', classes(p).that().areExported(), byName())

// From an already-derived list — read a config file, a database, anything
crossProject(p).side('config', ['UserService', 'OrderService'])
```

`byName()`, `byArg(i)` and `byPropertyNames()` cover the common key functions. A
key function may return **one key or an array of them**, which is what lets a
single element expand into many keys — see [Comparing symbols, not
files](#comparing-symbols-not-files).

## What you can assert

| terminal           | fails when                                                 |
| ------------------ | ---------------------------------------------------------- |
| `.beComplete()`    | a key on the **first** side has no match on the second     |
| `.haveNoOrphans()` | a key on the **second** side has no match on the first     |
| `.beBijective()`   | either side has an unmatched key — both directions at once |

The direction matters and the names are chosen to make it read: `beComplete` is
"the registry covers everything", `haveNoOrphans` is "the registry has nothing
extra", `beBijective` is both.

## Comparing symbols, not files

A key function returning an **array** expands one element into many keys. That is
how you compare things _inside_ files while still pairing the files:

```typescript
import path from 'node:path'
import { project, modules, crossProject } from '@nielspeter/eess-ts'

const p = project('tsconfig.json')

// Pair `user-service.ts` with `user.ts` by stripping the suffix, then compare the
// symbols each exports. The pairing lives in the key's prefix.
const pairName = (filePath: string): string =>
  path
    .basename(filePath)
    .replace(/-service\.ts$/, '')
    .replace(/\.ts$/, '')

export default [
  crossProject(p)
    .side('services', modules(p).that().resideInFolder('src/services'), (m) =>
      m.getExportSymbols().map((s) => `${pairName(m.getFilePath())}::${s.getName()}`),
    )
    .side('domain', modules(p).that().resideInFolder('src/domain'), (m) =>
      m.getExportSymbols().map((s) => `${pairName(m.getFilePath())}::${s.getName()}`),
    )
    .haveNoOrphans()
    .because('every domain type must have a service that handles it'),
]
```

This is the shape to reach for when migrating a `crossLayer(...).mapping(fn)
.forEachPair().should(haveConsistentExports(...))` rule — see
[Migrating from `crossLayer`](#migrating-from-crosslayer).

## A side that matches nothing

An empty side is reported, not passed over. A correspondence over an empty side
certifies nothing, so `crossProject` says so rather than returning zero violations:

```
crossProject side 'services' matched 0 subjects — a pairing over an empty side
certifies nothing.
```

If a side is _expected_ to be empty — you are asserting that nothing matches yet —
declare it with `.expectEmpty('services')` and the finding goes away. Declaring it
is the difference between "I know" and "the glob broke".

## Migrating from `crossLayer`

`crossLayer()` is superseded by `crossProject()`. The mapping between them:

| `crossLayer`                                       | `crossProject`                                    |
| -------------------------------------------------- | ------------------------------------------------- |
| `.layer(name, glob)` ×2                            | `.side(name, source, keyFn)` ×2                   |
| `.mapping(fn)` — pairs files                       | fold the pairing into the **key** (prefix it)     |
| `.forEachPair().should(haveMatchingCounterpart())` | `.beComplete()` / `.haveNoOrphans()`              |
| `.should(haveConsistentExports(l, r))`             | array-returning key functions, as shown above     |
| `.should(satisfyPairCondition(fn))`                | derive the keys the condition would have compared |

**What you gain:** either side can come from outside the project — a config file, a
generated list — because a side is just a set of strings. `crossLayer` could only
compare globs within one project.

**What you lose, stated plainly:** attribution. `haveConsistentExports` reports the
violation against the left file, with a message naming both files and the symbol.
`crossProject` reports the composite key in the message and a less specific
`element`. The information is all there; it reads less well in a list of elements.

## See also

- [Cross-Layer Validation](./cross-layer.md) — the superseded API, still documented
  for existing users
- [API Reference](./api-reference.md)
- `correspondence({ left, right })` in `@nielspeter/eess` — the kernel primitive for
  binding two selections from **any** loaders, not just one TypeScript project.
  Requires a direct `@nielspeter/eess` dependency.
