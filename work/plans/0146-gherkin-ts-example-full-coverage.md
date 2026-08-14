# Plan 0146: gherkin-ts checked example, full coverage — the other two exports

## Status

- **State:** Draft — awaiting freeze.
- **Priority:** Medium — adoption-surface completeness, the same class as 0091
  itself (which this follows on from). `check:crossval` already dogfoods both
  functions this plan demonstrates on the repo's own artifacts (the
  `scenario↔test (every scenario is proven by a test)` and
  `scenario↔exemption` gates in `scripts/check-crossval.mjs`) — this plan makes
  no enforcement stronger, only the adopter-facing proof more complete. A green
  `examples/` run means the same after this lands, there is just more of it.
- **Effort:** Small — one new fixture directory (a twin of an existing package
  fixture) and four to five more `it()`s in an existing test file. No change to
  `@nielspeter/eess-crossvalidate` itself; both functions already exist, are
  already tested, and are already dogfooded by `check:crossval`.
- **Created:** 2026-08-14

## Problem

Plan 0091 ([`work/plans/completed/0091-cross-dialect-examples-checked.md`](./completed/0091-cross-dialect-examples-checked.md))
built one executing example per README-documented `@nielspeter/eess-crossvalidate`
binding, including Gherkin↔TS. But `packages/crossvalidate/README.md`'s
"Gherkin ↔ TypeScript" section documents **three** exports, not one:

1. `scenarioTestsResolve` — a test's citation resolves to a real scenario
2. `scenariosCovered` — the coverage direction: every scenario must be cited by
   at least one test (the complement of #1)
3. `scenarioExemptionsCurrent` — the reverse of #2: an exempt (`@wip`) scenario
   must not already have a citing test

[`examples/cross-dialect.gherkin-ts.test.ts`](../../examples/cross-dialect.gherkin-ts.test.ts)
exercises only `scenarioTestsResolve`. This was found during 0091's review (three
reviewers ran against the built PR; testing flagged it directly), disclosed
honestly in [`examples/README.md`](../../examples/README.md)'s binding table
rather than silently shipped as if complete, and deliberately left unbuilt there
to keep 0091 at its frozen "Small" scope. This plan is that named follow-up.

The gap matters because `scenariosCovered` and `scenarioExemptionsCurrent` are
not minor variants — `scenarioExemptionsCurrent` is the newest surface in the
whole package (proposal 005 / plan 0145, the first proposal this repo ever
accepted and built) and the pair is the one place in the README where two
functions are explicitly coupled ("the two options must never be able to
silently disagree about the same tag" — `packages/crossvalidate/src/gherkin-ts.ts`,
the `ScenarioExemptionsCurrentOptions.isExempt` doc comment). An adopter reading
the README's coupling warning and going to `examples/` to see it demonstrated
finds nothing.

## Approach

Mirror the package's own test fixture, per 0091's established pattern (every
example's shape mirrors `packages/crossvalidate/tests/*.test.ts` and its fixture
garden). `packages/crossvalidate/tests/gherkin-ts.test.ts`'s `describe('scenariosCovered')`
and `describe('scenarioExemptionsCurrent')` blocks both key off a single fixture
project, `fixtures/gherkin-ts/covered/all.cases.ts`, which cites **every**
scenario in the shared feature set — including the `@wip`-tagged
`features/nested/dup.feature` scenario, which is what makes the exemption
"stale" (cited despite being tagged exempt). This plan adds the equivalent
fixture under `examples/fixtures/gherkin-ts/covered/`, reusing the same
`features/` directory 0091 already built (no feature-file changes needed).

The existing `examples/fixtures/gherkin-ts/green/` fixture (cites only
`checkout.feature › Apply a valid code`) already leaves three scenarios
uncovered — it becomes the **red** fixture for `scenariosCovered`'s coverage
check for free, no new fixture needed there. `covered/` is the **green** one.
For `scenarioExemptionsCurrent`, the pairing inverts: `covered/` (cites the
`@wip` scenario) is red — the stale-exemption case; `green/` (doesn't cite it)
is green — silent.

Per 0091's own review finding (three reviewers independently caught undisclosed
twin fixtures), the new `covered/` fixture carries the same one-line disclosure
comment convention 0091's review-fix pass established: name it as a twin of
`packages/crossvalidate/tests/fixtures/gherkin-ts/covered/` in the test file,
right where the fixture root is defined.

