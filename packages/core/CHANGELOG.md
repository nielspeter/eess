# @nielspeter/eess

## 0.3.0

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

## 0.2.2

### Patch Changes

- 0385ecb: Violations now state what is wrong, and two-sided rules carry their own metadata
  (bugs 0122, 0113).

  **Two visible changes. No violation appears or disappears, and your baseline
  file keeps matching** — violation identity is `rule::element::message`, and none
  of those change.

  **1. The terminal report gains a `What:` line, for every rule.** The formatter
  never printed `message`. For a one-sided rule that was survivable: the element,
  the rule description and the code frame usually carry the meaning. For a
  two-sided rule `message` is the only place the finding lives, so a
  `correspondence()` failure rendered like this:

  ```
    Rule: correspondence
    CLAUDE.md:24 — 099
    Why: the ADR index is a spec: every ADR is listed, every listing is real
  ```

  — a name and a rationale, and no statement of which side drifted. It now reads:

  ```
    What: CLAUDE.md ADR index row "099" has no matching ADR file
  ```

  The whole message is rendered, not just its first line, so a `correspondence()`
  per-side `suggest` remedy — which is appended as a continuation — becomes visible
  too. It was being written and silently dropped.

  **2. `correspondence()` and `tsconfig()` violations carry `ruleId`, `because`,
  `suggestion` and `docs`.** These builders construct violations directly and had
  no path for the rule's own metadata. Concretely, `.rule({ suggestion })` on a
  two-sided rule type-checked, ran, and could never render a `Fix:` line:

  ```ts
  const v = correspondence({ left, right, keyBy })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .because('an index row that names no file is a spec pointing at nothing')
    .rule({ id: 'spec/index-matches-files', suggestion: 'remove the row' })
    .violations()

  v[0].because // was undefined — now the rationale
  v[0].suggestion // was undefined — now 'remove the row'
  ```

  The rationale was the sharper loss on the `.violations()` route — ADR-008's
  caller-owns-reporting path — where it was lost in every format. `--format json`
  returned `"because": null` there; it no longer does. On the `.check()` path the
  default terminal format is unchanged for `because` (it already fell back to the
  rule's reason); `--format json` and `--format github` gain it on both routes.

  One-sided rules built with `RuleBuilder` were never affected — they thread this
  through the condition context, and are unchanged.

  **Choosing between the two remedy routes.** A rule-level `suggestion` is stamped
  onto every violation, including all three branches a `correspondence()` can emit
  — so on a `direction: 'both'` rule, one remedy is shown for "this row has no
  file" _and_ for "this file has no row", where the correct advice is opposite.
  Prefer the per-side `suggest` callbacks when the remedy differs by cause; they
  render now. Reserve `.rule({ suggestion })` for a remedy that is true of every
  way the rule can fail.

  A value a condition computed for a specific violation is never replaced by the
  rule's — `tsconfig()`'s per-key remedy and any per-element `suggestion` survive.

## 0.2.1

### Patch Changes

- README: lead with what the kernel is for rather than the retired acronym. The
  package page is a live surface — it kept showing "Executable Enforceable
  Specification System" after that expansion was removed everywhere else.

## 0.2.0

### Minor Changes

- 2f219de: Catch eess-ts up to ts-archunit 0.17.0 (plan 0071):
  - **`recommended(p)` and `agentGuardrails(p, { src })` presets** — the universal safety floor and the AI-agent-mistakes bundle, in eess's eager ADR-008 form (return `ArchViolation[]`, honour `report`/`format`/`overrides`).
  - **`explain --format agent`** — emits an imperative, sentinel-wrapped rules block for an AI agent's system prompt, built from a new `imperative` field on rule metadata (kernel).
  - **`tsconfig(p).requires(spec)`** — a Tier-1 config-assertion rule asserting resolved TypeScript compiler options (strict-family resolution, enum-by-name rendering).
  - **`eess-ts init`** — scaffolds a working setup (`arch.rules.ts` with the floor preset expanded as editable builders, `eess-ts.config.ts`, npm scripts); `--preset recommended|agent-guardrails`, `--dry-run`, `--force`, `--no-baseline`.

  Kernel: `RuleMetadata`/`RuleDescription` gain an optional `imperative` field; `dispatchRule` accepts full metadata (backward-compatible with the bare-id form).

## 0.1.1

### Patch Changes

- Verify the tokenless release pipeline (OIDC trusted publishing + provenance) end-to-end. No API changes.
