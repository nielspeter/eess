# @nielspeter/eess

## 0.4.0

> **Upgrading from 0.2.2? Read the 0.3.0 section below as well.**
> 0.3.0 was versioned but **never published to npm** — the last release
> of this package was 0.2.2, so this release carries two minors' worth of
> changes. A `## 0.3.0` heading normally means "a version you already
> have"; here it does not, and some of the changes that will affect your
> build are in it.

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

- 7031427: The baseline records what a measurement COUNTS, and refuses to compare across a change of unit — bug 0171.

  **Breaking (@nielspeter/eess-ts)** — 0.x, so a minor signals it, not a 1.0
  stability claim. A baseline that previously suppressed silently can now report on
  upgrade with no code change of its own, which is the same class as the other
  breaks in this release.

  **Why `eess-ts` is named as the owner and the other dialects are not.** The
  mechanism lives in the kernel's baseline, but only `eess-ts` produces findings
  carrying a `measured` value — `eess-md`, `-mermaid`, `-gherkin` and
  `-crossvalidate` produce none, so their adopters have no baselined measurement
  that could stop comparing. Declaring them would announce a change their users
  cannot observe. If a dialect ever gains a metric finding, this reasoning expires
  and it belongs in the list.

  **Read this if you hold a baseline with metric findings.** An accepted ceiling is
  a number in a unit, and until now the baseline compared across a change of unit
  without noticing. `linesOfCode` changing from span lines to code lines (same
  release) moved every baselined size ceiling by roughly 3x while the identity hash
  stayed put — so entries kept matching, kept suppressing, and a class could grow
  to about three times its accepted size with the build green the whole way.

  Violations now carry `measuredUnit`, baseline entries persist it, and a stored
  measurement is compared only when the units demonstrably agree. When they do
  not, the finding is **reported** rather than silently re-accepted, alongside a
  configuration finding naming the affected elements with both numbers and telling
  you to regenerate.

  **What you will see on upgrade:** if you have baselined `maxClassLines`,
  `maxMethodLines` or `maxFunctionLines` findings, they will be reported once,
  with an explanation. That is the point — your ceilings were recorded in span
  lines and this version measures code lines, so the old numbers cannot be
  compared. Check each element is genuinely acceptable at its new number, then
  regenerate. Baselines for `complexity`, `methods`, `parameters`, `properties`
  and `named-exports` are unaffected: those metrics count what they always
  counted, so old entries stay valid.

  Re-accepting without reading re-baselines whatever drift the old unit was hiding.

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

- 26f7352: `reportViolations` counts the violations it writes, exposed as
  `violationsEmittedCount()`.

  Purely additive: an internal counter and an accessor, no behaviour change. Nothing
  about when or what `reportViolations` emits is different.

  **Why it exists.** A caller that aggregates reporting — `eess-ts check` — needs to
  know whether anything emitted while it was loading a rule file, so it can tell the
  user their `--baseline` / `--changed` did not apply to output that was printed
  before the CLI saw it.

  The version of that check which shipped first counted the writes it **suppressed**
  and read the absence of a suppression as "nothing was written". That is a double
  negative and it is unsound: a rule file that silences one terminal while leaking
  through another satisfies it _while leaking_. Measured — a `report: 'warn'` preset
  beside a silenced `.check()` in one file leaked 7 violation blocks and the run said
  nothing at all. A silence built on a stale signal is worse than the false claim it
  replaced.

  Counting emissions answers the question directly, at the site that does the
  emitting. `eess-ts` counts its own second emitter the same way and reads the sum.

  The accessor is kernel plumbing rather than a surface to write rules against, so
  `eess-ts` does not re-export it.

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
