# Tests Cannot Lie: The Fail-Closed Architecture of eess

> _"A check that cannot fail is worth less than no check, because it is counted as coverage."_
> — [ADR-009: Agent-First Failure Surfaces](../adr/009-agent-first-failure-surfaces.md)

In conventional software testing, a test suite is considered green if zero assertions fail. However, in architecture testing and automated guardrails, **zero failing assertions is frequently an illusion**:

- A selector glob matches zero files ($\forall x \in \emptyset, P(x)$ is vacuously true).
- A configuration error or dead glob causes a project to load zero source files.
- A hand-rolled validation loop encounters a bug and hits `continue` before reaching any assertion.
- An advisory warning is logged to `stderr` while the process exits `0`.
- An AI coding agent regenerates snapshots (`vitest -u`) to silence a failing check without fixing the underlying defect.

For human developers, a vacuous green is an annoyance. For an **AI coding agent**, a vacuous green is **fatal**: an agent optimizes strictly for a green exit code. If a check passes vacuously, the agent assumes the architecture is sound, commits the drift, and moves on.

To solve this, eess is designed around a binding doctrine: **a passing verdict is never a default; it must be constructed from positive evidence of examination.**

---

## The Core Principles

The doctrine is codified across the Architecture Decision Records (notably [ADR-009](../adr/009-agent-first-failure-surfaces.md), [ADR-010](../adr/010-a-pass-is-constructed-from-evidence.md), and [ADR-014](../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)):

1. **A pass requires proof of examination ([ADR-010](../adr/010-a-pass-is-constructed-from-evidence.md))**: A check cannot simply return `violations: []`. It must return `{ violations, examined }`. A result with zero examined units and zero violations is an unsuppressable configuration failure.
2. **Emptiness is an explicit declaration, never an inference**: Legitimate empty states (such as `.notExist()` or rules expecting zero occurrences) must be declared with `.expectEmpty()`. The declaration expires the moment any matching unit is examined.
3. **Instrument precedence outranks declarations**: Zero loaded source files (`sourceEmpty`) outranks any author declaration. Even if `.expectEmpty()` is declared, a dead project configuration or empty corpus still fails the build.
4. **Evidence at every seam ([ADR-014](../adr/014-the-emitter-refuses-a-verdict-without-evidence.md))**: The evidence contract applies not only to the fluent `.check()` terminal, but across all emitters (`finishPreset`, `reportViolations`) and every builder's `.violations()`. Hand-assembled bare arrays cannot exit cleanly.
5. **Actionable findings fail; they never warn ([ADR-009 Rule 1](../adr/009-agent-first-failure-surfaces.md))**: Any finding with a non-optional remedy must fail the build. A check that merely logs a warning is invisible to an agent.
6. **Remedies must remediate ([ADR-009 Rule 2](../adr/009-agent-first-failure-surfaces.md))**: Every violation message must state a concrete remedy, and that remedy must be behaviorally proven to clear the finding.

---

## The Mechanical Layers

eess replaces trust with six interlocking mechanical gates enforced on every build:

### 1. The Evidence Receipt (`CollectResult`)

At the core type level, verdict functions do not accept or return bare arrays. Every rule builder, preset, and emitter produces and receives a receipt:

<!-- eess-docs-code-skip: illustrative architectural types -->

```typescript
interface CollectResult extends Array<ArchViolation> {
  readonly examined: number
  readonly sourceEmpty?: true
  readonly declaredEmpty?: true
  readonly notRun?: true
}
```

- **Zero examined fails**: If `examined === 0` and neither `declaredEmpty` nor `notRun` is present, the kernel automatically injects an unsuppressable configuration finding.
- **Fail-closed merge (`mergeCollectResults`)**: When a test script runs multiple checks, it cannot sum their numbers into a single aggregate to hide a dead check. If any individual check in the bundle examined zero units without a declaration, the entire merged verdict fails.
- **Array with own-properties**: The receipt is an `Array` subtype so that legacy `.length` inspections remain accurate, preventing `undefined > 0` silent-pass traps in untyped environments.

### 2. The Vacuity Matrix (`check:vacuity`)

