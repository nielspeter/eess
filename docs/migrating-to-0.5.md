# Migrating to the v0.5 release

> Written for the release tagged `v0.5.0`, from any 0.4-era install. The tag
> carries the **kernel's** version — the six packages land on three different
> numbers, which the table below gives exactly. Check what you have with
> `npm ls @nielspeter/eess`.

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

Upgrade all six together. They are versioned independently, but this release
crosses the kernel boundary, and a mixed install puts two kernels in your tree
with different public surfaces — the counters and registries inside them then
split silently.

**Your first contact with 0.5 may be an `ERESOLVE`, not a build error.**
`eess-crossvalidate` raises its peer floors this release, so pinning an older
dialect beside it now fails to install rather than resolving into that split
state. That refusal is the point. Upgrade the set.

**Read both halves.** "Changes you have to make" is about importing from eess in
your own code, so if you only write rule files and run the CLI you can skim it.
You cannot skip the second half: **every entry under "Builds that can go red on
their own" hits a rule-file-only adopter**, and those are the ones that turn a
passing build red with your source untouched. (No count here on purpose — an
earlier draft said three, then five, and was wrong both times.)

## Changes you have to make

### 1. `throwIfViolations` is gone

It was a one-line alias for `finishPreset` in its default mode. Replace the call:

```ts
import { finishPreset } from '@nielspeter/eess'
```

Emit to stderr, then throw one aggregated `ArchRuleError`:

```ts
finishPreset(violations, { report: 'throw' })
```

**One thing is not a like-for-like swap.** If what you pass is an array you
assembled yourself — `rules.flatMap((r) => r.violations())`, say — this now fails
with an unsuppressable `emitter/no-receipt` finding. The alias accepted a bare
array and `finishPreset` requires a receipt, so for that caller sections 1 and 4
are one migration. Read section 4 before you run it.

It is on all three barrels, so the import line does not move wherever you took
the old one from — **but on the `/presets` subpath that is true only from this
release onward.** The alias was published there and its replacement never was, so
`finishPreset` is added to that barrel now. If you import from `/presets`, upgrade
before you migrate or the specifier will not resolve.

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
— moved to a second entry point.

**Read this before you use the fix below.** `/internal` is a published, versioned
contract so that the dialects can share plumbing; it is deliberately **not API**.
Nothing there is taught by any page or README, a consumer writing rules never
names it, and it can change in ways the root never would. Nothing in npm or
TypeScript can stop you importing it — the name and this paragraph are the whole
mechanism. So if this section applies to you, treat it as a gap worth reporting
rather than a path to settle into: you are reaching for plumbing, and we would
rather know which piece and why.

With that said — **nothing was deleted or renamed**; change the specifier:

```ts
import { shallowClone, isRecord } from '@nielspeter/eess/internal'
```

Some things stayed on the root that you might reasonably expect to have moved.
**Do not rewrite these** — they are not at `/internal`, and a bulk
search-and-replace will break them:

```ts
import {
  correspondence,
  CorrespondenceBuilder,
  reportViolations,
  finishPreset,
  globNode,
  globAnyOf,
} from '@nielspeter/eess'
```

```ts
import type { CorrespondenceOptions, RelationSpec, KeyBy } from '@nielspeter/eess'
```

`correspondence` is the public surface of `eess-md` and `eess-crossvalidate`, and
the three types are the parameters of `correspondence()` and
`preserveRelations()`. `reportViolations` and `finishPreset` are named seams in
ADR-008. `globNode` and `globAnyOf` are what a user-written `definePredicate`
needs to declare its globs.

The type imports are on their own line above for a reason: they are the ones an
earlier draft of the release notes got wrong, so they are the likeliest to be
rewritten by mistake.

**If you consume a dialect rather than the kernel**, `@nielspeter/eess/internal`
resolves for you only when the kernel is hoisted to your `node_modules` root.
Under pnpm's isolated layout or Yarn PnP it will not — add `@nielspeter/eess` to
your own dependencies.

This constraint is not new and is not `/internal`'s: reaching **any** kernel
symbol directly from a dialect-only install needed the same thing on 0.4. What
is new is that more symbols now require reaching, which is why it is worth saying
here.

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

`eess-md` and `eess-gherkin` lose nothing — both gained exports this release.

**`eess-ts`'s removals, by name.** An earlier draft of this page described them
as "glob-evaluator, disk-set, project-registration and diagnosis internals" and
left it there. A product review said that gives a reader no way to map their own
compile error back to this section, and used `resolveFlag` as the example. That
prediction came true on the first adopter to upgrade, on that exact symbol — so
here is the list, to search:

