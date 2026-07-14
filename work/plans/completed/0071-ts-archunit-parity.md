# Plan 0071: ts-archunit parity — catch eess-ts up to 0.17.0

## Status

- **State:** Done — all five phases delivered and validated 2026-07-14;
  `npm run validate` green end-to-end (1930 tests, all `check:*` gates). Built
  in dependency order; `init` narrowed to the two floor presets (the ADR-008
  wall made a faithful shape-preset scaffold impossible — see Phase 5). One
  scope change from the plan: `init` scaffolds `recommended` + `agent-guardrails`
  only, as builder-expanded rule files, not the eager preset spread.
- **Priority:** P2 — the flagship dialect has silently drifted behind its own
  ancestor (`ts-archunit` 0.17.0). Two of the gaps (`agentGuardrails`,
  `explain --format agent`) are eess's manifesto claim — "grounds AI coding
  agents" — made executable, and eess ships neither today.
- **Effort:** Phase 1 ≈ 0.5 session · Phase 2 ≈ 1 session · Phase 3 ≈ 0.5 session
  · Phase 4 ≈ 1 session · Phase 5 ≈ 1 session.
- **Created:** 2026-07-14

## Problem

`eess-ts` forked `ts-archunit`'s engine and then evolved its own architecture —
the dialect-independent kernel (`@nielspeter/eess`) and ADR-008 caller-owns-
reporting (plan 0070). Most of `ts-archunit`'s feature waves (0.5–0.12:
`jsxText`, `typeAssertion`/`nonNullAssertion`, `identifiedByArg`, `workspace`,
`property()`, `haveArgumentContaining`, JSX) are **already ported**. The
reporting-composition wave (0.16 `checkAll` / `asSeverity` / returning-form
presets) is **solved differently** and deliberately: eess presets already return
`ArchViolation[]` and route reporting through `finishPreset`, so `checkAll` /
`asSeverity` are **not gaps** — porting them verbatim would fight ADR-008.

What remains genuinely missing and ADR-clean (verified by symbol probe against
`packages/ts/src`, 2026-07-14):

| #   | Feature (ts-archunit ver)                                    | Status in eess-ts |
| --- | ------------------------------------------------------------ | ----------------- |
| 1   | `agentGuardrails(p)` preset (0.13)                           | **missing**       |
| 2   | `recommended(p)` preset (0.13)                               | **missing**       |
| 3   | `explain --format agent` + `imperative` metadata (0.13)      | **missing**       |
| 4   | `tsconfig(p).requires(spec)` config-assertion rule (0.15)    | **missing**       |
| 5   | `init` CLI scaffolder (0.14 + 0.17 shape-preset scaffolding) | **missing**       |

Already present and needing no work: `codeFrame` in `check --format json`,
returning-form presets (as eager `ArchViolation[]`), per-rule severity (via
`dispatchRule` + `overrides`).

### The adaptation, stated once

`ts-archunit`'s returning-form presets return **lazy `RuleBuilderLike[]`** with
severity attached by `.asSeverity()`, executed later by `checkAll` / the CLI.
eess's ADR-008 presets return **eager `ArchViolation[]`** — they run each rule
through `dispatchRule(builder, id, defaultSeverity, overrides)` (which handles
`off` / `warn` / `error` at collection time) and end with
`finishPreset(violations, options)`. So the ported presets are **re-shaped, not
copied**: no `.asSeverity()`, no lazy builders — the `SPECS`/`push` tables map
onto `dispatchRule` calls. This is the single idea behind every phase below.

## Implementation phases

### Phase 1 — `imperative` metadata, threaded (kernel)

The prerequisite for both the AI presets and `explain --format agent`: a rule's
one-line imperative ("Do NOT call eval()") must exist on `RuleMetadata`, survive
into `RuleDescription` (so `describeRule()` / `explain` see it) and into
per-violation output (so `check --format json` carries it), and be settable by a
preset through `dispatchRule`.

- `packages/core/src/rule-metadata.ts` — add `imperative?: string` to
  `RuleMetadata`.
- `packages/core/src/rule-description.ts` — add `imperative?: string` to
  `RuleDescription`; ensure whatever builds a `RuleDescription` from `.rule()`
  metadata copies it (same path `because` / `suggestion` take).
