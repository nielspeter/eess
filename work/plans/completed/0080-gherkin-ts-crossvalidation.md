# Plan 0080: gherkin↔ts crossvalidation — the scenario-is-proven-by-a-test gate

## Status

- **State:** Done — both directions of the scenario↔test binding built and
  validated (`scenarioTestsResolve` + `scenariosCovered`; 40 crossvalidate tests);
  `npm run validate` green end-to-end 2026-07-22. The live `check:crossval` gate
  is deferred to the board (blocked on an in-repo product `.feature` — wiring it
  now would scan zero citations).
- **Priority:** P2 — closes the one gap the Gherkin dialect left open: a use
  case (`.feature`) can be cited by a _story_ (md↔gherkin, plan 0069 Phase 2)
  but not bound to the _test_ that proves it. This is the code↔spec half that
  [plan 0069](./0069-spec-corpus-reach.md) explicitly deferred
  ("this one is spec↔spec only", `0069` Out of scope).
- **Effort:** S–M. One new crossvalidator module mirroring two that already
  exist; the engine work is done.
- **Created:** 2026-07-22

## Problem

A `.feature` file is a use case in Jacobson's sense (`Feature` = use case,
`Scenario` = main-success / alternate flow, `Given/When/Then` =
precondition / trigger / postcondition). eess already binds two edges of that
use case:

1. **story ↔ scenario** — `scenarioCitationsResolve` (md↔gherkin, 0069 Phase 2):
   a markdown story cites `` `x.feature` `` · `'Scenario'`; drift fails.
2. **scenario hygiene** — `scenarios(set).haveUniqueTitles()` (eess-gherkin): a
   flow that cannot be uniquely cited cannot be bound to anything.

The missing edge is **scenario ↔ test**. Nothing gates that the alternate flow
_"Reject an already-used code"_ is actually **proven by a test**. A scenario can
be renamed or deleted and the test that once covered it silently orphaned; a
scenario can ship with **no** test at all and every existing gate stays green.
That is the gap the earlier proof-of-run against `job-management.feature`
surfaced: the rules there prove a scenario is _citable_, not that it is _covered_.

This is a concrete, mechanizable instance of the "coverage-of-clause" direction
that [plan 0079](../0079-tier-2-3-mechanization.md) named the most tractable
first strengthening of citation-resolution — restricted to the tractable case
where the "clause" is a named scenario and the "coverage" is a citing test.
It does **not** claim the test _tests the scenario's behavior_ (that is still
Tier 2, still open); it claims the binding exists and resolves. Honest scope.

## Design decision — how a test cites a scenario

A test names the scenario it proves in its `it()` title, reusing the frozen
citation convention (0069) adapted to a single string: a feature path (matched
by unique `/`-boundary suffix, exactly like md↔gherkin) and the scenario title,
separated by `›`.

```ts
// checkout/redeem.test.ts
it('checkout.feature › Reject an already-used code', () => {
  // …proves the alternate flow
})
```

Default extractor (overridable via `extract`, mirroring `md-gherkin`):

```ts
const IT_CITE_RE = /^(?<path>.*\.feature)\s*[›·:]\s*(?<title>.+)$/
```

**Why the `it()` title and not a `describe` block.** The citation lives in one
string so a single flat scan of `it` calls resolves it — the eess-ts public
`calls()` API is flat (`md-ts.ts:64`); it does not expose the enclosing
`describe`. A `describe('x.feature') › it('Scenario')` form is richer but needs a
parent-aware call model (an eess-ts enhancement, out of scope here). The
single-title convention is the closable slice.

**Constraint (ADR-007).** The citation source is read through eess-ts's public
`calls(project)` API — **no ts-morph in crossvalidate** — exactly as
`adrCitationsResolve` does. So this also sees ``it(`template title`)`` the way
md↔ts does.

## Implementation phases

### Phase 1 — `scenarioTestsResolve`: the dangling-citation gate

New module `packages/crossvalidate/src/gherkin-ts.ts`, export `./gherkin-ts`.
Left = test citations (the AST), right = scenarios (the feature set) — the mirror
image of `scenarioCitationsResolve`, whose left was the markdown corpus. Same
three failure modes, same suffix resolution, same `finishPreset` reporting
(ADR-008 caller-owns-reporting).

