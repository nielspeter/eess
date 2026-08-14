# Plan 0146: gherkin-ts checked example, full coverage — the other two exports

## Status

- **State:** Done — built 2026-08-14, not yet merged (awaiting the user's PR
  review). Frozen 2026-08-14 after a three-persona pre-freeze review (architect,
  product, enforcement) found and fixed a real defect in the draft itself (wrong
  fixture arithmetic, a missing `@wip` tag — see the Approach section's
  Correction note); every load-bearing claim was verified directly against the
  real `examples/fixtures/gherkin-ts/` tree, not assumed by analogy to the
  package's fixture. Built exactly as frozen — all predicted counts held on the
  first run. **Post-build review (2026-08-14):** four reviewers (architect,
  product, enforcement, testing) ran against the built branch; zero Critical or
  Important findings (enforcement's sabotage-matrix testing came back
  completely clean). Two independently found the same Minor gap — the README's
  Gherkin↔TS row attributed the "uncovered scenario" red case to `red/`/`covered/`
  when it's actually produced by reusing `green/`; corrected. Testing also found
  the `scenariosCovered` green case was thinner than its package-test parity
  target (missing the `scenarioTestStats` denominator check); added. Deferred:
  none.
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

Plan 0091 ([`work/plans/completed/0091-cross-dialect-examples-checked.md`](./0091-cross-dialect-examples-checked.md))
built one executing example per README-documented `@nielspeter/eess-crossvalidate`
binding, including Gherkin↔TS. But `packages/crossvalidate/README.md`'s
"Gherkin ↔ TypeScript" section documents **three** exports, not one:

1. `scenarioTestsResolve` — a test's citation resolves to a real scenario
2. `scenariosCovered` — the coverage direction: every scenario must be cited by
   at least one test (the complement of #1)
3. `scenarioExemptionsCurrent` — the reverse of #2: an exempt (`@wip`) scenario
   must not already have a citing test

[`examples/cross-dialect.gherkin-ts.test.ts`](../../../examples/cross-dialect.gherkin-ts.test.ts)
exercises only `scenarioTestsResolve`. This was found during 0091's review (three
reviewers ran against the built PR; testing flagged it directly), disclosed
honestly in [`examples/README.md`](../../../examples/README.md)'s binding table
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

**A related finding, caught by this plan's own pre-freeze review**: this Draft's
first version made exactly the mistake it exists to fix — it transplanted the
package fixture's scenario count and `@wip` tag onto `examples/`'s fixture tree
without verifying either was actually true there. See the Approach section's
Correction note.

## Approach

**Correction (2026-08-14, pre-freeze review):** the draft below originally
transplanted the package fixture's arithmetic — a 4-scenario pool with
`features/nested/dup.feature` already `@wip`-tagged — without re-deriving it
against the actual `examples/fixtures/gherkin-ts/` tree 0091 built. Three
reviewers (architect, product, enforcement) independently caught this against
the real files: `examples/fixtures/gherkin-ts/features/checkout.feature` has
**one** scenario, not the package's two, so the total pool is **3** scenarios,
not 4; and `examples/fixtures/gherkin-ts/features/nested/dup.feature` carries
**no tag at all** — 0091 built it without the `@wip` the package's twin has,
since 0091 never needed a tag. Built as originally drafted, the
`scenarioExemptionsCurrent` red case and the `scenariosCovered` include-filter
case would both be silently vacuous (`isExempt`/`include`'s exclusion would
match zero scenarios) — the exact failure class this plan exists to guard
against, landing inside the plan meant to guard against it. All counts below
are corrected against the real fixture; the required tag addition is now an
explicit, named step (Phase 0), not a "no changes needed" claim.

Mirror the package's own test fixture, per 0091's established pattern (every
example's shape mirrors `packages/crossvalidate/tests/*.test.ts` and its fixture
garden). `packages/crossvalidate/tests/gherkin-ts.test.ts`'s `describe('scenariosCovered')`
and `describe('scenarioExemptionsCurrent')` blocks each mix `proj('green')` and
`proj('covered')` across their cases — not a single shared fixture — where
`covered/all.cases.ts` cites **every** scenario in the feature set, including
the `@wip`-tagged one, which is what makes the exemption "stale" (cited despite
being tagged exempt). This plan adds the equivalent fixture under
`examples/fixtures/gherkin-ts/covered/`, over the **3**-scenario pool that
actually exists in `examples/fixtures/gherkin-ts/features/`.

The existing `examples/fixtures/gherkin-ts/green/` fixture (cites only
`checkout.feature › Apply a valid code`) leaves **two** scenarios uncovered
(`dup.feature`'s and `nested/dup.feature`'s) — it becomes the **red** fixture
for `scenariosCovered`'s coverage check for free, no new fixture needed there.
`covered/` is the **green** one. For `scenarioExemptionsCurrent`, the pairing
inverts: `covered/` (cites the now-`@wip`-tagged scenario) is red — the
stale-exemption case; `green/` (doesn't cite it) is green — silent.

Per 0091's own review finding (three reviewers independently caught undisclosed
twin fixtures), the new `covered/` fixture carries the same one-line disclosure
comment convention 0091's review-fix pass established. `examples/cross-dialect.gherkin-ts.test.ts:9-11`
already carries **one combined comment** naming `red/dangling.cases.ts` and
`green/tsconfig.json` as twins — extend that same comment to include `covered/`,
rather than adding a second one.

No change to `@nielspeter/eess-crossvalidate` — both functions, their options
types, and their non-vacuity shape already exist and are unmodified. No new ADR:
this is adopter-facing demonstration, not a design decision.