- `packages/core/src/preset-dispatch.ts` — widen `dispatchRule`'s `ruleId`
  parameter to `string | RuleMetadata` (string → `{ id }`, object → used as-is),
  backward-compatible for existing `layered` / `data-layer` / `boundaries`
  callers. This is what lets a ported preset attach `because` / `suggestion` /
  `imperative` instead of only an id.

```ts
// preset-dispatch.ts — backward-compatible widening
export function dispatchRule(
  builder: Dispatchable,
  rule: string | (RuleMetadata & { id: string }),
  defaultSeverity: RuleSeverity,
  overrides: Record<string, RuleSeverity> | undefined,
): ArchViolation[] {
  const meta = typeof rule === 'string' ? { id: rule } : rule
  const effective = overrides?.[meta.id] ?? defaultSeverity
  if (effective === 'off') return []
  const violations = builder.rule(meta).violations()
  if (effective === 'warn') {
    if (violations.length > 0) console.warn(formatViolations(violations))
    return []
  }
  return violations
}
```

**Files changed:** `rule-metadata.ts`, `rule-description.ts`,
`preset-dispatch.ts` (+ the `describeRule` builder if `imperative` isn't
auto-copied). **Tests:** kernel unit — `imperative` round-trips metadata →
description → violation; `dispatchRule` accepts both a bare id and a metadata
object; existing severity behavior unchanged.

### Phase 2 — `recommended` + `agentGuardrails` presets (eess-ts)

