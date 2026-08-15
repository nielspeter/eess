# @nielspeter/eess-crossvalidate

## 0.3.0

### Minor Changes

- 59cca49: Add `scenarioExemptionsCurrent` to `gherkin-ts` — detects a Gherkin
  scenario whose exemption (e.g. a `@wip` tag paired with `scenariosCovered`'s
  `include`) is still in force after a real test has already cited it, so a
  stale exemption doesn't silently outlive its reason (proposal 005, plan
  0145). Also exports `citedScenarioSites` and `TestCitationSite` (where a
  citation lives, not just that one exists) and the `TestCitationExtractor`
  type alias (replacing two duplicated inline signatures). Purely additive —
  `scenariosCovered`/`scenarioTestsResolve`'s existing behavior is unchanged.
- 928ce4a: Fold ts-archunit's fail-closed engine into the kernel (plan 0088), porting
  its ADR-008/ADR-009 doctrine as eess ADR-009 (Agent-First Failure Surfaces)
  and ADR-010 (A Pass Is Constructed From Evidence).

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):**
  - **A rule that examines zero units now throws by default.** Previously,
    many rule shapes silently passed when a predicate matched nothing, a
    glob resolved to no files, or a project loaded no source at all —
    indistinguishable from "correctly found nothing wrong." That's now an
    unsuppressable configuration finding (`bypassFilters: true` on the
    violation) unless declared intentional with the new `.expectEmpty()`
    chain method. `.excluding()` and inline exclusion comments cannot
    silence it; ordinary `.check({ baseline })`/`.check({ diff })` filtering
    doesn't either.
    **Migration:** if a rule you own legitimately expects an empty corpus
    right now (mid-migration, a folder not yet populated), add
    `.expectEmpty()` to the chain. Everything else needs no change — the
    new throw only fires where the rule's own instrument was already silently
    broken.
  - **A held selection is no longer mutated by chain methods.**
    `.that()`/`.excluding()`/`.rule()`/`.because()`/`.expectEmpty()` (and
    `RuleBuilder`'s `.addPredicate()`/`.addCondition()`) now return an
    independent copy instead of mutating `this` — a real bug fix (a second
    rule built from a held selection could previously inherit the first
    rule's narrowing/exclusions/id silently). Code that relied on the old
    in-place mutation (holding a builder variable across multiple mutating
    calls and expecting each call's effect to be visible through the
    original reference) will behave differently — correctly. No known
    consumer code does this; it's named here in case any does.
  - **`eess-ts`'s `layeredArchitecture()` preset's `restrictedPackages`
    option now correctly enforces.** It silently under-enforced before (a
    discarded accumulator only worked by accident under the old mutation
    semantics) — an existing ruleset using this option may see new,
    correct violations it was never actually checking for.

  **Unchanged:** predicate/condition semantics and names, rule syntax,
  `// eess-ts:disable` comment syntax, `arch-baseline.json`'s format,
  `ruleId`/`because`/`Fix:`/`Docs:` violation fields, the existing
  `eess-ts` test suite (1961 tests) — only ~13 of which needed updating,
  each because it asserted the old silent-pass as if it were a feature,
  not because any rule-authoring API changed.

  **New, exported from both `@nielspeter/eess` and `@nielspeter/eess-ts`:**
  `CollectResult`, `.expectEmpty()`/`.expectNonEmpty()` (the latter is the
  sharper opposite — it overrides a `.notExist()`-shaped condition's own
  cardinality exemption, reddening if the corpus you declared "must have
  subjects" doesn't), `marksAssertsCardinality`/`assertsCardinality` (the
  extension point for a custom `defineCondition()` to gain the same
  exemption `.notExist()` has), `Matcher`, `BaselineFilter`/`DiffFilterLike`.
  `reportViolations`/`finishPreset` are now also reachable from
  `@nielspeter/eess-ts/presets` for a standalone consumer building a custom
  preset.

  `@nielspeter/eess-md`, `-mermaid`, `-gherkin`, `-crossvalidate` ship no
  source changes of their own in this release — the minor bump tracks the
  kernel's dependency range (their `RuleBuilder<T, P>`/`correspondence()`
  usage inherits the new evidence gate for free) and, per plan 0088's own
  "family boundary" note, is a live capability the moment a consumer
  upgrades: an existing rule in any of these dialects that silently passed
  on an empty corpus will now throw too, not staged behind a later opt-in.

### Patch Changes

- Updated dependencies [928ce4a]
  - @nielspeter/eess@0.3.0

## 0.2.0

### Minor Changes

- e37f787: Fix `it('…')` title capture ending at any quote character rather than the one
  that opened the string (bug 0104). A single-quoted title containing a backtick —
  ``it('catches `HACK` inside a body')`` — was truncated at that backtick, so
  distinct titles collapsed onto one key and a citation to a renamed test still
  resolved against a different test that shared the truncated prefix.

  Affects `adrCitationsResolve` (md↔ts) and `scenarioTestsResolve` /
  `scenariosCovered` (gherkin↔ts), which now share one title grammar. Titles
  delimited by `"` or `` ` `` are unaffected.

  **Behaviour worth knowing:** titles are compared as **raw source text**, so a
  title containing an escaped delimiter keys on the escape as written —
  `it('it\'s fine')` must be cited as `it('it\'s fine')`, backslash included, not
  as `it('it's fine')`. An ADR cites what the test file says, not what the string
  evaluates to. One consequence: a title's raw text is your formatter's to change,
  so prefer titles that need no escaping.

  Adds `adrCitationStats(corpus, options)` — the md↔ts counterpart of
  `scenarioTestStats`, returning `{ citations, adrs }`. `adrCitationsResolve`
  reports OK when it resolves zero citations, so a gate that prints this number can
  tell a clean pass from a drifted `dir`/`roots` that scanned nothing.

  Citation extraction from prose is also tightened: a call whose name merely ends
  in `it` (`submit('save')`, `emit('drift')`) no longer reads as a citation, and a
  malformed citation can no longer swallow the next one in the same cell.

- 4f3022d: New subpath `@nielspeter/eess-crossvalidate/gherkin-ts` — bind `.feature`
  scenarios to the tests that prove them, and fail the build when they drift.

  ```ts
  import { scenarioTestsResolve, scenariosCovered } from '@nielspeter/eess-crossvalidate/gherkin-ts'
  import { features } from '@nielspeter/eess-gherkin'
  import { project } from '@nielspeter/eess-ts'

  const specs = features({ cwd: 'specs', roots: ['**/*.feature'] })
  const tests = project('tsconfig.json')

  scenarioTestsResolve(tests, specs) // every cited scenario exists
  scenariosCovered(tests, specs) // every scenario is cited by some test
  ```

  A test cites a scenario by its title, `<path>.feature › <Scenario title>`:

  ```ts
  it('checkout.feature › Apply a valid discount code', () => { … })
  ```

  Both `›` and `·` work as the separator. Nothing else is a citation — so if your
  suite uses another convention, `scenarioTestsResolve` resolves zero citations and
  passes vacuously. Check the denominator: `scenarioTestStats` returns
  `{ citations, scenarios }`, and a citation count of zero means the convention did
  not match, not that the specs are clean.

  Two directions, because each catches a different drift. `scenarioTestsResolve`
  fails when a test cites a scenario that has been renamed or deleted — the
  citation still reads as proof while proving nothing. `scenariosCovered` fails
  when a scenario has no test citing it at all, which is the gap that never
  announces itself. Both throw on violations, so a bare call is a gate.

  Requires `@nielspeter/eess-gherkin` and `@nielspeter/eess-ts` — optional peers of
  this package, so install the ones you use. Coverage is all-or-nothing today:
  narrow it with the `include` option (handy for `@wip` scenarios); there is no
  baseline ratchet yet.

  **This subpath existed in no earlier release.** It has been on `main` and gating
  this repo's own `packages/crossvalidate/specs/scenario-binding.feature` since
  before `0.1.2`, but a missing release declaration meant the package was never
  bumped, so the subpath was absent from every published `exports` map and
  importing the documented path failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

### Patch Changes

- 1b73b0c: `adrCitationsResolve` now sees tests written in modifier form (bug 0105). It
  filtered on the full callee text, and eess-ts names a modifier call by its whole
  member expression — so every `it.skip(…)`, `it.only(…)`, `it.concurrent(…)` and
  `it.todo(…)` definition was discarded before its title was read, and an ADR
  citing one was reported as citing a test that does not exist.

  The failure landed hardest on the case the mechanism is most useful for: a
  skipped test is the record of a known gap, and an ADR citing one is a project
  being honest about what is not yet enforced.

  The citation side already accepted these forms, so `it.skip('…')` written in a
  Mechanism cell now resolves too.

  **This can turn a passing build red.** Modifier-form definitions now count toward
  ambiguity as well as toward resolution. A citation whose title exists **both**
  live and skipped — `it('x')` alongside `it.skip('x')`, the ordinary shape when a
  variant is parked mid-refactor — previously matched the one visible definition
  and resolved; it now matches two and reports
  `matches multiple tests — the correspondence is ambiguous`. That is correct under
  the documented contract (a cited title must be unique), but it is new: rename or
  delete the parked copy.

  **Still outside, and not for one reason.** `describe(…)` is not a test.
  `it.each(…)(…)` has a templated title with no static text to cite.
  `it.skipIf(cond)(…)` and `it.runIf(cond)(…)` **do** have a static title and are
  still not seen — their callee is itself a call, so the same shape that caused
  this bug survives there; tracked separately, not fixed here. And md↔ts still
  accepts `it` only, not the `test` alias: widening it would change what an ADR may
  cite, and would disagree with `eess-md`'s text-level check, which is also
  `it`-only.

- Updated dependencies [0385ecb]
  - @nielspeter/eess@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies [2f219de]
  - @nielspeter/eess@0.2.0

## 0.1.1

### Patch Changes

- Verify the tokenless release pipeline (OIDC trusted publishing + provenance) end-to-end. No API changes.
- Updated dependencies
  - @nielspeter/eess@0.1.1
  - @nielspeter/eess-ts@0.1.1
  - @nielspeter/eess-md@0.1.1
  - @nielspeter/eess-mermaid@0.1.1
  - @nielspeter/eess-gherkin@0.1.1
