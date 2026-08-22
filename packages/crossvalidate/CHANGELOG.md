# @nielspeter/eess-crossvalidate

## 0.4.0

### Minor Changes

- 7031427: A rule that selects subjects and asserts nothing about them now fails — bug 0155.

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** a rule
  written as `.that().<predicate>.should()` with no condition after it used to
  pass in **total silence**. It now produces an unsuppressable configuration
  finding, so a build that was green on such a rule will go red on upgrade with
  no code change of its own.

  That is the fix working. Such a rule cannot fail, so it certifies nothing while
  reading as coverage — the false-green class ADR-009 and ADR-010 exist to make
  unrepresentable.
  - **The guard was unreachable, not merely quiet.** It tested
    `_conditions.length === 0 && _phase === 'predicate'`, and `should()` sets the
    phase to `'condition'` — so for every rule shape the DSL documents it could
    never fire. Even the stderr warning it was routed to never appeared. The
    `_phase` term is gone.
  - **A finding, not a warning**, per ADR-009 rule 1's discriminator: the remedy
    is not optional. There is no state in which "keeps asserting nothing" is
    correct — add a condition, or delete the rule. (`no-silent-catch` and
    `no-empty-bodies` stay `warn` precisely because they carry suppressible false
    positives a reader must judge one by one. This carries none.)
  - **`bypassFilters`**: `error` regardless of `.asSeverity('warn')`, refused by
    `.excluding()`, skipped by diff and baseline. It reports that the rule's own
    instrument is broken, not a fault in what was examined.
  - **A dead selector still reports as a dead selector.** This finding fires only
    when subjects were actually selected; a rule with a dead glob and no
    condition reports the dead glob, the more useful root cause.
  - **Every builder gives the same answer.** `slices()`, `schema()`,
    `schemaFromSDL()` and `resolvers()` carried the identical branch as a stderr
    warning and now fail too, each with its own remedy. Fixing only the kernel
    would have left one DSL with four different answers to the same mistake.

  **Every dialect is named deliberately.** The behaviour change is in the kernel,
  but an adopter installs `eess-ts` (or `-md`, `-mermaid`, …) and reads _that_
  package's changelog. Declaring only the kernel would route this text to a
  package they may not know exists, while their own changelog said "Updated
  dependencies" — the standalone-sufficiency failure `check:family` exists to
  prevent, in documentation rather than code.

  **Migration:** each finding names the rule and both remedies. Add the condition
  you meant to assert, or delete the rule. If a rule was deliberately held as a
  reusable _selection_, keep holding it — the finding fires only when a rule is
  actually executed, not when a selection is derived from.

  Measured before landing: **zero** assertion-less rules across this repo's own
  five gate files, and one affected test — a kernel contract test that was green
  for the wrong reason and is rewritten here to prove its contract directly.