## Phased implementation

### Phase 0 — tag the scenario that makes exemption staleness demonstrable

Add `@wip` above `Scenario: Another dup scenario` in
`examples/fixtures/gherkin-ts/features/nested/dup.feature`, matching the
package's twin. This is a real, named change to a fixture 0091 already shipped
— not a no-op reuse. Verified safe: no existing case in
`examples/cross-dialect.gherkin-ts.test.ts` (all four current `scenarioTestsResolve`
cases) is tag-sensitive, so this addition cannot regress anything already green.

### Phase 1 — the `covered/` fixture

Add `examples/fixtures/gherkin-ts/covered/all.cases.ts` (a twin of
`packages/crossvalidate/tests/fixtures/gherkin-ts/covered/all.cases.ts`, adjusted
to this repo's existing `examples/fixtures/gherkin-ts/features/` scenario names —
`checkout.feature › Apply a valid code`, `features/dup.feature › A dup scenario`,
`features/nested/dup.feature › Another dup scenario` — **three** scenarios, all
of them, matching this fixture tree's actual pool) and its `tsconfig.json`
(`include: ["all.cases.ts"]`, matching `green/`'s and `red/`'s shape).

### Phase 2 — the two missing describe blocks

Extend `examples/cross-dialect.gherkin-ts.test.ts` with:

- `scenariosCovered` — green (`covered/`, `.not.toThrow()`), red (`green/`,
  asserting the violation count **is 2** and that both dup scenarios are named
  via `element`), and one case mirroring the README's own `include` snippet
  (`include: (s) => !s.tags.includes('wip')` over `green/`) to show the
  violation count narrows from **two to one** once the now-`@wip` scenario is
  excluded from the requirement — asserted by count **and** by `element`
  (`features/dup.feature › A dup scenario`, the one survivor), not count alone:
  a count-only assertion over a 3-scenario pool can't tell "the right scenario
  was excluded" from "a bug excluded the wrong one at the same count." This is
  the pairing the README calls out by name.
- `scenarioExemptionsCurrent` — red (`covered/` + `isExempt: (s) =>
s.tags.includes('wip')`, asserting **1** violation and that the message names
  the citing test's `file:line`, matching the README's own claim), green
  (`green/`, silent).

Add the twin-disclosure comment for `covered/` — extend the existing combined
comment at `examples/cross-dialect.gherkin-ts.test.ts:9-11` (which already names
`red/dangling.cases.ts` and `green/tsconfig.json`) to include `covered/`, rather
than writing a second comment.

`scenarioExemptionsCurrent`'s `isExempt` has no default (unlike `scenariosCovered`'s
`include`) — TypeScript itself refuses a caller who omits it. That compile-time
requirement, not a runtime assertion, is what actually enforces the README's
"the two options must never silently disagree" coupling; no paired runtime case
is added here to re-prove it, since the type system already does.

### Phase 3 — close the disclosed gap in the README

Update `examples/README.md`'s Gherkin↔TS table row: drop the "Exercises
`scenarioTestsResolve` only..." disclosure sentence 0091 added, since it's no
longer true.

## Files Changed

- `examples/fixtures/gherkin-ts/features/nested/dup.feature` — modified: add
  `@wip` to its one scenario (Phase 0).
- `examples/fixtures/gherkin-ts/covered/all.cases.ts`, `tsconfig.json` — new.
- `examples/cross-dialect.gherkin-ts.test.ts` — five new `it()`s across two new
  `describe`-less groups (file already reads as a flat `it()` list, matching
  0091's house style for the other three examples); extends the existing
  twin-disclosure comment rather than adding a second one.
- `examples/README.md` — Gherkin↔TS row's disclosure sentence removed.
- `scripts/check-nonvacuity.mjs` — none needed; its `check:examples` waiver text
  (line ~751) doesn't name specific exports or counts, so this plan's added
  coverage doesn't make it stale. Confirmed, not assumed.

## Test inventory / non-vacuity

The `examples/fixtures/gherkin-ts/features/` pool is **3** scenarios total
(`checkout.feature` × 1, `dup.feature` × 1, `nested/dup.feature` × 1 — this
fixture's `checkout.feature` has only one scenario, unlike the package's twin,
which has two). All counts below are derived from that real pool, not the
package's 4-scenario one.

- **`scenariosCovered` green** — `covered/` cites all **three** scenarios;
  `.not.toThrow()`. Non-vacuous because the red case (below) proves the same
  function reddens on a fixture missing citations — a vacuous implementation
  (e.g. an empty `set.scenarios()` read) would pass both, so the red case is
  the one that actually exercises the check.
- **`scenariosCovered` red** — `green/` (1 of 3 scenarios cited) → **2**
  violations, asserted by count and by both uncovered scenarios' `element`
  field, mirroring `packages/crossvalidate/tests/gherkin-ts.test.ts`'s own
  assertion shape.
- **`scenariosCovered` include-filter** — same `green/` fixture, `include: (s)
=> !s.tags.includes('wip')` → **1** violation (`features/dup.feature › A dup
scenario`), not 2 — asserted by count **and** `element`, proving `include`
  excludes the correct scenario rather than merely changing a count that could
  be coincidental.
- **`scenarioExemptionsCurrent` red** — `covered/` + `isExempt` on `@wip` →
  **1** violation (only fires now that Phase 0 has tagged a real scenario;
  before that fix this case would silently produce zero), message asserted
  against `/is exempt but .*already cites it/` and the citing file's basename,
  proving the violation actually names the stale citation site, not just that
  one exists.
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