```
FAULT_ADVICE, ON_DISK_ADVICE, UNSUPPRESSABLE, activeNotice,
assertionLessViolation, buildDiskSet, byCodepoint, collectCalls,
collectObjectLiteralFunctions, combineGlobs, commentSuppressionNotice,
commentSuppressions, countDeclaredGlobs, dedupeConfigFindings, diagnoseGlob,
discoverIdentityRoot, edgeCoverageNotice, emptyProjectAdvice,
fromObjectLiteralFunction, globSitesOf, isAnchored, isDeadGlobTree, isDeadSite,
isFaultPosition, isGlobNode, isNullaryCallable, isOpaqueGlob, isProjectRelative,
isRecord, isTypeOnlyReExport, loadedNothing, marksAssertsCardinality,
negateGlobs, normalizeIdentityText, presetConstructsNothingViolation,
recordCommentSuppression, recordEdgeCoverage, registerProjectRoots,
registerRootCompilerOptions, remedyRepeatsMessage, resetCommentSuppression,
resetDiffDisclosureForTests, resetEdgeCoverage, severityFor, shallowClone,
splitGlobArgs, stampGlobs, suppressionNotice, throwIfViolations, untestedRules,
verbatimModuleSyntaxFor, viewsFor
```

They fall into three groups. A handful moved to `@nielspeter/eess/internal` —
`shallowClone`, `isRecord`, `resetEdgeCoverage` and the counters — so section 2's
fix applies. Two were deleted outright: `throwIfViolations` (section 1) and
`presetConstructsNothingViolation` (section 5). The rest have no import path at
all.