Port `ts-archunit/src/presets/recommended.ts` and `agent-guardrails.ts`, re-shaped
to the eager model. The rule bundles, ids, and `because`/`suggestion`/`imperative`
copy are lifted verbatim (they're generic — no client framing); the execution
mechanism becomes `dispatchRule` + `finishPreset`.

```ts
// packages/ts/src/presets/recommended.ts (eager ADR-008 shape)
export function recommended(p: ArchProject, options: RecommendedOptions = {}): ArchViolation[] {
  const include = options.include ?? '**/src/**'
  validateOverrides(options.overrides, RULE_IDS)
  const violations: ArchViolation[] = []
  for (const { condition, meta, default: def } of SPECS) {
    violations.push(
      ...dispatchRule(
        functions(p).that().resideInFile(include).should().satisfy(condition),
        meta, // full metadata (id + because + suggestion + imperative)
        def,
        options.overrides,
      ),
    )
  }
  return finishPreset(violations, options)
}
```

`agentGuardrails` follows the same swap: each `push(builder, meta, def)` becomes a
`dispatchRule(builder, meta, def, overrides)` accumulate; `noCopyPaste` uses the
existing `smells.duplicateBodies(p)` entry point. `collectRuleIds` /
`validateOverrides` carry over unchanged.

- `packages/ts/src/presets/recommended.ts`, `agent-guardrails.ts` — new.
- `packages/ts/src/presets/index.ts` — export both + their options types.
- Confirm the rule deps exist in eess-ts: `functionNoEval`,
  `functionNoFunctionConstructor` (`rules/security`), `functionNoSilentCatch`,
  `functionNoGenericErrors` (`rules/errors`), `noEmptyBodies`, `noStubComments`
  (`rules/hygiene`), `smells.duplicateBodies`. (Probe showed the rule files exist;
  verify the exact export names at build.)

**Tests:** fixture-based preset tests mirroring ts-archunit's — a clean fixture
yields no error violations; a violating fixture (eval, generic error, stub, empty
body, dup body) yields the expected ids; `overrides` flips severity; `report:
'return'` yields the array without throwing (ADR-008).

### Phase 3 — `explain --format agent` (eess-ts CLI)

Port `outputAgent` from `ts-archunit/src/cli/commands/explain.ts` into eess's
`packages/ts/src/cli/commands/explain.ts`, and add `agent` to the `explain`
format set. eess's `explain.ts` already avoids the `as` cast ts-archunit uses in
`isDescribable` (ADR-005) — keep it that way. Sentinel markers become
`<!-- eess-ts:start -->` / `<!-- eess-ts:end -->`; the verify-loop preamble points
at `eess-ts check --format json`.

- `packages/ts/src/cli/commands/explain.ts` — add `outputAgent` + `titleCase`,
  branch on `format === 'agent'`, surface `d.imperative`.
- `packages/ts/src/cli/index.ts` — accept `--format agent` for `explain`
  (the format-validity gate at index.ts:~187 already whitelists per-command; add
  `agent` to the explain set), update usage text.

**Tests:** CLI test — `explain --format agent` over a rule file using
`agentGuardrails` emits the sentinel-wrapped imperative block grouped by id
namespace; empty rule set emits the "_No rules found._" block; `imperative`
falls back to `rule` text when unset.

### Phase 4 — `tsconfig(p).requires(spec)` config rule (eess-ts)

Port `ts-archunit/src/tsconfig/tsconfig-builder.ts` (+ its `strict-family.ts`
helper: `isStrictFamily`, `resolveFlag`). A `TerminalBuilder` subclass (one
project → one options object, like `smells`), so it composes with `.because()` /
`.excluding()` / `.check()` / `.warn()` / `report`. One violation per mismatched
flag; flag name is the `element`.

- `packages/ts/src/tsconfig/tsconfig-builder.ts`, `strict-family.ts` — new.
- `packages/ts/src/index.ts` — export `tsconfig` entry point + `TsconfigBuilder`.
- **Integration point to verify:** `TsconfigBuilder` reads
  `project.tsConfigPath`, `project.getCompilerOptions?.()`, and falls back to
  `project._project.getCompilerOptions()`. Confirm eess's `ArchProject`
  (`core/project.ts`) exposes these (probe showed a `tsConfigPath` doc comment);
  adapt the accessor if the names differ. Must stay ADR-005-clean (no `as`).

**Tests:** fixture tsconfigs — a matching spec passes; a mismatch emits one
violation per flag with enum-by-name rendering (`target: ES2022`, not `9`);
`strict: true` resolves the nine sub-flags; an explicit `"strictNullChecks":
false` under `strict: true` yields the "remove the override" suggestion;
`lib`/`types` compared order-insensitively.

### Phase 5 — `eess-ts init` scaffolder (narrow port)

Port `ts-archunit/src/cli/commands/init.ts`, scoped to **eess-ts only** (scaffold
a TS `arch.rules.ts` + `eess-ts.config.ts` + npm scripts). Source-root detection
from tsconfig `include`/`rootDir`; non-destructive (`--force`, `--dry-run`,
`--no-baseline`); brownfield closing message.

**Decision (the ADR-008 wall, resolved):** ts-archunit's init scaffolds
`export default [...preset(p)]`, but _every_ eess preset returns eager
`ArchViolation[]` — which eess's CLI rule-file loader **rejects** (rule files are
builder arrays; presets are for test/harness use). So a faithful port is
impossible. eess `init` instead **expands the floor preset into builders** in the
generated `arch.rules.ts` (CLI-loadable, visible, editable) — arguably better for
learning than an opaque preset spread. Scoped to the two **floor** presets that
expand cleanly: `recommended` (default) and `agent-guardrails`. The shape presets
(`layered` / `strict-boundaries` / `data-layer`) are **not** scaffolded — they'd
need a test-file form; left to a follow-up. Chosen over a test-file init because
every eess gate the user will meet is a CLI rule file; the scaffold should teach
that shape.

- `packages/ts/src/cli/commands/init.ts` — new.
- `packages/ts/src/cli/index.ts` — add `init` command + usage.
- **Family-init is explicitly deferred** (see Out of scope): this ships
  `eess-ts init`, not a family-level `eess init` spanning md/mermaid/gherkin.

**Tests:** CLI test — `init --dry-run` previews the files; `init` writes
`arch.rules.ts` / config / scripts; `--preset agent-guardrails` scaffolds that
preset; `--force` overwrites, default refuses; source root derived from a
fixture tsconfig.

## Out of scope

- **`checkAll` / `asSeverity`** — ts-archunit's lazy-builder severity API. eess's
  eager `dispatchRule` + `finishPreset` (ADR-008) is the equivalent; porting
  these would create two parallel reporting models. Explicitly not a gap.
