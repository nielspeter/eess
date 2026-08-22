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
certifies nothing. Fix the selector, or call .expectEmpty('services') if an empty
side is valid here.
```

If a side is _expected_ to be empty, declare it with `.expectEmpty('services')`.

**That is an assertion, not a permission, and the difference is the point.** It does
not merely silence the finding — it asserts the side **is** empty, and **fails the
day it stops being**. So a rule that was certifying nothing about a side starts
reporting the moment that side fills up, instead of staying quietly green. An intent
that expires and says so.

## Guarding against over-normalisation

Folding a pairing into a key means two different subjects can collapse onto the same
key — and then the comparison silently checks less than you think.
`.distinctKeysOn(side)` fails if a side maps two distinct subjects to one key:

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
    .distinctKeysOn('services')
    .beComplete(),
]
```

Worth adding on any side whose key function does string surgery — which is every
side in [Comparing symbols, not files](#comparing-symbols-not-files).

## Migrating from `crossLayer`

**`crossProject` covers most `crossLayer` rules, not all of them.** The condition is
precise and worth checking before you start.

### The precondition: your pairing must be key equality

`crossLayer`'s `.mapping(fn)` is an **arbitrary relation** — it tests every left file
against every right file and keeps the pairs the function accepts. `crossProject`
compares key **sets**, so it can only express pairings of the form
`key(a) === key(b)`, where each key is derived from its own side independently.

That covers the common case — matching by a name stem, a route path, an ID. It does
**not** cover a relation that needs to see both files at once:

| `.mapping(fn)`                                                | key-encodable?                                 |
| ------------------------------------------------------------- | ---------------------------------------------- |
| `(a, b) => stem(a) === stem(b)`                               | yes                                            |
| `(a, b) => a.getBaseName().startsWith(b.getBaseName())`       | **no** — prefix matching is not an equivalence |
| `(a, b) => a.getDirectory() === b.getDirectory().getParent()` | **no** — structural                            |
| "the route imports its schema"                                | **no** — reference relation                    |

If your mapping is not key equality, **keep `crossLayer`.**

### The mapping, for rules that do qualify

| `crossLayer`                                       | `crossProject`                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `.layer(name, glob)` ×2                            | `.side(name, source, keyFn)` ×2                                                                                   |
| `.layer(...)` ×3+ (a chain)                        | **no equivalent** — a side count other than two is a configuration finding, so an N-layer chain becomes N−1 rules |
| `.mapping(fn)` — pairs files                       | fold the pairing into the **key** — subject to the precondition above                                             |
| `.forEachPair().should(haveMatchingCounterpart())` | `.beComplete()` / `.haveNoOrphans()` / `.beBijective()`                                                           |
| `.should(haveConsistentExports(l, r))`             | array-returning key functions, as shown above                                                                     |
| `.should(satisfyPairCondition(fn))`                | **usually no equivalent** — see below                                                                             |

### `satisfyPairCondition` has no general translation

Its callback returns a fully-constructed violation, so the author chooses `element`,
`file`, `line`, `message`, `severity`, and `measured` / `metricUnit`. `crossProject`
builds its findings itself and exposes none of those. So:

- **An assertion that is not set difference** — a count comparison, an inequality, an
  ordering — cannot be expressed. A rule reporting _"user-route.ts has 3 methods but
  user-schema.ts has 2 schemas"_ can be approximated by keying each side
  `pair::count=N` and calling `.beBijective()`, but one clear finding becomes two
  opaque key mismatches in opposite directions.
- **A metric finding has no equivalent at all.** A pair condition emitting `measured`
  - `metricUnit` feeds the baseline's numeric ratchet; `crossProject` findings carry
    neither.

Keep `crossLayer` for these.

### What changes when you do migrate

**You gain:** either side can come from outside the project — a config file, a
generated list — because a side is just a set of strings. `crossLayer` could only
compare globs within one project.

**Attribution degrades.** `haveConsistentExports` reports against the left file, with
a message naming both files and the symbol. `crossProject` puts the composite key in
the message and a less specific `element`. The information survives; it reads worse
in a list of elements.

**Unpaired files change behaviour, not just wording.** `haveConsistentExports` only
inspects files it managed to pair — a left file with no counterpart produces zero
findings from it, because that case belonged to `haveMatchingCounterpart`. Under the
prefixed-key form there is one rule, not two, so that same file produces **one
finding per exported symbol**. Usually an improvement; always a change.

**Your baseline does not survive.** Identity is `rule::element::message`, and
migrating changes all three. Every accepted finding is orphaned, so the first run
after migrating reds with the full set. Regenerate deliberately rather than
re-accepting in bulk.

## See also

- [Cross-Layer Validation](./cross-layer.md) — the superseded API, still documented
  for existing users
- [API Reference](./api-reference.md)
- `correspondence({ left, right })` in `@nielspeter/eess` — the kernel primitive for
  binding two selections from **any** loaders, not just one TypeScript project.
  Requires a direct `@nielspeter/eess` dependency.