Defined in [`scripts/vacuity-matrix.mjs`](https://github.com/NielsPeter/eess/blob/main/scripts/vacuity-matrix.mjs), this gate runs in CI on every push to verify that check-constructors cannot pass over empty projects.

- **Bare execution over zero files**: The matrix derives every published builder (`classes()`, `functions()`, `modules()`, `slices()`, etc.), preset (`recommended()`, `agentGuardrails()`), and emitter, and executes each bare against a project loading zero source files.
- **Three-way classification**:
  - `config-finding`: The ADR-010 evidence gate fired correctly (`bypassFilters: true`).
  - `other-throw`: An unexpected crash occurred.
  - `fail-open`: The check passed silently with zero files (build failure!).
- **The `KNOWN_FAIL_OPEN` ratchet**: If any check is temporarily permitted to fail open, it must be explicitly recorded in a ratchet table with an expiration date. An expired entry fails the build, and dead entries (entries that no longer fail open) are rejected.
- **Harness self-check**: Before checking real exports, the matrix runs four control fakes against itself. If the classifier cannot distinguish a pass, an unrelated crash, and an honest configuration finding, it aborts with exit code `2`.

### 3. The Non-Vacuity Harness (`check:nonvacuity`)

Defined in [`scripts/check-nonvacuity.mjs`](https://github.com/NielsPeter/eess/blob/main/scripts/check-nonvacuity.mjs), this harness addresses the meta-problem: _testing clean code only proves clean code passes; it does not prove bad code fails._

- **Deliberately corrupted inputs**: The harness feeds deliberately broken fixtures to every gate in the repository:
  - Probes that import raw `typescript` APIs (testing `check:arch`).
  - Probes containing empty catches (testing internal linting).
  - Markdown docs with broken internal links or invalid ADR enforcement tiers (testing `check:corpus`).
  - Feature files citing missing scenarios (testing `check:crossval`).
- **Break-the-loop sabotage**: To verify that gate scripts do not skip records, the harness plants deliberate corruptions (such as an unconditional `continue`) into production scripts (like `check-corpus.mjs`) and asserts that the harness's [`emitter/one-dead-check`](https://github.com/NielsPeter/eess/blob/main/scripts/check-nonvacuity.mjs) row reds — a row in the non-vacuity harness, not a kernel violation id like `emitter/no-receipt`.
- **The Fixture Contract**: Every fixture must print a unique sentinel token (`bad-<name>:`) and exit `1` _only_ when the specific targeted rule triggers. An unhandled exception exits `2` and is rejected by the harness.

### 4. Mandatory Denominator Reporting

A green build that prints no numbers is inherently suspect. In eess:

- **Every gate prints what it examined**: CLI tools and gate scripts report explicit denominators, in the shape `✓ corpus integrity — N checks across M documents, 0 violations`. The integers are deliberately not pinned here: the gate prints them on every run, and a copy in prose goes stale within a few commits — which is itself a claim outrunning its mechanism.
- A run that completes in milliseconds without reporting an examined count is treated as a potential vacuous no-op.
- Summaries report positive counts of evaluated items, not merely absence of failures.

### 5. Behavioral "Remedy-Remediates" Verification

A common trap in linting and architecture testing is asserting that an error message matches a string:

<!-- eess-docs-code-skip: illustrative anti-pattern -->

```typescript
// ❌ Weak check: asserts only that words exist in a message
expect(violation.message).toContain('Use this.extractCount()')
```

Under [ADR-009 Rule 2](../adr/009-agent-first-failure-surfaces.md), this is rejected as a "same-derivation check"—the test and the message share the author's misunderstanding, and the test stays green even if the remedy is impossible to apply.

Instead, eess enforces **behavioral remediation**:

- Every mechanical remedy must have a dedicated fixture.
- The test starts with a failing state, applies the exact transformation recommended by the remedy message, and asserts that the violation clears.

### 6. Banned Snapshots & Fail-Closed Warnings

- **No snapshots in agent tests ([ADR-009 Rule 4](../adr/009-agent-first-failure-surfaces.md))**: `toMatchSnapshot()` and `toMatchInlineSnapshot()` are banned in agent-facing suites. When an agent encounters a failed snapshot, it frequently reaches for the `-u` flag to overwrite the snapshot rather than reasoning through the regression.
- **Fail-closed `.warn()` ([ADR-014 §5](../adr/014-the-emitter-refuses-a-verdict-without-evidence.md))**: If a check runs under `report: 'warn'` but triggers a configuration finding (such as missing evidence or an unexamined set), it **throws** rather than logging. Logging a configuration failure above `exit 0` is recognized as _"the lie by another name"_.

---

## Protecting Against Agent Gaming: The Walk-Around Pattern

When an AI coding agent that has never encountered eess is asked to implement architecture checks in a project, it exhibits a predictable failure mode:

1. **The Optimization Target**: The agent optimizes strictly for a green exit code (`0`).
2. **The Affordance Trap**: If it sees exported types or utility functions (like `finishPreset`, `corpus()`, or `ArchViolation`), it treats eess as an ordinary procedural helper rather than a declarative rule engine.
3. **The Procedural Bypass**: Instead of writing a declarative `classes().should()...check()` pipeline, the agent writes an imperative loop:
   <!-- eess-docs-code-skip: illustrative bypass example -->

   ```typescript
   import { corpus } from '@nielspeter/eess-md'
   import { finishPreset, type ArchViolation } from '@nielspeter/eess'

   const violations: ArchViolation[] = []
   for (const doc of corpus().documents()) {
     if (!isTarget(doc)) continue // A bug or dead selector skips all items!
     // ...
   }
   finishPreset(violations, { report: 'throw' }) // Vacuous pass!
   ```

Because the loop examined zero items and found zero violations, the check turned green while providing zero coverage.

To prevent an agent from gaming the system, eess employs a three-part lockdown:

- **The Emitter Door is Locked ([ADR-014](../adr/014-the-emitter-refuses-a-verdict-without-evidence.md))**: Emitters refuse bare arrays. They require a `CollectResult` receipt carrying positive `examined` counts. An empty receipt with zero examined units throws an unsuppressable configuration finding.
- **Quarantine via Guardrails ([Plan 0237](../work/plans/completed/0237-eess-runtime-use-only-in-rule-files.md))**: Consuming projects can enable `noVerdictOutsideRules: true` in `agentGuardrails`. This rule fails the build if any source file outside `*.rules.ts` or `*.test.ts` imports `@nielspeter/eess` at runtime or invokes emitters.
- **Standing Instructions ([Agent Integration](/agent-integration))**: By running `npx eess-ts explain arch.rules.ts --format agent >> AGENTS.md`, the imperative rules ("Do NOT import eess as a value outside rule files...", "Reach verdicts through a builder...") are injected directly into the agent's prompt, preventing it from inventing broken shapes in the first place.

---

## Documented False-Green Discoveries

The mechanisms above were not designed in the abstract; each was introduced after a concrete false-green was measured in production:

| Incident                   | What Happened                                                                                                                                 | Mechanism That Closed It                                                                                                                 |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **ts-archunit bug 0014**   | `notImportFrom('picomatch')` passed while 15 files imported it because it only checked uninstalled packages.                                  | Independent AST edge derivation ([ADR-009](../adr/009-agent-first-failure-surfaces.md)).                                                 |
| **ts-archunit bug 0066**   | `smells.duplicateBodies().check()` passed over solution tsconfigs, reporting 401 findings as clean because zero files loaded.                 | `sourceEmpty` precedence outranking declarations ([ADR-010](../adr/010-a-pass-is-constructed-from-evidence.md)).                         |
| **Bug 0154**               | `// eess-exclude` placed inside a string literal or markdown prose silently suppressed real violations.                                       | Two-stage masking parser with conservative regex fallback ([ADR-012](../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)).           |
| **Bug 0238**               | Deleting reason-free waiver promotion left 206 kernel tests passing because the test exercised the parser rather than the filter.             | Multi-dialect behavioral promotion assertion ([ADR-012](../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)).                        |
| **Proposal 009 / ADR-014** | AI agent wrote 4 custom corpus validation loops using bare arrays; 3 went inert within a week under `✓ 0 violations`.                         | `CollectResult` receipt required on all emitters and builders ([ADR-014](../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)). |
| **Plan 0235 Review**       | Using an Object `{ violations, examined }` turned `check:corpus` permanently green because `violations.length` was `undefined > 0` (`false`). | Receipt constructed as an `Array` with attached properties ([ADR-014](../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)).    |

---

## Authoring Checklist

When authoring custom rules, presets, or dogfood gates in eess, follow this checklist to ensure tests cannot lie:

1. **Does the check return a receipt?** If writing a preset or terminal, return a `CollectResult` carrying the count of examined items.
2. **Is emptiness declared?** If zero matches is a valid passing state, assert `.expectEmpty()` explicitly so the declaration expires when items appear.
3. **Is there a non-vacuity fixture?** Never commit a gate without adding a corresponding violating fixture in `scripts/nonvacuity/` that proves the gate turns red when broken.
4. **Does the remedy remediate?** If your rule provides a suggestion (`.rule({ suggestion })`), write a test that applies that suggestion and verifies the rule passes.
5. **Does the output report a denominator?** Ensure your check prints the total number of items evaluated so readers can differentiate between 0 violations across 500 files versus 0 violations across 0 files.
