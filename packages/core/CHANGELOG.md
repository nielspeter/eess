# @nielspeter/eess

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