No change to `@nielspeter/eess-crossvalidate` — both functions, their options
types, and their non-vacuity shape already exist and are unmodified. No new ADR:
this is adopter-facing demonstration, not a design decision.

## Phased implementation

### Phase 1 — the `covered/` fixture

Add `examples/fixtures/gherkin-ts/covered/all.cases.ts` (a twin of
`packages/crossvalidate/tests/fixtures/gherkin-ts/covered/all.cases.ts`, adjusted
to this repo's existing `examples/fixtures/gherkin-ts/features/` scenario names —
`checkout.feature › Apply a valid code`, `features/dup.feature › A dup scenario`,
`features/nested/dup.feature › Another dup scenario`) and its `tsconfig.json`
(`include: ["all.cases.ts"]`, matching `green/`'s and `red/`'s shape).

### Phase 2 — the two missing describe blocks

Extend `examples/cross-dialect.gherkin-ts.test.ts` with:

- `scenariosCovered` — green (`covered/`, `.not.toThrow()`), red (`green/`,
  asserting the violation count and that both dup scenarios are named), and one
  case mirroring the README's own `include` snippet (`include: (s) =>
!s.tags.includes('wip')` over `green/`) to show the violation count narrows
  from three to two once the `@wip` scenario is excluded from the requirement —
  the pairing the README calls out by name.
- `scenarioExemptionsCurrent` — red (`covered/` + `isExempt: (s) =>
s.tags.includes('wip')`, asserting the message names the citing test's
  `file:line`, matching the README's own claim), green (`green/`, silent).

Add the twin-disclosure comment for `covered/` alongside the existing one for
`red/dangling.cases.ts` and `green/tsconfig.json`.

### Phase 3 — close the disclosed gap in the README

Update `examples/README.md`'s Gherkin↔TS table row: drop the "Exercises
`scenarioTestsResolve` only..." disclosure sentence 0091 added, since it's no
longer true.

## Files Changed

- `examples/fixtures/gherkin-ts/covered/all.cases.ts`, `tsconfig.json` — new.
- `examples/cross-dialect.gherkin-ts.test.ts` — five new `it()`s across two new
  `describe`-less groups (file already reads as a flat `it()` list, matching
  0091's house style for the other three examples).
- `examples/README.md` — Gherkin↔TS row's disclosure sentence removed.

## Test inventory / non-vacuity

- **`scenariosCovered` green** — `covered/` cites all four scenarios;
  `.not.toThrow()`. Non-vacuous because the red case (below) proves the same
  function reddens on a fixture missing citations — a vacuous implementation
  (e.g. an empty `set.scenarios()` read) would pass both, so the red case is
  the one that actually exercises the check.
- **`scenariosCovered` red** — `green/` (1 of 4 scenarios cited) → 3 violations,
  asserted by count and by the two dup scenarios' `element` field, mirroring
  `packages/crossvalidate/tests/gherkin-ts.test.ts`'s own assertion shape.
- **`scenariosCovered` include-filter** — same `green/` fixture, `include: (s)
=> !s.tags.includes('wip')` → 2 violations, not 3 — proves `include` actually
  narrows the requirement rather than being a no-op option.
- **`scenarioExemptionsCurrent` red** — `covered/` + `isExempt` on `@wip` →
  1 violation, message asserted against
  `/is exempt but .*already cites it/` and the citing file's basename, proving
  the violation actually names the stale citation site, not just that one exists.
- **`scenarioExemptionsCurrent` green** — `green/` (the `@wip` scenario isn't
  cited there) + same `isExempt` → `.not.toThrow()`. Non-vacuous against the red
  case above: same `isExempt`, different fixture, different outcome — proves the
  check reads the citation, not just the tag.

## Out of Scope

- **`@nielspeter/eess-crossvalidate` itself** — both functions, unmodified. This
  plan is examples/ only.
- **The other two undemonstrated bindings** (`md↔mermaid`, `md↔mermaid-er`,
  `files`) — 0091's own Out of Scope, unaffected by this plan.
- **`check:crossval` / the repo's own dogfood gate** — already exercises both
  functions on real repo artifacts (plan 0145); this plan is the adopter-facing
  `examples/` demonstration only, a separate lane from 0091's own start.

## Success / close

The plan closes when `examples/cross-dialect.gherkin-ts.test.ts` demonstrates all
three README-documented Gherkin↔TS exports — green + red + non-vacuous for each —
`examples/README.md` no longer discloses a gap for this binding, and
`npm run validate` (which runs `check:examples`) is green.