**`isStrictFamily` and `resolveFlag` are restored in the next patch.** Removing
them was a mistake: mirroring tsc's strict-family resolution is an ordinary thing
for a rule file to do, and at `0.5.0` exactly, a named import of either does not
type-error — it fails to LOAD, because ESM resolves named imports up front. If
your rule file imports them, `eess-ts check` stops running rather than reporting.
That is
[bug 0278](https://github.com/NielsPeter/eess/blob/main/work/bugs/fixed/0278-the-strict-family-barrel-kept-the-count-and-dropped-the-functions.md).

**Eight other names on this list were restored once before and removed again.**
`0.4.0` put twenty exports back after an adopter review; `0.5.0` took eight of
them out a second time — `buildDiskSet`, `emptyProjectAdvice`, `globSitesOf`,
`isDeadGlobTree`, `isDeadSite`, `isTypeOnlyReExport`, `loadedNothing`,
`splitGlobArgs`. If you depend on any of those, say so, because the process that
removed them cannot see you. That gap is
[bug 0279](https://github.com/NielsPeter/eess/blob/main/work/bugs/0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md).

**Verify against your own tree rather than this list**, which is a snapshot:

```bash
npm i @nielspeter/eess-ts@0.4.0
node -e "import('@nielspeter/eess-ts').then(m=>console.log(Object.keys(m).sort().join('\n')))" > old.txt
npm i @nielspeter/eess-ts@0.5.0
node -e "import('@nielspeter/eess-ts').then(m=>console.log(Object.keys(m).sort().join('\n')))" > new.txt
comm -23 old.txt new.txt
```

**These did not move to `/internal`.** They were never kernel symbols, so no
import path reaches them any more — section 2's fix does not apply here. If you
were using one, reach for the documented builder that wraps it, or open an issue
saying which and why. The full list of removed names is in each package's
`CHANGELOG.md` under this release, so you can search for the symbol your compiler
just named.

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
rather than an object literal — `collectResult(violations, { examined })`, where
`examined` is how many units you actually looked at. You get one compile error
naming the member. Combining builders? Use `mergeCollectResults([...])`.

If you write rules with `eess-ts`, take both from the dialect you already
installed rather than from the kernel:

```ts
import { collectResult, mergeCollectResults } from '@nielspeter/eess-ts'
```

The second argument is the evidence — how many units you actually looked at:

```ts
collectResult(violations, { examined: files.length })
```

The whole receipt seam is **new in this release** and lands on every dialect with
a barrel — `collectResult`, `mergeCollectResults`, `hasEvidence`,
`reportViolations`, `finishPreset` and `isArchConfigError`. On 0.4 none of it
existed, so there is nothing in your current code to change and no workaround to
remove. Whichever of `eess-ts`, `eess-mermaid`, `eess-md` or `eess-gherkin` you
installed is enough.

`eess-crossvalidate` is the exception. It ships flat entry files rather than a
barrel, and each carries only what its own bindings use, so reaching a
constructor from there may still need `@nielspeter/eess` directly.

**Handing an emitter a bare array** is a type error, and at runtime a
configuration finding with the id `emitter/no-receipt`.

### 5. `presetConstructsNothingViolation` is removed

It is gone from `@nielspeter/eess/internal`. The finding it constructed is no
longer reachable — a preset that constructs nothing is now caught by the evidence
gate instead, which reports it with more detail.

(This section and the "nothing was deleted or renamed" claim above are the two
things on this page a compiled import cannot prove. An import shows a symbol is
there; nothing expresses an absence. Both were checked by hand.)

## Builds that can go red on their own

Nothing here needs a code change from you. Each one makes eess report something
it previously stayed silent about, so a build that passed on 0.4 can fail on 0.5
with your source untouched. That is the upgrade doing its job; the silence was
the defect.

### A preset or rule file that examines nothing now says so

**This is the one most likely to redden your build.** `eess-ts check`,
`eess-ts check --fix`, `eess-ts baseline`, `checkAll()` and `eess-mermaid check`
now refuse a verdict they have no evidence for. Something that examined nothing
used to exit 0 and print a clean bill; it now reports a configuration finding.

There are two different causes and they have different fixes.

**If the subject legitimately does not exist in your corpus** — no ER diagrams,
no exemptions, nothing for that preset to look at — say so. `expectEmpty: true`
is on `PresetReportOptions`, and therefore on every preset in the family:

```ts
import type { PresetReportOptions } from '@nielspeter/eess-ts'
```

The declaration **expires**. The day the subject appears it reds with
`emitter/expired-declaration`, and that expiry is what makes it a declaration
rather than a mute button. It is also why `overrides: { id: 'off' }` is **not**
accepted as one — that deletes the rule permanently and never expires, so eess
would have to read intent into it.

**If the subject should exist**, the rule file was not enforcing anything and the
globs are the place to look.

Do not reach for the globs first. The finding cannot be suppressed by `.warn()`,
`.asSeverity('warn')`, `.excluding()`, an inline exclusion comment, a baseline or
diff-aware mode — by design — so the only ways through are a true declaration or
a real fix.

### One `--format json` field changes

`summary.reason` is now `null` where it previously carried the failing rule's
`because`. Nothing is lost — read `violations[].because` instead. If you have a
script or an agent parsing that field, it changes with your source untouched.

### An empty source can no longer be declared away

The mirror image of the above: a declaration that a source is expected to be
empty no longer suppresses the finding when the source really is empty. The empty
source outranks the declaration and gets its own finding,
`emitter/source-empty`. A declaration is for "there is nothing to examine here";
it is not for "the thing I pointed at turned out to be missing".

### An ambiguous code pointer is a violation

`pointers().should().resolve()` in `suffix` mode classified a pointer matching
two or more files as ambiguous and returned nothing for it. Nothing anywhere
counted or printed those, while they stayed inside the denominator being
reported. In the eess corpus itself that was sixteen such pointers when the
change was made.

The message names the candidates, so three ways out, in order of preference:

1. **Cite a longer suffix** so it names one file. The shortest disambiguating
   prefix is visible in the message without opening either file.
2. **Sanction the region** where the citation is deliberately historical, with
   `<!-- eess-exclude-start <rule-id>: reason -->` … `<!-- eess-exclude-end -->`.
   **This requires `.rule({ id })` on the chain.** An exclusion comment matches a
   violation by rule id, and a chain without `.rule()` has none — the comment is
   then silently inert, with no diagnostic. So
   `pointers(c).that().areLive().should().resolve().check()` must become
   `pointers(c).that().areLive().should().resolve().rule({ id: 'my/pointers' }).check()`
   before any sanction takes effect. That prerequisite is not new, but it was
   only ever written down far from where you need it.
3. **Move the rule to `.warn()`** while you work through them — it reports
   without touching the exit code, so you can ratchet rather than stop the world.

There is deliberately no autofix: choosing among the candidates is a judgement,
and a deterministic rewrite would pick whichever sorted first.

### Duplicate findings anchor deterministically

Which file a duplicate is reported at no longer depends on filesystem order.
**An inline `// eess-exclude` you committed against a duplicate can stop
suppressing after this upgrade**, turning a green build red with no change on
your side. That the old location was never durable is the defect being fixed, and
shipping it quietly as a patch would have been worse.

If one stops suppressing, move the `// eess-exclude` comment to the file the
finding now names — the run tells you which. `.warn()` on that rule buys you time
if there are many.

### Duplicate bodies report clusters, not pairs

`smells.duplicateBodies()` reports one finding per cluster of mutually-similar
bodies instead of one per pair. A two-member cluster keeps the message and
identity it had, so most baselines are untouched. A group of three or more
collapses into one finding with a new `duplicate-cluster::` identity.

**Regenerate your baseline** with `eess-ts baseline`. You could hand-pick the
affected entries, but the collapse is large — in the eess corpus it took 4,770
pair findings down to 407 — so regenerating is both faster and less error-prone.
Nothing is dropped and no score changed; this is what the detector says, not what
it scores.

## If something here is wrong

The `ts` fences on this page have their import lines compiled on every CI run,
so a specifier that does not resolve fails the build rather than reaching you.

To be exact about what that proves: it compiles against this repo's **workspace
build**, not against the tarballs npm serves you. The two agree on everything
this page names, but a packaging-level difference — an `exports` map or a `files`
list — is not something this check can see.

Everything else here is unchecked: the prose, the counts, and any fence not
tagged `ts`. If a claim does not match what you find, that is a bug worth
filing — and the ones most worth reporting are in the prose, because nothing
else is watching it.
