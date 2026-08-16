# @nielspeter/eess-md

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
