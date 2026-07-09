# Plan 0059: Cross-Validation Primitive — `@nielspeter/eess-crossvalidate`

## Status

- **State:** IMPLEMENTED 2026-07-03/04 on branch `eess-consolidation` (not merged/published). **All phases done:** kernel engine — `Selection<T>`, `RuleBuilder.select()`, `correspondence()` (TerminalBuilder; keyBy/matchBy, beComplete({direction}) + duplicate detection, preserveRelations), on the shared `matchSelections()` matching engine (12 kernel tests); `@nielspeter/eess-crossvalidate` package with `mermaid-ts` `diagramMatchesCode()` (walkthrough stage 6/7 parity), `md-ts` `adrCitationsResolve()` (AST-grounded, ADR-007-clean), and `md-mermaid` `embeddedDiagramsMatchCode()` (embedded ```mermaid blocks validated like .mmd, violations at the md file); `crossLayer`delegates to the shared engine +`@deprecated`; preset-dispatch hoisted to kernel; walkthrough updated to the real API. 8 crossvalidate tests. **Full suite 2045 green across 6 packages.** Remaining is only the external cutover (shared with 0051: publish, rename, etc.), gated by the user. **Matching-engine unification DONE** (commit `06a6ca8`): the review's core anti-duplication concern is resolved — `matchSelections()`is now the single matching engine in the kernel, and BOTH`correspondence()`and`crossLayer.computePairs`delegate to it (no second pair-matching implementation).`crossLayer`keeps its API +`LayerPair`output identical, so all 1910 eess-ts tests pass unchanged; it stays`@deprecated`pointing at`correspondence()`. Judged unnecessary: physically moving `PairCondition`to the kernel — it is a deprecated crossLayer-specific condition over`LayerPair`, not a generic engine type; the generic pieces (`Pair<L,R>`, `matchSelections`) now live in the kernel. **REMAINING (lower-value, deferred):** (a) embedded-Mermaid-in-Markdown block cross-checks (Phase 6); (b) walkthrough/manifesto doc updates (Phase 7). The "Review outcome" section records the design.
- **Priority:** P1 once 0058 lands (third in the work order: 0051 → 0058 → **0059** → workflow dialect, future plan)
- **Effort:** ~1.5 weeks
- **Created:** 2026-07-03
- **Depends on:** Plan 0051 (kernel + sibling dialect packages), plan 0058 (corpus model: fenced blocks with language tags, pointer/citation elements). Conceptually implements the manifesto's core claim: _"Spec and code are validated against each other. Neither is privileged in isolation."_

## Review outcome (2026-07-03 — architect + product)

**Verdict: valuable capability, wrong framing — do not implement as written.** Both
reviewers independently caught the same Critical issue: the plan's premise that
cross-validation is "the missing primitive" is **factually wrong**. A generic,
two-sided, generic-over-`<A,B>` pair-correspondence engine **already ships in
`eess-ts`** (plan 0022, Done) and the plan never mentions it:

| 0059 proposes                       | Already exists (eess-ts)                                                     | Location                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `matchBy: (l,r)=>boolean` + pairing | `mapping(fn)` + `computePairs` (Cartesian)                                   | `packages/ts/src/builders/cross-layer-builder.ts:27-46,83` |
| `beComplete()`                      | `haveMatchingCounterpart(layers)` (same semantic)                            | `packages/ts/src/conditions/cross-layer.ts:15-58`          |
| `beCoComplete()`                    | same, sides swapped                                                          | same file                                                  |
| `preserveRelations({left,right})`   | `haveConsistentExports(extractLeft, extractRight)`                           | `packages/ts/src/conditions/cross-layer.ts:66-99`          |
| custom correspondence               | `satisfyPairCondition(desc, fn)`                                             | `packages/ts/src/conditions/cross-layer.ts:107-124`        |
| "ordinary RuleBuilder chain"        | `PairFinalBuilder extends TerminalBuilder` (because/warn/excluding/baseline) | `cross-layer-builder.ts:141`                               |
| generic-over-both-sides pair        | `LayerPair<A=SourceFile,B=SourceFile>`                                       | `packages/ts/src/models/cross-layer.ts`                    |

Left as-is, 0059 builds a **third** pair-matching engine (kernel `Selection` +
a `crossvalidate` package) alongside the one in `eess-ts` and the `fromDiagram`
bridge — the exact duplication failure the review exists to catch.

**The genuine new capability is real but narrow:** `crossLayer` resolves both
sides by glob **within one `ArchProject`**, so it cannot bind **two different
dialects/loaders** (diagram vs project, corpus vs project). The `Selection`-based
`correspondence()` consuming two loaders is the correct _generalization_ — and is
arguably what `crossLayer` should have been built on.

**Required rewrite (must-address):**

1. **Reconcile with the existing engine.** `correspondence()` becomes the general
   engine; **`crossLayer` is refactored into a thin `eess-ts` preset over it**
   (two glob-built selections + `correspondence()`); `PairCondition`/
   `CrossLayerBuilder` are **deprecated with an alias**, mirroring the
   `fromDiagram` deprecation the plan already writes. Add the acknowledgment +
   the refactor-vs-coexist decision (refactor is the only non-duplicating answer)
   - the migration path.
2. **One home, not three.** `Selection<T>` (kernel) and `correspondence()` (its
   only consumer) should live together — put `correspondence()` +
   `beComplete/beCoComplete/preserveRelations` in the **kernel** (`@nielspeter/eess`;
   pure over `Selection` + callbacks, zero deps, like `not/and/or`/`baseline`),
   and keep only the **dialect-coupled presets** (`mermaid-ts`, `md-ts`) in the
   `crossvalidate` package. Or justify explicitly why `correspondence()` isn't
   kernel-resident when `Selection` is.
3. **Fix the fluent grammar (ADR-003).** `.and()` is the predicate-AND no-op in the
   kernel (`rule-builder.ts:49-51`); condition-AND is `.andShould()`
   (`rule-builder.ts:68-70`). And this builder operates over two selections, so —
   like `PairFinalBuilder` — it is a **`TerminalBuilder` subclass, not a
   `RuleBuilder<T>`**; correct the "ordinary kernel RuleBuilder" claim.
4. **ADR-007 engine boundary.** State that the presets consume only dialect
   **public element APIs**, never `ts-morph`, and that kernel `Selection<T>` stays
   engine-neutral (`T` opaque, `T[]` + label + neutral source metadata only).
5. **Scope claims honestly.** `not/and/or` combinators operate on
   `Predicate/Condition`; the pair-conditions do **not** compose with them (same
   limit `PairCondition` has). Add a `keyBy`/`indexBy` fast path (O(n+m)) beside
   `matchBy` (O(n×m)) — a corpus×codebase Cartesian product is a perf cliff.
   Rename `beCoComplete()` (non-obvious jargon) → e.g.
   `beComplete({ direction })` or `beMutuallyComplete()`.

**Praise worth keeping:** the `Selection` + `.select()` design is genuinely better
than `crossLayer`'s parallel `.layer().mapping()` builder; `.select()` is a clean,
minimal kernel addition (`RuleBuilder` already computes the filtered set,
`rule-builder.ts:305-309`); the duplicate-match rigor ("two rights match one left
→ explicit violation") is strictly better than `computePairs`'s silent
many-to-many — fold it back into the refactored `crossLayer`. The own-package home
for dialect-coupled presets (avoiding an inter-dialect dependency) is correct.

## Problem

Every dialect validates its own artifact in isolation: `eess-ts`
checks code, `eess-mermaid` checks diagrams, `eess-md` checks the
corpus. Nothing checks that **two different artifacts agree**. The
walkthrough's payoff moment (stage 7 — agent adds `ModuloOperation` to
code, forgets the diagram, build fails) is exactly the check no single
dialect can express alone.

**Cross-validation is not new to the family — it exists, but only within
one loader.** `eess-ts` already ships a two-sided pair-correspondence
engine (plan 0022, Done): `crossLayer(p).layer(…).layer(…).mapping(fn)
.forEachPair().should(…)`, with `haveMatchingCounterpart`,
`haveConsistentExports`, `satisfyPairCondition`, the generic
`PairCondition<A, B>` / `LayerPair<A, B>` types, and a
`PairFinalBuilder extends TerminalBuilder` giving `because`/`warn`/
`excluding`/baseline for free. It works, is exported, tested, and
documented (`docs/cross-layer.md`). But `crossLayer` resolves **both
sides by glob within a single `ArchProject`** (`resolveLayer` →
`project.getSourceFiles()`), so it can pair a route folder against a
schema folder — it **cannot bind two different loaders**: a diagram
against a project, a corpus against a project.

That is the real gap. Two other narrow workarounds skirt it:

- **typed-mermaide's `fromDiagram()` bridge** — one-directional
  (diagram → folder-based code rules), lossy (classes flattened to
  folders). Plan 0051 already calls it "a workaround for the artificial
  split."
- **the external repo's text-level citation check** (shipped in 0058's
  `adrEnforcement`) — a cited `it('…')` matched by regex, not AST, so it
  misses template-literal titles, `it.each`, and same-string-moved tests.

The fix is **not a new primitive from scratch — it is the generalization
the existing engine should have been built on**: bind two element
**selections** produced by _any_ loaders, match them, and check
completeness both ways and relation preservation. Then `crossLayer`
becomes a thin case of it, and `fromDiagram` and the text citation check
are replaced by real, two-sided, AST-grounded correspondences.

## Design principle

Per the lego-bricks rule, the generic engine — `correspondence()` over
`Selection<T>` — is **one primitive with one home: the kernel**
(`@nielspeter/eess`). It is pure over `Selection` + caller callbacks,
has zero dialect knowledge and zero parser deps, and sits beside the
other engine-neutral kernel pieces (`not/and/or`, `define*`, `baseline`,
`PairCondition`). The `@nielspeter/eess-crossvalidate` package ships
**only the dialect-coupled presets** — the pairs that must import two
concrete dialects.

```
@nielspeter/eess                          # Selection<T>, .select(), correspondence(),
                                          #   beComplete/preserveRelations, PairCondition<A,B>
@nielspeter/eess-ts                       # crossLayer() → refactored into a preset over correspondence()
@nielspeter/eess-crossvalidate/mermaid-ts # diagramMatchesCode() — peers: eess-mermaid, eess-ts
@nielspeter/eess-crossvalidate/md-ts      # adrCitationsResolve() — peers: eess-md, eess-ts
```

Why the kernel, not a standalone `crossvalidate` core: `Selection<T>` is
already a kernel addition, and `correspondence()` is its only consumer —
splitting them across two packages is the "three homes for one concept"
smell. Keeping the engine in the kernel is also what lets `eess-ts`'s
`crossLayer` be refactored onto it without a new cross-package dependency.

## Reconciliation with `crossLayer` / `PairCondition` (load-bearing)

This plan **must not** add a second pair-matching engine. The existing
one is refactored onto `correspondence()`:

| Existing (`eess-ts`, plan 0022)                                     | Becomes                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `crossLayer(p).layer(g).layer(g).mapping(fn).forEachPair()`         | sugar that builds two glob `Selection`s + calls `correspondence()`                                     |
| `haveMatchingCounterpart(layers)`                                   | `correspondence().should().beComplete({ direction })`                                                  |
| `haveConsistentExports(l, r)`                                       | `correspondence().should().preserveRelations({ left, right })`                                         |
| `satisfyPairCondition(desc, fn)`                                    | kept — the generic escape hatch, now a kernel export                                                   |
| `PairCondition<A, B>` (in `packages/ts/src/core`, imports ts-morph) | **moved to the kernel**, ts-morph `SourceFile` default dropped (`PairCondition<A, B>`, engine-neutral) |
| `CrossLayerBuilder` / `MappedCrossLayerBuilder`                     | **deprecated** (`@deprecated`, alias-kept), same policy as `fromDiagram`; removed at 1.0               |

`crossLayer` stays callable (deprecated) so existing plan-0022 users see
no break; internally it delegates to the new primitive. The duplicate-match
rigor 0059 introduces ("two rights match one left → explicit violation")
is strictly better than the current `computePairs` silent many-to-many —
it is folded into the shared engine, improving `crossLayer` too.

## API shape

### Kernel prerequisite: `Selection<T>` + `.select()`

`correspondence()` consumes element selections, not assertions. Rule
builders gain a `.select({ label })` terminal that returns a
`Selection<T>` — the already-filtered elements (`RuleBuilder` computes
`allElements.filter(predicates)` internally) plus a human label and
engine-neutral source metadata. `Selection<T>` is **engine-neutral**:
`T` is opaque, the payload is `T[]` + label + neutral source info, no
ts-morph. Small, additive kernel change; a future workflow dialect gets
cross-validation for free. `.select()` lands on `RuleBuilder<T, P>`, so
it is available on `classes/functions/modules/docs/links` but not on the
`TerminalBuilder`-based builders (slices, pairs) — state that boundary.

### The primitive

`correspondence()` returns a **`TerminalBuilder` subclass** (it operates
over two selections, exactly like the existing `PairFinalBuilder`) — not
a `RuleBuilder<T>`. It therefore inherits `.because()`, `.rule()`,
`.warn()`, `.severity()`, `.excluding()`, baseline, and the formatters
from `TerminalBuilder` — but it does **not** compose with the
`not/and/or` combinators (those operate on `Predicate/Condition<T>`; a
pair-condition is neither — the same limitation `PairCondition` has).
Chain multiple checks with the family's condition-AND, `.andShould()`
(not `.and()`, which is the predicate-AND no-op).

```typescript
import { correspondence } from '@nielspeter/eess'
import { project, classes as tsClasses } from '@nielspeter/eess-ts'
import { diagram, classes as mmdClasses } from '@nielspeter/eess-mermaid'

const p = project('tsconfig.json')
const d = diagram('docs/architecture.mmd')

correspondence({
  left: mmdClasses(d).select({ label: 'diagram class' }),
  right: tsClasses(p).that().resideInFolder('src/**').select({ label: 'TS class' }),
  keyBy: (el) => el.name, // fast path: O(n+m) join on a key (default)
  // matchBy: (l, r) => …    // general fallback: O(n×m), only when no key exists
})
  .should()
  .beComplete({ direction: 'both' }) // 'left-to-right' | 'right-to-left' | 'both'
  .rule({ id: 'crossval/diagram-completeness' })
  .check()
```

`keyBy` (extract a join key per element) is the default fast path —
`matchBy` (arbitrary predicate) is the O(n×m) fallback for when no key
exists, since a corpus × codebase Cartesian product is a real perf cliff.
Completeness is one condition with a `direction` option (replacing the
non-obvious `beComplete()`/`beCoComplete()` pair): `left-to-right` = every
left has a right, `right-to-left` = the reverse, `both` = mutual.

Relationship preservation — an edge on one side must have a matching
relation on the other:

```typescript
correspondence({ left, right, keyBy })
  .should()
  .preserveRelations({
    left: (dc) => dc.relationships({ arrows: ['..>', '-->'] }), // "uses" edges
    right: (tc) => tc.dependencies(), // imports
    direction: 'both',
  })
  .check()
```

Violations are **two-sided and actionable**, generated from the
selection labels (walkthrough stage 7 verbatim is the acceptance bar):

```
✗ crossval/diagram-completeness:
  TS class ModuloOperation has no matching diagram class in docs/architecture.mmd

  Either:
    - add `class ModuloOperation` and `Operation <|.. ModuloOperation` to docs/architecture.mmd
    - or remove src/operations/modulo.ts
```

### Preset: `diagramMatchesCode()` (Mermaid↔TS)

```typescript
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'

diagramMatchesCode(d, p, {
  scope: 'src/**',
  checks: {
    completeness: 'both', // classes exist on both sides
    dependencies: true, // -->, ..>, o--, *-- edges ↔ imports/holds
    inheritance: true, // <|-- / <|.. ↔ extends / implements
  },
  // %% @id directives in the diagram override name matching
})
```

Composed entirely from `correspondence()` calls. **Supersedes and
deprecates typed-mermaide's `fromDiagram()` bridge** — class-level
correspondence instead of folder flattening, both directions instead
of one.

### Preset: `adrCitationsResolve()` (MD↔TS)

```typescript
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'

adrCitationsResolve(c, p, { dir: 'docs/adr/**' })
```

Upgrades 0058's text-level check to AST-grounded: cited test files are
loaded through `eess-ts`'s **public element API** and cited `it('…')`
titles are resolved against actual test call expressions (including
`it.skip`, `describe` nesting, and `it.each` where titles are statically
decidable). A `pending` clause citing an `it.skip` is verified as
_existing and skipped_ — the ratchet becomes checkable. Designed as a
drop-in replacement: `adrEnforcement(c, { verifyCitations: 'text' })`
users flip to the preset when they add `eess-ts`.

**ADR-007 boundary (binding).** The presets consume only each dialect's
**public element API** — never `ts-morph` directly. `ts-morph` stays
inside the `eess-ts` engine adapter; `@nielspeter/eess-crossvalidate` and
the kernel `Selection<T>` never import it. Any AST access the `md-ts`
preset needs (resolving an `it()` title) goes through an `eess-ts` export,
added there if missing, not by reaching into ts-morph from this package.

## Implementation phases

### Phase 1 — Kernel engine: `Selection<T>` + `correspondence()` (~2.5 days)

All of this lands in `@nielspeter/eess` (the kernel), not a separate
package.

1. `.select({ label })` terminal on `RuleBuilder<T, P>` returning an
   engine-neutral `Selection<T>` (`T[]` + label + neutral source
   metadata; reuses the internal `allElements.filter(predicates)`).
2. **Move `PairCondition<A, B>` into the kernel**, dropping the ts-morph
   `SourceFile` default so it is engine-neutral (`PairCondition<A, B>`).
3. `correspondence()` → a `TerminalBuilder` subclass over
   `Selection<L>`/`Selection<R>` with `keyBy` (default, O(n+m)) and
   `matchBy` (fallback, O(n×m)); conditions `beComplete({ direction })`
   and (Phase 2) `preserveRelations`. Duplicate-match detection ("two
   rights match one left → explicit violation, not silent first-match").
4. Two-sided violation message templating from labels + per-side
   suggestion callbacks.

**Files:** `packages/core/src/selection.ts` (new),
`packages/core/src/correspondence.ts` (new),
`packages/core/src/pair-condition.ts` (moved from `packages/ts/src/core`),
`packages/core/src/index.ts` (exports), `packages/core/tests/*`.

### Phase 2 — `preserveRelations()` (~1 day)

5. Relation extraction callbacks per side; matching of relation
   endpoints through the established correspondence; `direction` option.
6. Violation messages name both the missing relation and its counterpart
   evidence ("edge `Calculator ..> Registry` has no matching import in
   src/core/calculator.ts").

**Files:** `packages/core/src/correspondence.ts` (extend),
`packages/core/tests/*`.

### Phase 3 — Refactor `crossLayer` onto the primitive (~1.5 days)

The load-bearing anti-duplication step. `crossLayer` must not remain a
second engine.

7. Reimplement `crossLayer(p).layer().layer().mapping().forEachPair()` as
   sugar that builds two glob `Selection`s and delegates to
   `correspondence()`. `haveMatchingCounterpart` → `beComplete`;
   `haveConsistentExports` → `preserveRelations`; `satisfyPairCondition`
   re-exported from the kernel.
8. Deprecate `CrossLayerBuilder`/`MappedCrossLayerBuilder`/`PairCondition`
   re-export in `eess-ts` (`@deprecated`, alias-kept; removal is a 1.0
   concern, same policy as `fromDiagram`). All existing plan-0022
   `crossLayer` tests must stay green against the delegating implementation.

**Files:** `packages/ts/src/builders/cross-layer-builder.ts` (delegate +
deprecate), `packages/ts/src/conditions/cross-layer.ts` (delegate),
`packages/ts/src/core/pair-condition.ts` (re-export from kernel,
deprecated), existing `packages/ts/tests/**/cross-layer*` (unchanged, must pass).

### Phase 4 — `mermaid-ts` preset (~2 days)

9. `diagramMatchesCode()` composing completeness + dependencies +
   inheritance; `%% @id` directive support in the key/match function.
10. Walkthrough-parity fixture: the calculator diagram + mini TS
    project; stage 6 (all green) and stage 7 (ModuloOperation drift,
    exact message shape) as tests.
11. Deprecate `fromDiagram()` in `eess-mermaid` (JSDoc `@deprecated`
    pointing here; removal is a 1.0 concern).

**Files:** `packages/crossvalidate/src/mermaid-ts/index.ts`,
`packages/crossvalidate/tests/mermaid-ts.test.ts`,
`packages/mermaid/src/bridge/from-diagram.ts` (deprecation notice)

### Phase 5 — `md-ts` preset (~1.5 days)

12. `adrCitationsResolve()`: corpus citation elements (from 0058)
    resolved against `eess-ts` call-expression elements via `eess-ts`'s
    public API (ADR-007 — no ts-morph here); `it.skip` awareness for
    `pending` clauses.
13. Parity + superiority tests vs the text-level check: everything the
    regex caught, plus template-literal titles and same-string-moved
    cases the regex missed.

**Files:** `packages/crossvalidate/src/md-ts/index.ts`,
`packages/crossvalidate/tests/md-ts.test.ts`

### Phase 6 — Embedded Mermaid blocks (~1 day)

14. `embeddedDiagrams(c)`: corpus fenced blocks tagged `mermaid`
    (exposed by 0058's model) parsed via `eess-mermaid`'s
    `parseClassDiagram(string)` (the actual string-parser export); the
    resulting diagrams feed the same `diagramMatchesCode()` — a diagram
    in an ADR is validated exactly like `architecture.mmd`, with
    violations pointing at the MD file and fence line.

**Files:** `packages/crossvalidate/src/md-mermaid/index.ts`,
`packages/crossvalidate/tests/embedded.test.ts`

### Phase 7 — Docs + artifact alignment (~0.5 day)

15. Package README + docs page (primitive, presets, migration from
    `fromDiagram` **and** `crossLayer`).
16. Update the calculator walkthrough: stage 6's hypothetical
    `mermaid.crossCheck(diagram, project)` becomes the real
    `diagramMatchesCode(d, p)` API. Update the manifesto's example if
    needed.
17. CHANGELOG + family release coordination. Note the `crossLayer`
    deprecation in the `eess-ts` changelog.

## Test inventory

- `correspondence()`: complete both ways, missing left, missing right,
  duplicate matches (two rights match one left → explicit violation,
  not silent first-match), empty selections (vacuous pass), `keyBy` fast
  path vs `matchBy` fallback (same verdicts), `direction` variants.
- **`crossLayer` delegation parity**: every existing plan-0022
  `crossLayer` / `haveMatchingCounterpart` / `haveConsistentExports` /
  `satisfyPairCondition` test passes unchanged against the refactored
  implementation (proves the refactor is behavior-preserving, not a
  parallel engine).
- Relations: preserved, missing on right, missing on left,
  `direction` variants, endpoint unmatched (relation references an
  element outside the correspondence → reported once, not cascaded).
- Mermaid↔TS: walkthrough stages 6 and 7 as executable fixtures;
  `@id` directive mapping; inheritance vs realization arrows;
  scoped `resideInFolder` so UI classes outside the diagram don't
  false-positive.
- MD↔TS: valid citation, dead citation, `it.skip` + `pending` clause,
  template-literal title, `describe`-nested `it`, cited file that
  isn't a test file.
- Embedded: mermaid fence in an ADR validated + cross-checked;
  violation location points into the `.md` file; non-mermaid fences
  ignored.
- Kernel integration: baseline, `.excluding()`, JSON/GitHub formatters
  over cross-validation violations.

## Out of scope

- **Diff mode** (`validator(proposed) − validator(current)` → scoped
  follow-up list; manifesto's proactive invocation). Own plan once
  drift-mode correspondence is stable — it reuses this primitive.
- **Extraction mode** (generate the diagram/spec _from_ code). The
  manifesto's bootstrap path; separate concern, likely CLI.
- **Workflow dialect cross-checks** (depend on the future workflow-dialect plan).
- **Removing `fromDiagram()`** — deprecated here, removed at 1.0 per
  0051's alias policy.
- **Auto-fixing** (updating the diagram when code drifts) — validation
  only, same boundary as 0058.

## Strategic note

This is the plan that ships the category-defining capability: the
manifesto's "neither side is privileged in isolation" stops being
prose and becomes a primitive any two dialects can invoke. After 0051
(one kernel) and 0058 (MD dialect with a production user), 0059 makes
the family more than the sum of its parts — the walkthrough's stage 7
moment becomes a real, installable check, and the external repo's ADR citation
gate gets its AST-grounded upgrade with zero per-repo code.
