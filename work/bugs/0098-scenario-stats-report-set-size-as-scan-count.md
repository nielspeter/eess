# Bug 0098: the scenario stats APIs report the feature set's size as `scenarios` — any non-vacuity guard built on it is vacuous

## Status

- **State:** Draft — confirmed against the source; no red test written yet.
- **Reported:** 2026-08-12 — self-found while verifying the bug reports filed
  from the [plan 0096](../plans/completed/0096-dogfood-missing-crossvalidate-bindings.md)
  review, when the field's actual expression was read rather than its name.

## Symptom

Both scenario stats functions advertise themselves as non-vacuity instruments:

> `/** Count citations/scenarios for a caller's non-vacuity summary line. */`
> — `packages/crossvalidate/src/md-gherkin.ts:151`

> `/** Count citing tests / scenarios for a caller's non-vacuity summary line. */`
> — `packages/crossvalidate/src/gherkin-ts.ts:230`

But their `scenarios` field does not count anything that was scanned. It counts
how many scenarios exist **in the feature set** — a number computed without
consulting the corpus or the project at all:

```ts
// packages/crossvalidate/src/md-gherkin.ts:156-164
): { citations: number; features: number; scenarios: number } {
  return {
    citations: extractCitations(corpus, dir, extract).length, // ← corpus-side: a real scan count
    features: set.features().length,                          // ← set-side: inventory
    scenarios: set.scenarios().length,                        // ← set-side: inventory
  }
}
```

So a caller writing the obvious non-vacuity guard —

```ts
if (stats.scenarios === 0) throw new Error('scanned nothing — green-but-empty')
```

— has written a guard that passes whenever the `.feature` files load, whether or
not the markdown corpus cites a single one of them. It proves the denominator
exists. It proves nothing about the scan.

Two of the three fields are set-side inventory; one is a scan count. Nothing in
the return type, the field names, or the doc comment says which is which.

## Reproduction

Point `scenarioCitationStats` at a corpus with **no citations at all** and a
feature set that loads normally:

```ts
const stats = scenarioCitationStats(
  corpus({ roots: ['docs/nothing-cites-a-feature.md'] }),
  features({ cwd: 'packages/crossvalidate/specs', roots: ['**/*.feature'] }),
)
// stats.citations === 0   ← the honest signal
// stats.scenarios  === 3  ← non-zero anyway; `scenario-binding.feature` has three
```

A `scenarios > 0` guard is green over a corpus that cites nothing.

## Root cause

The two functions mix two different kinds of number behind one flat record, and
name them alike. `citations` answers "what did we scan?"; `features` and
`scenarios` answer "what was available to scan?". The existing gate uses them
correctly — as a numerator and a denominator in one printed line:

```js
// scripts/check-crossval.mjs:92
console.error(`  scenario↔test — ${s.citations} citations across ${s.scenarios} scenarios`)
```

That is an honest summary. The trap is that the record is also documented as
serving non-vacuity, and only one of its fields can. `tableErStats`
(`packages/crossvalidate/src/md-mermaid-er.ts:176-195`) is the counter-example
that shows the right shape: all three of its fields (`docs`, `entities`,
`attributes`) count what the scan actually walked.

There is also a hole. `scenarioCitationStats` exposes **no** count of citations
that carry a scenario title — and that is the only number that proves the
scenario-title resolution path ran. `citations` includes bare file-level
citations (a backticked path with no title), which never reach the title check
at `md-gherkin.ts:137`. So the API cannot express the very fact a caller needs
it for.

## Why it matters

This is not hypothetical: it was written. Plan 0096's reworked Phase 1 rests its
entire non-vacuity guard on `s.scenarios === 0`, justified in the plan text as

> `scenarios` counts scenarios referenced by **title-bearing** citations, so
> `scenarios > 0` proves the scenario-resolution path actually ran.

Every clause of that is false, and the plan reached its second review round with
the claim intact — the first round had already replaced one vacuous guard with
this one. A plan whose stated purpose is "a gate that scanned nothing must not
read as green" was about to ship exactly that gate, because the field name read
true. (Plan 0096 is corrected in the same pass that files this bug.)

## Fix

Two parts, both in `packages/crossvalidate/src/`:

1. **Say which numbers are which** — in the return type's doc comments, and in
   the function docs, mark `features`/`scenarios` as set-side inventory
   (denominators for a summary line) and `citations` as the scan count. Drop the
   unqualified "for a non-vacuity summary" phrasing that invites the guard.

2. **Add the missing scan count** — a `titled` field on `scenarioCitationStats`
   counting citations that carry a scenario title, so a caller can prove the
   title-resolution path ran:

```ts
/**
 * Counts for a caller's summary line. `citations`/`titled` are scan counts (what
 * this call walked in the corpus); `features`/`scenarios` are the feature set's
 * inventory — the denominators. Only the scan counts can prove non-vacuity.
 */
export function scenarioCitationStats(
  corpus: Corpus,
  set: FeatureSet,
  options: ScenarioCitationsResolveOptions = {},
): { citations: number; titled: number; features: number; scenarios: number } {
  const cites = extractCitations(corpus, dir, extract)
  return {
    citations: cites.length,
    titled: cites.filter((c) => c.title !== undefined).length,
    features: set.features().length,
    scenarios: set.scenarios().length,
  }
}
```

A `minor` changeset on `@nielspeter/eess-crossvalidate` (additive field).

**What this does not fix:** stats are a _summary_, not a _gate_. The repo's real
non-vacuity mechanism is a sabotage fixture under `scripts/nonvacuity/` asserted
by `scripts/check-nonvacuity.mjs` — feed the gate violating input and require it
to exit 1 (`bad-gherkin-ts.mjs` is the md↔gherkin-adjacent template). A stats
threshold detects an empty scan; only a sabotage fixture proves the gate can go
red. Callers should use both, and the corrected docs should say so.

## Verification

- [ ] Red test written first: a corpus with only **file-level** citations
      (path, no title) over a loaded feature set → `titled === 0` while
      `citations > 0` and `scenarios > 0`. Today no field distinguishes these
      cases, so the test cannot be written against the current signature.
- [ ] A corpus with zero citations → `citations === 0` and `titled === 0`, while
      `features`/`scenarios` stay non-zero (documented as expected, not a bug).
- [ ] The existing `check:crossval` summary line is unchanged.
- [ ] `npm run validate` green.

Deferred:

- **`scenarioTestStats` (`gherkin-ts.ts:231`) keeps its `scenarios` denominator**
  — its `citations` is already a genuine scan count over the project, so the
  record is usable as-is once documented. It gets part 1 (doc clarity), not part
  2 (no missing count).
- **Plan [0091](../plans/0091-cross-dialect-examples-checked.md) is `Ready` and
  plans a new `adrCitationStats` on `md-ts.ts` "mirroring its two siblings"** —
  mirroring the current shape would replicate this defect into a third API. The
  plan's floor is frozen, so this bug does not edit it; the sibling to mirror is
  `tableErStats`. Flagged to the plan's owner for a Ready-stage amendment.
