# Migrating to the 0.5 family

This release moves every package at once, and eleven of its thirty changes are
breaking. This page collects them in the order you will hit them, so you do not
have to reconstruct a migration from six changelogs.

| package                          | from  | to    |
| -------------------------------- | ----- | ----- |
| `@nielspeter/eess`               | 0.4.0 | 0.5.0 |
| `@nielspeter/eess-ts`            | 0.4.0 | 0.5.0 |
| `@nielspeter/eess-md`            | 0.5.0 | 0.6.0 |
| `@nielspeter/eess-mermaid`       | 0.3.0 | 0.4.0 |
| `@nielspeter/eess-gherkin`       | 0.3.0 | 0.4.0 |
| `@nielspeter/eess-crossvalidate` | 0.4.0 | 0.5.0 |

Upgrade all six together. They are versioned independently but this release
crosses the kernel boundary, and a mixed install puts two kernels in your tree
with different public surfaces.

**If you only write rule files and run the CLI, you are probably done after the
upgrade.** Everything in "Changes you have to make" is about importing from eess
in your own code. Read "Builds that can go red on their own" either way — three
of those turn a passing build red without you changing a line, which is the point
of them.

## Changes you have to make

### 1. `throwIfViolations` is gone

It was a one-line alias for `finishPreset` in its default mode. Replace the call:

```ts
import { finishPreset } from '@nielspeter/eess'
```

Behaviour is identical — emit to stderr, then throw one aggregated
`ArchRuleError`:

```ts
finishPreset(violations, { report: 'throw' })
```

It is on all three barrels, so the import line does not move wherever you took
the old one from:

```ts
import { finishPreset as fromKernel } from '@nielspeter/eess'
import { finishPreset as fromTsRoot } from '@nielspeter/eess-ts'
import { finishPreset as fromPresets } from '@nielspeter/eess-ts/presets'
```

Taking the mode explicitly is the point: `report` also accepts `'return'` and
`'warn'` at the same seam, which the alias hid.

### 2. Engine plumbing moved to `@nielspeter/eess/internal`

The kernel now declares what its public API is. Family plumbing — clone helpers,
type guards, the glob-tree vocabulary, the suppression and edge-coverage counters
— moved to a second entry point. **Nothing was deleted or renamed**; change the
specifier:

```ts
import { shallowClone, isRecord } from '@nielspeter/eess/internal'
```

Five things stayed on the root that you might reasonably expect to have moved.
**Do not rewrite these** — they are not at `/internal`:

```ts
import {
  correspondence,
  CorrespondenceBuilder,
  reportViolations,
  globNode,
  globAnyOf,
} from '@nielspeter/eess'
```

`correspondence` and its options types are the public surface of `eess-md` and
`eess-crossvalidate`. `reportViolations` and `finishPreset` are named seams in
ADR-008. `globNode` and `globAnyOf` are what a user-written `definePredicate`
needs to declare its globs.

**If you consume a dialect rather than the kernel**, `@nielspeter/eess/internal`
resolves for you only when the kernel is hoisted to your `node_modules` root.
Under pnpm's isolated layout or Yarn PnP it will not — add `@nielspeter/eess` to
your own dependencies. That is a direct dependency the family does not otherwise
ask of you, and it is the honest cost of reaching plumbing.

### 3. The published barrels stop re-exporting internal helpers

Thirty-seven helpers left the dialect barrels. They were on the entry point but
were never API: no page taught them, and every test that used one already reached
past the barrel into the source module.

`eess-mermaid` loses the free predicate and condition functions —
`haveNameMatching`, `areAbstract`, `notDependOnStereotype` and that block. The
documented surface is the fluent builder that wraps every one of them, so write
`classes(d).that().areAbstract()` instead. Those names looked documented only
because the pages carrying them are the **TypeScript** dialect's and the names
collide.

`eess-ts` loses glob-evaluator, disk-set, project-registration and diagnosis
internals. `eess-md` loses nothing.

### 4. `violations()` returns a receipt

`CollectResult` is an `ArchViolation[]` that also carries `examined`,
`sourceEmpty` and `declaredEmpty` as own properties. It is still an array, so
`.length`, iteration, `map`, `filter` and `for…of` are unchanged, and most call
sites keep compiling. Across the eess workspace itself the retype produced
fifteen type errors, which is the measured size of this migration.

Three things do break:

**A deep-equal against a bare array now fails**, because it compares the
receipt's own properties too:

```ts
// was: expect(builder.violations()).toEqual([])
// now: expect(builder.violations()).toHaveLength(0)
// or, to keep asserting identity:
// expect(builder.violations().map((v) => v.ruleId)).toEqual([])
```

**A custom builder's `collectViolations()` must return a constructed receipt**
rather than an object literal. You get one compile error naming the member:

```ts
import { collectResult } from '@nielspeter/eess'
```

**Handing an emitter a bare array** is a type error, and at runtime a
configuration finding with the id `emitter/no-receipt`.

### 5. `presetConstructsNothingViolation` is removed

It is gone from `@nielspeter/eess/internal`. The finding it constructed is no
longer reachable — a preset that constructs nothing is now caught by the evidence
gate instead, which reports it with more detail.

## Builds that can go red on their own

Nothing here needs a code change from you. Each one makes eess report something
it previously stayed silent about, so a build that passed on 0.4 can fail on 0.5
with your source untouched. That is the upgrade doing its job; the silence was
the defect.

### An evidence-free rule file now fails the CLI

`eess-ts check`, `eess-ts check --fix`, `eess-ts baseline`, `checkAll()` and
`eess-mermaid check` now refuse a verdict they have no evidence for. A rule file
whose builders examined nothing used to exit 0 and print a clean bill. It now
reports a configuration finding naming the rule file.

If this fires, the rule file was not enforcing anything — check its globs.

### An empty source can no longer be declared away

A declaration that a source is expected to be empty no longer suppresses the
finding when the source really is empty. The empty source outranks the
declaration and gets its own finding, `emitter/source-empty`.

### An ambiguous code pointer is a violation

`pointers().should().resolve()` in `suffix` mode classified a pointer matching
two or more files as ambiguous and returned nothing for it. Nothing anywhere
counted or printed those, while they stayed inside the denominator being
reported. In the eess corpus itself that was sixteen pointers out of 463.

### Duplicate findings anchor deterministically

Which file a duplicate is reported at no longer depends on filesystem order.
**An inline `// eess-exclude` you committed against a duplicate can stop
suppressing after this upgrade**, turning a green build red with no change on
your side. That the old location was never durable is the defect being fixed, and
shipping it quietly as a patch would have been worse.

### Duplicate bodies report clusters, not pairs

`smells.duplicateBodies()` reports one finding per cluster of mutually-similar
bodies instead of one per pair. A two-member cluster keeps the message and
identity it had, so most baselines are untouched. A group of three or more
collapses into one finding with a new `duplicate-cluster::` identity — **those
baseline entries need regenerating** with `eess-ts baseline`. Nothing is dropped
and no score changed.

## If something here is wrong

The import lines on this page are compiled against the published packages on
every CI run, so a specifier that does not resolve fails the build rather than
reaching you. The prose is not checked. If a claim here does not match what you
find, that is a bug worth filing.
