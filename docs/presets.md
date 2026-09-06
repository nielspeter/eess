# Architecture Presets

Presets are parameterized architecture rule bundles. One function call generates multiple coordinated rules with aggregated error reporting. Use presets as the starting point for new projects — they encode proven patterns from real production codebases.

```typescript
import {
  layeredArchitecture,
  strictBoundaries,
  dataLayerIsolation,
} from '@nielspeter/eess-ts/presets'
```

## `report` — which one you need depends on where you call it

Every preset **runs its rules and throws** on an error-severity violation by
default. That is right in a test and wrong in a rule file, so presets take a
`report` option — the caller owns reporting ([ADR-008](https://github.com/nielspeter/eess/blob/main/adr/008-caller-owns-reporting.md)).

| where                             | pass                     | what happens                                                                                                 |
| --------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **a rule file** (`arch.rules.ts`) | `{ report: 'builders' }` | returns the builders **unrun**, so the CLI runs them, reports once, and applies `--baseline` and `--changed` |
| a test, or your own runner        | `{ report: 'return' }`   | runs them and returns `ArchViolation[]` for you to assert on                                                 |
| advisory, anywhere                | `{ report: 'warn' }`     | reports without failing the run                                                                              |
| _(omitted)_                       | —                        | runs them and **throws** on the first error-severity violation                                               |

> **`'builders'` is an `eess-ts` value, not a family-wide one.** `'return'`,
> `'warn'` and the throwing default come from the kernel's `PresetReportOptions`,
> and every dialect's presets accept them. `'builders'` is `eess-ts`'s own
> `PresetDelivery` — deliberately kept out of the kernel — so `eess-md`'s
> `adrEnforcement` / `honestyAtClose` and the `eess-crossvalidate` presets do
> **not** take it. Those dialects have no aggregating `check` command today, so
> nothing is lost by it; the distinction matters the day one gains one.

```typescript
// arch.rules.ts — the CLI runs these
import { project } from '@nielspeter/eess-ts'
import { recommended } from '@nielspeter/eess-ts/presets'

const p = project('tsconfig.json')

export default [...recommended(p, { report: 'builders' })]
```

### Two traps worth knowing

**`'return'` in a rule file does not work.** A rule file spreads its presets into
`export default [...]`, so `'return'` splats the preset's _result_ — an
`ArchViolation[]` — into the rules array. What happens next depends on your
codebase, and **both outcomes are bad**:

| your codebase  | what you get                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------- |
| has violations | the loader rejects it: `default export entry [0] is not a rule builder (got object)`, exit 1 |
| **is clean**   | the array is **empty**, so the file exports `[]` and every rule silently disappears          |

`tsc --noEmit` catches neither — a spread of the wrong array type is not a type
error. `check` now refuses a rule file that contributed no rules, so the clean case
fails too rather than printing a green tick; before that it exited 0. Use
`'builders'` in a rule file. `eess-ts init` scaffolds it.

**This page has now had this wrong twice**, in both directions — first "a silent
green", then "it fails loudly". Both were half-true and each was written from a
single measurement over a single codebase. The behaviour depends on whether your
project has violations, which is exactly the variable a one-project measurement
cannot see.

**Omitting `report` in a rule file defeats `--baseline`.** The preset then
enforces during module evaluation and prints its own findings, which never pass
through the CLI's filters — so violations you have already baselined are printed
as failures. `check` reports this rather than failing silently, but the fix is
`report: 'builders'`.

`eess-ts init` scaffolds the correct form.

## `layeredArchitecture`

The most universal architecture pattern. Nearly every backend project has layers — routes/controllers at the top, services in the middle, repositories/data access at the bottom. The rule is simple: dependencies flow downward, never upward. A repository must never import from a route. A service must never reach into the HTTP layer.

`layeredArchitecture` enforces this with a single function call. You define your layers in order (top to bottom) and it generates 5 coordinated rules: dependency direction, cycle freedom, innermost isolation, type-import enforcement, and package restrictions.

```typescript
layeredArchitecture(p, {
  layers: {
    routes: 'src/routes/**',
    services: 'src/services/**',
    repositories: 'src/repositories/**',
  },
  shared: ['src/shared/**', 'src/utils/**'],
  strict: true,
})
```

Layer order matters — the first layer depends on the second, the second on the third, etc. In this example: routes → services → repositories. A repository importing from routes is a violation.

### Generated rules

Each generated rule has a stable ID (for overrides) and a default severity. The preset runs all rules and aggregates violations — you see every problem in one error, not one rule at a time.

| Rule ID                              | What it enforces                                                | Default |
| ------------------------------------ | --------------------------------------------------------------- | ------- |
| `preset/layered/layer-order`         | Dependencies flow inward only                                   | error   |
| `preset/layered/no-cycles`           | No circular dependencies between layers                         | error   |
| `preset/layered/innermost-isolation` | Innermost layer imports only from itself + shared (strict mode) | error   |
| `preset/layered/type-imports-only`   | Cross-layer type imports allowed, value imports forbidden       | warn    |
| `preset/layered/restricted-packages` | Only specified layers may import restricted packages            | error   |

### `strict` mode

When `strict: true`, the innermost layer (last in the `layers` object) is fully isolated — it can only import from itself and the `shared` folders. This prevents repositories from reaching into services or routes.

### `typeImportsAllowed`

Some layers need to reference types from other layers without taking a runtime dependency. `typeImportsAllowed` specifies which layers may use `import type` across layer boundaries:

```typescript
layeredArchitecture(p, {
  layers: { ... },
  typeImportsAllowed: ['src/services/**'],
  // Services can `import type { User } from '../repositories/user-repo.js'`
  // but not `import { findUser } from '../repositories/user-repo.js'`
})
```

### `restrictedPackages`

Enforce that certain npm packages are only imported by specific layers. The key is the layer that IS allowed — all other modules in the project are forbidden:

```typescript
layeredArchitecture(p, {
  layers: { ... },
  restrictedPackages: {
    'src/repositories/**': ['knex', 'prisma'],
    'src/infra/**': ['@aws-sdk/*'],
  },
})
```

This generates: "all modules NOT in `src/repositories/**` must not import `knex` or `prisma`". If multiple layers list the same package, the union of those layers may import it.

## `dataLayerIsolation`

Companion to `layeredArchitecture`. Enforces repository pattern conventions that layer ordering alone cannot catch: base class extension and typed error throwing.

```typescript
dataLayerIsolation(p, {
  repositories: 'src/repositories/**',
  baseClass: 'BaseRepository',
  requireTypedErrors: true,
})
```

### Generated rules

| Rule ID                    | What it enforces                                    | Default |
| -------------------------- | --------------------------------------------------- | ------- |
| `preset/data/extend-base`  | All classes in repositories extend the base class   | error   |
| `preset/data/typed-errors` | No `new Error()` in repositories — use typed errors | error   |

Both rules are optional — omit `baseClass` to skip the extension check, omit `requireTypedErrors` to skip the error check.

## `strictBoundaries`

For projects with distinct feature areas (modules, bounded contexts, packages). Prevents cross-contamination between boundaries.

```typescript
strictBoundaries(p, {
  folders: 'src/features/*',
  shared: ['src/shared/**', 'src/lib/**'],
  isolateTests: true,
  noCopyPaste: true,
})
```

### Generated rules

| Rule ID                                 | What it enforces                                     | Default |
| --------------------------------------- | ---------------------------------------------------- | ------- |
| `preset/boundaries/no-cycles`           | No circular deps between boundary folders            | error   |
| `preset/boundaries/no-cross-boundary`   | Each boundary imports only from itself + shared      | error   |
| `preset/boundaries/shared-isolation`    | Shared folders don't import from boundaries          | error   |
| `preset/boundaries/test-isolation`      | Test files don't import from other boundaries' tests | error   |
| `preset/boundaries/no-duplicate-bodies` | No copy-pasted function bodies across boundaries     | warn    |

Boundary folders are discovered dynamically from the glob pattern. `src/features/*` finds all immediate subdirectories under `src/features/`.

## `agentGuardrails`

The mistakes AI coding agents make most often. Every rule is behind its own flag
and **off by default**, so enabling the preset enables nothing until you say what
you want.

```typescript
agentGuardrails(p, {
  src: 'src/**',
  noGenericErrors: true,
  noStubs: true,
  noEmptyBodies: true,
  noCopyPaste: true,
  noVerdictOutsideRules: true,
  ruleFiles: ['scripts/**'],
})
```

### Generated rules

| Rule ID                                 | What it enforces                                                | Default |
| --------------------------------------- | --------------------------------------------------------------- | ------- |
| `preset/agent/no-inline-logic/<api>`    | One rule per named API — no inline call to it                   | error   |
| `preset/agent/no-generic-errors`        | No bare `throw new Error()`                                     | error   |
| `preset/agent/no-stubs`                 | No TODO/FIXME/"not implemented" comments in a body              | error   |
| `preset/agent/no-empty-bodies`          | No empty function body                                          | error   |
| `preset/agent/no-copy-paste`            | No near-identical function bodies                               | warn    |
| `preset/agent/no-verdict-outside-rules` | eess used at runtime, or an emitter called, outside a rule file | error   |

### `noVerdictOutsideRules` — where a verdict may be written

A module that is **not** a rule file, a test, or a file you named in `ruleFiles`
must not import eess as a value (only `import type`), and must not call
`finishPreset` / `reportViolations` / `throwIfViolations`.

That is the "walked around the pipeline" shape in one sentence: eess's loaders
and eess's types imported into ordinary source, with a verdict assembled by hand
beside them. A hand-rolled loop that skips every item looks exactly like one that
checked them all, and nothing counts what was examined.

`ruleFiles` **extends** the default `['**/*.rules.ts', '**/*.test.ts', '**/*.spec.ts']`
rather than replacing it, so naming your gate scripts does not cost you your rule
files.

Globs work exactly as they do everywhere else in `eess-ts`: an **unanchored** one
like `scripts/**` is matched against the path relative to your tsconfig root, so
it names a top-level directory; `**/scripts/**` matches one at any depth. An entry
that matches nothing at all is reported by name as
`preset/agent/rule-files-matches-nothing`, so the list cannot rot in silence.

**If you write your own preset modules, expect a first red on them** — but only
if they live inside `src`. A module that builds rules imports `dispatchRule` at
runtime, so it trips this rule until you name it in `ruleFiles`; that is correct,
because a preset module is a verdict file by definition. **Most adopters see no
such red**: the rule only examines what `src` selects, so a root-level
`arch.rules.ts` or `eess-ts.config.ts` is outside it entirely — exempt by
selection, before the rule-file list is even consulted.

### What it does not reach — read this before trusting it

This is a Tier 1 pattern match, and three things are outside it by construction:

- **Inside a rule file, nothing is checked.** A hand-summed receipt, or a rule
  file that formats and exits on its own, is inside the exemption. Trying to see
  in there is an open-ended search, not a binding.
- **Only modules inside your TypeScript project.** A `.mjs` gate script that sits
  outside every `tsconfig` — a very common shape, this repo ships five — is
  examined by nothing here.
- **A dynamic import destructured under a new name.**
  `const { finishPreset: done } = await import('@nielspeter/eess')` is caught by
  neither condition — the import check does not treat dynamic imports as
  candidates, and the call check matches the callee's text, which is `done`. A
  **static** renamed import (`import { finishPreset as done }`) IS caught.
- **Only `eess-ts`.** The rule needs an AST engine, so an adopter of `eess-md` or
  `eess-gherkin` alone has no equivalent. For them the kernel-side contract in
  [ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
  — the emitter refusing a verdict with no evidence — is the whole protection.

The kernel contract is the braces; this rule is the belt.

## Overrides

Every preset accepts `overrides` to change individual rule severity:

```typescript
layeredArchitecture(p, {
  layers: { ... },
  overrides: {
    'preset/layered/type-imports-only': 'off',    // disable completely
    'preset/layered/no-cycles': 'warn',            // downgrade to warning
  },
})
```

Three severity levels: `'error'` (throws), `'warn'` (logs to stderr), `'off'` (skipped entirely). Unrecognized override keys emit a warning — catches typos.

## Aggregated errors

Presets collect violations from ALL rules before throwing. You see every violation in one error, not just the first failing rule. This makes fixing violations much faster — you see the full picture on every run.

## When to use presets vs. custom rules

Use presets when your project follows a recognized pattern (layered architecture, feature modules, repository pattern). Use custom rules when you need project-specific constraints that presets don't cover.

Presets and custom rules compose freely — run both in the same test file:

```typescript
// Presets handle the structural rules
layeredArchitecture(p, { layers: { ... } })
strictBoundaries(p, { folders: 'src/features/*' })

// Custom rules handle project-specific concerns
functions(p)
  .that().resideInFolder('**/services/**')
  .should().satisfy(mustCall(/Repository/))
  .check()
```
