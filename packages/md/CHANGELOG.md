# @nielspeter/eess-md

## 0.5.0

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

- 121f46b: `honestyAtClose` is now expressed through the builder DSL (`docs()` / `taskItems()`), not raw corpus iteration — bug 0131.

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** a corpus that
  previously passed `honestyAtClose` silently on a dead or misconfigured selector
  can now fail on upgrade with no code change of its own — this is the same
  "a rule that examines zero units now throws by default" mechanism plan 0088
  landed on the kernel, now reaching this preset.
  - **The header/placement check (`ledger/state-folder-mismatch`) now inherits the fold's fail-closed evidence gate.** Previously `honestyAtClose` hand-iterated the corpus directly, calling no `RuleBuilder`/`TerminalBuilder` — invisible to every kernel-level guarantee, including the zero-examined guard plan 0088 landed. A dead selector (e.g. a `boardFiles` config that absorbed every real document) could pass silently forever. It is now caught by default: an examined-zero header selection fails loudly instead of reading as "nothing to report."
  - **New option `expectEmptyHeaders`.** A corpus that may legitimately hold zero non-board documents right now — a freshly-bootstrapped lane before its first real item is authored — needs to declare this explicitly (it isn't inferrable). Per ADR-010 the declaration expires: the day a real document appears, it must be removed or the build fails on the stale declaration itself.
  - **The two done-item-scoped checks (`ledger/silent-open-box`, `ledger/deferred-none-lie`) are also now protected against a broken selector** — but narrower than the header check: they're guarded against corruption of the specific predicates that scope them (`belongsToADoneItem`, `hasDeferredDisposedBox`), verified by independent sabotage-testing of both, not against corruption of the shared `isDoneItem`/`collectTaskItems` machinery all three checks ultimately depend on. A corpus with an established history (never legitimately zero done-items) should assert that on top, the way `scripts/check-ledger.mjs` now does for this repo's own corpus — see that file for the pattern.
  - Detection logic and messages are unchanged — same regexes, same `findState`/`isDoneItem` helpers, same violation text. Only the iteration mechanism changed; output over the real corpus is byte-identical to before this fix.

  **Migration:** if your own corpus has a lane that may legitimately be entirely board files right now (e.g. a `kit/`-seeded lane before its first item), pass `{ expectEmptyHeaders: true }` to `honestyAtClose` for that lane and remove it once the lane has real content. If a lane's done-item checks previously relied on a silently-broken `belongsToADoneItem`/`hasDeferredDisposedBox`, that's now reported rather than silent — fix the underlying selector.

### Patch Changes

- Updated dependencies [7031427]
- Updated dependencies [7031427]
- Updated dependencies [26f7352]
- Updated dependencies [7031427]
  - @nielspeter/eess@0.4.0

## 0.4.0

### Minor Changes

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

## 0.3.0

### Minor Changes

- 3a4600b: `resolve()` can now resolve a link naming a real directory, even with no index
  file: `LinkResolveOptions.resolveDirectories` (default `false`).

  A link to `./fixed/` (or `./fixed`, no trailing slash — both forms resolve)
  was always reported broken if `fixed/` had no `tryIndex` file inside it, even
  though the directory genuinely exists and GitHub/GitLab render it fine as a
  listing. There was no resolvable shape for "this is a directory" at all —
  `tryIndex` only covers "this directory's page is its index file," a different,
  narrower claim.

  ```ts
  links(c).that().areInternal().should().resolve({ resolveDirectories: true })
  ```

  Directory existence is derived from the corpus's own file index — every
  indexed file's ancestors are known directories — so this costs no new
  filesystem access.

  **Off by default, deliberately.** Widening what "resolves" means is a false
  green waiting to happen: correct for a repo-hosted corpus (GitHub, GitLab
  render any real directory), wrong for a static-site corpus where a bare
  directory with no index is not a page the site would actually serve. Existing
  callers see no behaviour change unless they opt in.

### Patch Changes

- cd0361b: `linkResolves()`'s broken-link message now names the near-miss when the
  target is a real directory: `broken link: "./guide/" does not resolve to a
file in the repo — "docs/guide" is a real directory; this check runs with
resolveDirectories off`.

  Before this, a link to a real directory with `resolveDirectories` off and a
  link to a target that doesn't exist at all reported the identical generic
  message. A corpus that deliberately runs different resolution profiles for
  different regions (a static-site guide vs. repo-hosted markdown, say) gave an
  author no way to tell, from the message alone, which case they'd hit.

  The hint only appears when it's true — a genuinely nonexistent target keeps
  the plain message unchanged — and is computed lazily, only when a violation
  is actually being reported, so a clean corpus pays nothing extra.

- d54b041: Fix `honestyAtClose`/`ledgerStats` silently misreading a `**State:**` line when
  `states` is an empty array — a legitimate config for a lane where nothing is
  ever ledger-closed (a corpus-content vocabulary this repo now uses for its own
  proposals lane, where the review outcome is a separate field, not a second
  `State` token).

  `stateMatcher([])` built its regex's capture group from zero alternatives —
  `()`, a zero-width match that fires at almost any position — so every genuine
  `State:`-shaped line was read as "readable, value `''`" instead of falling
  through to the unreadable-token fallback. Callers passing a non-empty
  `terminalStates` were never affected. A caller passing `terminalStates: []`
  (the only way to trigger this) still got the right answer from `isDoneItem`,
  but only because `[].includes('')` happens to be `false` — not because
  `findState` reported "no known state" for the right reason. `ledgerStats`'s own
  `withReadableState`/`unreadableState` counts were wrong for such a lane: a
  directory full of `State:`-shaped records would report as `withReadableState`
  instead of `unreadableState`, which matters to any caller distinguishing "has
  state-shaped content" from "has content in my declared vocabulary" — exactly
  the distinction a coverage-style check needs.

  Fixed with a one-line guard: an empty vocabulary now never matches, forcing the
  documented unreadable-token fallback for every path. No change to any existing
  caller with a non-empty `states`/`terminalStates`.

## 0.2.0

### Minor Changes

- b8d8517: `honestyAtClose` now actually runs its state↔folder placement check, and lets a
  corpus declare its own `State:` vocabulary (bugs 0118, 0119).

  **Read this before upgrading — the placement check may have been silent in your
  corpus too.** It located the `State:` token by scanning from the top of the
  document and stopping at the **first** `##` heading. The common template puts it
  one heading further down:

  ```markdown
  # Plan 0060: …

  ## Status

  - **State:** Done
  ```

  For any document in that shape the token was never found, so the check returned
  without a word. In the repo this preset was written for, that was **every single
  record** — 55 of 55 with a `State:` line — and the gate reported `0 findings` for
  its entire existence. The region is now the preamble **and the first section**,
  so both shapes are read. Expect placement findings on first run; they are drift
  that was always there.

  **New: `states` and `terminalStates`.** The vocabulary was hard-coded to
  `Draft | Ready | Open | Done | Won't-do`. A corpus with a different one — a bug
  lane closing on `Fixed`/`Rejected`, say — can now declare it:

  ```ts
  honestyAtClose(corpus, {
    states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
    terminalStates: ['Fixed', 'Rejected'],
  })
  ```

  **The value is matched against your declared vocabulary**, not grabbed as the
  next whitespace-delimited run — so `**State: Done**`, `- **State:** Done.`,
  `**State**: Done`, an emphasised `**Done**`, a lowercase `done` and a
  smart-quoted `Won’t-do` all read as the states they obviously are. A colon is
  required, so a prose line like `Stateless rendering is the default` is not a
  state declaration. Multi-word states (`In progress`) work.

  **New finding: `ledger/unknown-state`.** A `State:` token outside the declared
  vocabulary is now reported rather than skipped. Previously an unrecognised token
  looked identical to "no state at all" and disabled the placement check for that
  document silently — a check that stops running without saying so is the failure
  this preset exists to prevent. If you use tokens outside the default set, declare
  them in `states` or correct them; do not expect silence.

### Patch Changes

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