- 5c4a3ec: New kernel re-exports closing real standalone-sufficiency gaps — plan 0089 Phase 1.

  **Fixed (0.x — minor signals the addition, not a 1.0 stability claim):** each
  sibling dialect promises to be a complete tool on its own — a user installing
  only one package gets everything they need, with no second, direct
  `@nielspeter/eess` install. A new `family.rules.ts` dogfood gate
  (`check:family`) now asserts this mechanically, and running it against the
  real repo for the first time surfaced genuine gaps in every dialect:
  - **`@nielspeter/eess-mermaid`** was missing `marksAssertsCardinality` — the
    one kernel symbol `conditions/class.ts` used internally that its own
    `core/index.ts` barrel didn't carry.
  - **`@nielspeter/eess-gherkin`** had **zero** kernel re-exports before this
    fix, despite its own `builder.ts` importing `RuleBuilder`, `Condition`,
    `Predicate`, and `ArchViolation` directly. All four are now re-exported.
  - **`@nielspeter/eess-crossvalidate`** — the family's binding tool, and the
    one dialect with no allowlist exception — had none of its 7 flat entry
    files (`mermaid-ts`, `md-ts`, `md-mermaid`, `files`, `md-gherkin`,
    `gherkin-ts`, `md-mermaid-er`) re-exporting the kernel symbols each one
    imports (`correspondence`, `finishPreset`, `ArchViolation`, `Direction`,
    `Selection`, `ElementInfo`, `PresetReportOptions`). Each subpath now
    re-exports exactly what it itself imports.
  - **`@nielspeter/eess-md`** had **zero** kernel re-exports before this fix,
    despite `rules/ledger.ts`/`rules/adr.ts` using `RuleBuilder`, `Predicate`,
    `Condition`, `ConditionContext`, `ArchFix`, `PresetReportOptions`,
    `PresetBaseOptions`, `finishPreset`, `generateCodeFrame`, `not`,
    `dispatchRule`, `validateOverrides` internally. All now re-exported. Also:
    `correspondence`/`CorrespondenceBuilder` — required by this package's own
    README example (`rows()` + `correspondence()`, the flagship way to bind a
    markdown table to code) but never actually re-exported, so that documented
    example did not compile against `@nielspeter/eess-md` alone; found in
    review, fixed the same way.
  - **`@nielspeter/eess-ts`** gained its whole preset-authoring toolkit
    (`reportViolations`, `dispatchRule`, `validateOverrides`,
    `throwIfViolations`, `finishPreset`, `presetConstructsNothingViolation`,
    `RuleSeverity`, `PresetBaseOptions`, `PresetReportOptions`, `ReportMode`,
    `ReportOptions`) at the package root — a convenience, not a gap fix: these
    were already reachable via the `/presets` subpath, and 0088 already
    ratified "root or presets" as satisfying standalone sufficiency for this
    package. No second install was ever required here.

  **Migration:** none needed — every change here is a new, additive re-export.
  Nothing that worked before stops working.

- 7031427: **Breaking (@nielspeter/eess)** — a second `.should()` no longer discards the
  first assertion (bug 0156, the kernel half). 0.x, so a minor signals it.

  The kernel's `RuleBuilder.fork()` cleared the condition list, so
  `.should().X().should().Y()` silently dropped `X`. A rule that asserted two
  things asserted one, and nothing reported the loss — a false green in the
  engine itself.

  **Read this if you write rules with `eess-md`, `eess-mermaid` or
  `eess-gherkin`.** All three extend the kernel's `RuleBuilder`, so all three
  carried this. On upgrade, a rule spelled with two `.should()` calls starts
  enforcing the assertion it was silently dropping, and **can report violations it
  never reported before**. Those findings were always real; they were being
  discarded. Check each one on its merits rather than re-baselining.

  The dialects are named at `minor` rather than inheriting a `patch` because the
  change is observable in their output (bug 0185).

  **`eess-ts` is named too, and it is the one dialect this does not actually
  change.** It carries its own copy of the builder stack, already fixed, so its
  behaviour is identical before and after. `check:release` required it anyway and
  is right to: the rule reads the dependency graph, and eess-ts really does depend
  on `@nielspeter/eess`, so an adopter of eess-ts would otherwise inherit this
  release as a silent patch. That the declaration over-states what changes _for
  that one package_ is a consequence of the duplication, not of the rule — the
  gate cannot know a dialect quietly stopped using the kernel module it depends
  on. Recorded rather than waived.

  **Why it was one-sided.** `eess-ts` got this fix when plan 0165 copied the
  upstream engine in; the kernel did not, and nothing recorded the split. The
  duplication that allows it is [plan 0188](https://github.com/nielspeter/eess/blob/main/work/plans/0188-unify-the-duplicated-engine-modules.md).

### Patch Changes

- Updated dependencies [7031427]
- Updated dependencies [7031427]
- Updated dependencies [26f7352]
- Updated dependencies [7031427]
  - @nielspeter/eess@0.4.0

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