```ts
import { finishPreset, type ArchViolation, type PresetReportOptions } from '@nielspeter/eess'
import { calls, type ArchProject } from '@nielspeter/eess-ts'
import type { FeatureSet } from '@nielspeter/eess-gherkin'

export interface ScenarioTestsResolveOptions extends PresetReportOptions {
  /** Custom extractor for transition periods. Default: `<path>.feature › <title>`. */
  readonly extract?: (itTitle: string) => { path: string; title: string } | undefined
}

const IT_CITE_RE = /^(?<path>.*\.feature)\s*[›·:]\s*(?<title>.+)$/
const IT_NAME_RE = /^it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/

/** Read every `it('…')` title from the project via eess-ts's public API (no ts-morph, ADR-007). */
function itTitles(project: ArchProject): { title: string; file: string }[] {
  const all = calls(project).select({
    label: 'call',
    identify: (c) => ({ name: c.getName() ?? '' }),
  }).elements
  const out: { title: string; file: string }[] = []
  for (const call of all) {
    if (call.getName() !== 'it') continue
    const m = IT_NAME_RE.exec(call.getName({ withArgument: 0 }) ?? '')
    if (m?.[1] !== undefined) out.push({ title: m[1], file: call.getSourceFile().getFilePath() })
  }
  return out
}

/** Resolve a cited path against the set: exact relPath, or unique `/`-boundary suffix. */
function resolveFeature(path: string, set: FeatureSet): readonly string[] {
  const all = set.features().map((f) => f.relPath)
  return all.includes(path) ? [path] : all.filter((rel) => rel.endsWith(`/${path}`))
}

export function scenarioTestsResolve(
  project: ArchProject,
  set: FeatureSet,
  options: ScenarioTestsResolveOptions = {},
): ArchViolation[] {
  const extract =
    options.extract ??
    ((t) => IT_CITE_RE.exec(t)?.groups as { path: string; title: string } | undefined)
  const scenarioKeys = new Set(set.scenarios().map((s) => `${s.relPath} ${s.title}`))
  const violations: ArchViolation[] = []

  for (const test of itTitles(project)) {
    const cite = extract(test.title)
    if (!cite) continue // not a scenario-citing test
    const resolved = resolveFeature(cite.path, set)
    if (resolved.length === 0) {
      violations.push(
        v(
          test,
          `cites \`${cite.path}\` — no such feature file`,
          'a test citing a missing behavior spec is a dangling reference',
        ),
      )
    } else if (resolved.length > 1) {
      violations.push(
        v(
          test,
          `cites \`${cite.path}\` — ambiguous (${resolved.length} files)`,
          'cite a longer suffix',
        ),
      )
    } else if (!scenarioKeys.has(`${resolved[0]} ${cite.title}`)) {
      violations.push(
        v(
          test,
          `cites '${cite.title}' in \`${resolved[0]}\` — no such scenario`,
          'a renamed or deleted scenario must not silently orphan the test that proves it',
        ),
      )
    }
  }
  return finishPreset(violations, options)
}
```

(`v(...)` is the same small `ArchViolation` factory as `md-gherkin.ts:81`.)

**Files changed (as shipped):** `packages/crossvalidate/src/gherkin-ts.ts` (new),
`packages/crossvalidate/package.json` (`exports["./gherkin-ts"]`),
`arch.internal.rules.ts` (`ENTRY_POINTS` — a new entry-point module must be
declared there or `noUnusedExports`/`noDeadModules` fire; no tsconfig reference
was needed, workspace resolution suffices), `packages/crossvalidate/README.md`
(new "Gherkin ↔ TypeScript" section + eess-gherkin added to Peers), fixtures
under `tests/fixtures/gherkin-ts/`, `tests/gherkin-ts.test.ts`. `scenarioTestStats`
was pulled forward from Phase 3 to satisfy the repo's non-vacuity discipline
(the green test asserts a real citation denominator).

### Phase 2 — `scenariosCovered`: the new muscle (coverage direction)

The right→left pass — the thing no current gate does. Every in-scope scenario
must be cited by at least one test. Scope is opt-in and tag-filtered so
`@wip` / un-implemented flows do not force a red build.

```ts
export interface ScenariosCoveredOptions extends PresetReportOptions {
  readonly extract?: (itTitle: string) => { path: string; title: string } | undefined
  /** Only require coverage for scenarios matching this predicate. Default: all. */
  readonly include?: (s: GherkinScenario) => boolean
}