- **Family-level `eess init`** — an `init` that also wires the md / mermaid /
  gherkin / crossvalidate gates. A real idea, but it faces a scoping question
  ts-archunit never had (eess is a family); design it as its own plan if demand
  appears. Phase 5 ships the faithful `eess-ts init` only.
- **Dogfooding `recommended` / `agentGuardrails` on this repo** — eess already
  runs `arch.rules.ts` / `arch.internal.rules.ts`; adopting the new presets on
  itself is a separate decision, not part of catching the dialect up.
- **New ADR** — these are additive features within existing decisions (ADR-006
  presets-are-functions; ADR-008 reporting). The only kernel change is the
  `imperative` field, which extends ADR-008's metadata surface without changing
  its contract. No new ADR unless review disagrees.

## Success definition

- `recommended`, `agentGuardrails`, `tsconfig` exported from `@nielspeter/eess-ts`;
  `explain --format agent` and `eess-ts init` work from the CLI.
- Every ported preset returns `ArchViolation[]` and honours `report` / `overrides`
  (ADR-008 + ADR-006), with no `.asSeverity()` / lazy-builder path introduced.
- `imperative` round-trips metadata → description → violation, and surfaces in
  both `explain --format agent` and `check --format json`.
- ADR-005 clean (no `any`, no `as`) across all ported code — the fork used one
  `as` cast in `isDescribable`; the eess port must not.
- `npm run validate` green end-to-end (build order, typecheck, lint, format, all
  `check:*` gates, full test suite).
- eess-ts README / api docs updated for the three new entry points + two CLI
  affordances; `check:corpus` / `check:spec` green.

## Progress ledger

- [x] Phase 1 — `imperative` metadata + `dispatchRule` metadata threading (kernel) — done 2026-07-14; kernel+ts build, 32 core tests pass (4 new in `preset-dispatch.test.ts`)
- [x] Phase 2 — `recommended` + `agentGuardrails` presets (eess-ts) — done 2026-07-14; eager ADR-008 shape, exported from `./presets`, 12 fixture tests pass. `imperative` metadata threads through `dispatchRule` → violation `ruleId`/`because`.
- [x] Phase 3 — `explain --format agent` (eess-ts CLI) — done 2026-07-14; ported `outputAgent` (sentinels `<!-- eess-ts:start/end -->`, verify-loop preamble, id-namespace grouping), `--format agent` threaded through `handleExplain`, 28 explain tests pass (4 new). ADR-005 clean (no `!` in `titleCase`).
  - **Design note (ADR-008 consequence):** eess's `explain`/`check` CLI consumes **builder** rule files (`.describeRule()`); the eager ADR-008 presets return executed `ArchViolation[]`, so they don't self-describe through `explain`. This is intentional: eess's idiom is to author describable rules as builders carrying `.rule({ imperative })`, which `explain --format agent` serves fully. The preset imperatives remain baked in for enforcement. A builder-returning companion for the presets (so they self-describe) is a possible follow-up, not part of this port.
- [x] Phase 4 — `tsconfig(p).requires()` config rule (eess-ts) — done 2026-07-14; `TsconfigBuilder` + `strict-family` ported (adapted `getOptions()` to eess's `_project`), exported from index, 9 tests pass. ADR-005 clean.
- [x] Phase 5 — `eess-ts init` scaffolder (narrow) — done 2026-07-14; floor presets only (`recommended` default + `agent-guardrails`), generated `arch.rules.ts` is **builder-expanded** (CLI-loadable, verified end-to-end: init → check detects violations → explain --format agent emits imperatives). Source-root detection, `--force`/`--dry-run`/`--no-baseline`, package.json script merge. 10 tests pass. ADR-005 clean.
- [x] Docs + `validate` green + changeset — done 2026-07-14; eess-ts README updated (floor presets, `init`, `explain --format agent`, `tsconfig` entry point), changeset `.changeset/ts-archunit-parity.md` (minor: eess + eess-ts), `npm run validate` green.

**Deferred:** none. **Out-of-scope items** (shape-preset `init` scaffolding, a builder-returning companion so the eager presets self-describe through `explain`, family-level `eess init`, `checkAll`/`asSeverity`) are recorded in the Out-of-scope section as follow-ups, not silently dropped work.