export function scenariosCovered(
  project: ArchProject,
  set: FeatureSet,
  options: ScenariosCoveredOptions = {},
): ArchViolation[] {
  const include = options.include ?? (() => true)
  const covered = new Set<string>()
  for (const test of itTitles(project)) {
    const cite = (options.extract ?? defaultExtract)(test.title)
    if (!cite) continue
    const r = resolveFeature(cite.path, set)
    if (r.length === 1) covered.add(`${r[0]} ${cite.title}`)
  }
  const violations = set
    .scenarios()
    .filter(include)
    .filter((s) => !covered.has(`${s.relPath} ${s.title}`))
    .map((s) =>
      scenarioViolation(
        s,
        'no test cites this scenario',
        'an unproven use-case flow is a spec with no gate behind it',
      ),
    )
  return finishPreset(violations, options)
}
```

Together the two directions form the loop: `scenarioTestsResolve` kills dangling
tests, `scenariosCovered` kills unproven scenarios. `direction: 'both'` is just
running both.

**Files changed:** `packages/crossvalidate/src/gherkin-ts.ts` (extend),
`tests/gherkin-ts.test.ts` (extend), a `@wip`-tagged fixture scenario proving the
`include` filter excludes it.

### Phase 3 — non-vacuity: fixtures ARE the gate (closable now)

Following 0069's model exactly: the CI proof is **in-repo red/green fixtures**,
not a live product binding. This repo has no product `.feature` cited by a
product test, so a live `check:crossval` gate would scan **zero** citations —
green-but-empty, which this repo's own non-vacuity discipline treats as a red
flag. So Phase 3 ships:

- `tests/fixtures/gherkin-ts/` — a feature file + a `.test.ts` with: one
  resolving citation (green), one dangling path, one ambiguous suffix, one bad
  scenario title (red ×3), one uncited scenario (coverage red), one `@wip`
  uncited scenario (coverage green via `include`).
- `scenarioTestStats(project, set)` — citations / scenarios / covered counts for
  a caller's summary line, mirroring `scenarioCitationStats` (`md-gherkin.ts:152`).

**Deferred, parked on the board (not a dangling checkbox):** wiring a **live**
`gate('scenario↔test', …)` into `scripts/check-crossval.mjs` waits until a real
product `.feature` + citing test exists in this repo. Manufacturing one only to
feed the gate would violate [discovery-stay-open] and produce a vacuous gate.
Tracked as a ROADMAP follow-up, owned there — this plan closes at Phase 3 with
the resolver shipped and proven by fixtures.

## Test inventory

- `scenarioTestsResolve`: green (resolving citation); red ×3 (missing feature,
  ambiguous suffix, missing scenario title); non-citing `it()` ignored;
  ``it(`template title`)`` seen; `extract` override honored.
- `scenariosCovered`: red (uncited scenario); green (all cited); `include`
  filter excludes `@wip`; green-non-vacuous count assertion.
- `scenarioTestStats`: returns the expected denominators on a known fixture.

## Out of scope

- **Behavioral proof** — that the citing test _exercises the scenario's steps_.
  That is Tier 2, still open ([plan 0079](../0079-tier-2-3-mechanization.md)).
  This plan resolves a citation and measures coverage; it does not read step
  bodies.
- **`describe`-nested citations** — needs a parent-aware eess-ts call model. The
  single-`it()`-title convention is the closable slice; the richer form is a
  later eess-ts enhancement.
- **A Cucumber-style runtime binding** — eess is a static validation framework,
  not a step runner (the boundary plan 0067 drew).
- **Live dogfood wiring** — see Phase 3; parked on the ROADMAP until a real
  product feature exists.

## Success definition

- A scenario whose citing test is **renamed or deleted** fails
  `scenarioTestsResolve`; a scenario shipped with **no** test fails
  `scenariosCovered` — both proven by in-repo red/green fixtures with a
  non-vacuous scanned-count summary line. The fixtures are the CI gate.
- The claim stays honest: "a test cites this scenario," never "a test proves this
  scenario's behavior."

## Progress ledger

- [x] Phase 1 — `scenarioTestsResolve` (+ `scenarioTestStats`, `defaultExtract`) + red/green fixtures + 6 tests (dangling direction); entry-points + README updated; full `validate` green
- [x] Phase 2 — `scenariosCovered` + `include` tag filter (`@wip`) + 3 tests (coverage direction); `covered/` fixture cites all four scenarios green non-vacuously; full `validate` green
- [x] Phase 3 — `scenarioTestStats` delivered in Phase 1; the red/green fixture suite is complete across Phases 1–2 (resolve: green + red×3; coverage: red + include + green). Live `check:crossval` wiring remains **deferred → ROADMAP** until a product `.feature` + citing test exists in this repo (wiring it now would scan zero citations — a vacuous gate)
