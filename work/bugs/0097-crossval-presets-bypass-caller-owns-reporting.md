# Bug 0097: two crossvalidate presets return `void` — ADR-008's "caller owns reporting" never reached them, and its gate can't see the gap

## Status

- **State:** Draft — confirmed against the source; no red test written yet.
- **Reported:** 2026-08-12 — self-found during the [plan 0096](../plans/0096-dogfood-missing-crossvalidate-bindings.md)
  review, when the devops persona checked whether the existing dogfood gates
  actually fail on violations. **Rewritten 2026-08-12** after review: the first
  filing accused `scripts/check-crossval.mjs:6` of a stale comment ("the
  crossvalidate presets return void"), on the premise that the presets return
  `ArchViolation[]`. Verification inverted it — two of them really do return
  `void`, and _that_ is the defect. See _Root cause_.

## Symptom

`@nielspeter/eess-crossvalidate` ships six dialect-pair presets. Four of them
honour [ADR-008](../../adr/008-caller-owns-reporting.md): they take
`PresetReportOptions`, return `ArchViolation[]`, and finish through the kernel's
`finishPreset`. Two do not:

| Preset                                     | Returns           | Options extend        | Finisher           |
| ------------------------------------------ | ----------------- | --------------------- | ------------------ |
| `mermaid-ts` · `diagramMatchesCode`        | **`void`**        | **nothing**           | builder `.check()` |
| `md-ts` · `adrCitationsResolve`            | **`void`**        | **nothing**           | builder `.check()` |
| `gherkin-ts` · `scenarioTestsResolve`      | `ArchViolation[]` | `PresetReportOptions` | `finishPreset`     |
| `gherkin-ts` · `scenariosCovered`          | `ArchViolation[]` | `PresetReportOptions` | `finishPreset`     |
| `md-gherkin` · `scenarioCitationsResolve`  | `ArchViolation[]` | `PresetReportOptions` | `finishPreset`     |
| `md-mermaid` · `embeddedDiagramsMatchCode` | `ArchViolation[]` | `PresetReportOptions` | `finishPreset`     |
| `md-mermaid-er` · `tableErAgree`           | `ArchViolation[]` | `PresetReportOptions` | `finishPreset`     |

An adopter therefore **cannot** ask the two `void` presets for `report: 'return'`
or `format: 'json'`. They emit to stderr and throw, always — no opt-out. And
those two are not obscure corners: they are the **first two bindings in the
package README** (Mermaid↔TypeScript and Markdown↔TypeScript), the ones an
adopter meets first, and the two the repo's own `check:crossval` mounts first.

The gap is family-wide-unique. Scanning every package for an exported preset
returning `void` finds exactly these two — every other preset across
`eess-ts` (`recommended`, `agentGuardrails`), `eess-md` (`adrEnforcement`,
`honestyAtClose`), and the rest of `eess-crossvalidate` returns
`ArchViolation[]`.

## Reproduction

```ts
// packages/crossvalidate/src/mermaid-ts.ts:26-30
export function diagramMatchesCode(
  diagram: MermaidDiagram,
  project: ArchProject,
  options: DiagramMatchesCodeOptions = {}, // { scope?, completeness? } — no report, no format
): void {
```

```ts
// packages/crossvalidate/src/md-ts.ts:89-93
export function adrCitationsResolve(
  corpus: Corpus,
  project: ArchProject,
  options: AdrCitationsResolveOptions = {}, // { dir?, section?, mechanismColumn? } — no report, no format
): void {
```

Both end in the builder terminal `.check()`, which emits and throws. There is no
path by which a caller obtains the violations.

```ts
// what an adopter can do with four of the six presets, and cannot do with these two
const violations = adrCitationsResolve(corpus(...), project(...), { report: 'return' })
//    ^ typed `void`; `report` is not an accepted option
```

## Root cause

Plan 0070 (ADR-008) split detection from emission and introduced `finishPreset`.
It intended to migrate **every** preset — and its own inventory of "every
preset" was already missing these two, twice:

- [0070](../plans/completed/0070-caller-owns-reporting.md) Problem section:
  "Every preset routes through this — `adrEnforcement`, `honestyAtClose`,
  `scenarioCitationsResolve`, `tableErAgree`, and the eess-ts preset family."
- [0070](../plans/completed/0070-caller-owns-reporting.md) Phase 2 _Files
  changed_: "every preset (`md/src/rules/{adr,ledger}.ts`,
  `crossvalidate/src/md-{mermaid,mermaid-er,gherkin}.ts`, `ts/src/presets/*`)".
  The brace expansion covers three of the five crossvalidate preset modules;
  `mermaid-ts.ts` and `md-ts.ts` appear in neither list.

Commit `ae981b2` then shipped the phase claiming "Every preset (md
adrEnforcement/honestyAtClose, crossvalidate scenario/tableEr/embedded, ts
boundaries/data-layer/layered) now finishes via finishPreset and returns
ArchViolation[] (was void — safe)" — repeating the same enumeration, and the
same omission.

The mechanism of the miss is visible in that enumeration: 0070's survey started
from callers of `throwIfViolations`, the emit-and-throw helper it was retiring.
`diagramMatchesCode` and `adrCitationsResolve` never called it — they end in the
builder terminal `.check()`, which emits and throws by a different route. So
they were invisible to the survey that defined the work, and a hand-written list
of "every preset" carried the gap into the plan, the commit, and the ADR row.

Nothing downstream could catch it, because the only mechanism ADR-008 bound the
clause to is a kernel unit test (below).

**ADR-008's own gate cannot see this.** Its Enforcement table marks

> Presets return violations, don't force emission | 2 | `packages/core/tests/report.test.ts` — the `report: return` case | **gated**

The clause is stated family-wide ("presets"); the mechanism exercises only the
kernel's `finishPreset` in isolation. A dialect preset that never calls
`finishPreset` is invisible to it. So the row reads `gated` while two presets
violate the clause — a spec↔code drift of exactly the kind this repo exists to
catch, sitting in the repo's own ADR.

## Why it matters

Beyond the missing adopter capability, the inconsistency actively misleads. The
header comment at `scripts/check-crossval.mjs:6` generalizes over all of them:

> the crossvalidate presets return void and throw ArchRuleError

That was true when written (plan 0060 mounted exactly the two `void` presets)
and is now half true — accurate for `diagramMatchesCode`/`adrCitationsResolve`,
wrong for the four the script and its siblings have since gained. A reader can
take either half as the rule and be wrong about the other. During the plan-0096
review it did exactly that: the plan's Phase 1 was drafted to discard a return
value that `scenarioCitationsResolve` genuinely provides.

## Fix

Migrate both presets to the `finishPreset` shape the other four already use —
`packages/crossvalidate/src/md-mermaid.ts:49-68` is the in-package template
(same `correspondence` → `beComplete` → `rule` chain, collected with
`.violations()` instead of `.check()`):

```ts
export interface DiagramMatchesCodeOptions extends PresetReportOptions {
  readonly scope?: string
  readonly completeness?: Direction
}

export function diagramMatchesCode(
  diagram: MermaidDiagram,
  project: ArchProject,
  options: DiagramMatchesCodeOptions = {},
): ArchViolation[] {
  // …unchanged selection…
  const violations = correspondence({ left, right })
    .should()
    .beComplete({ direction: options.completeness ?? 'both' })
    .rule({ id: 'crossval/diagram-completeness', because: '…' })
    .violations()
  return finishPreset(violations, options)
}
```

`finishPreset` defaults to `report: 'throw'`, so **every existing caller keeps
its current behaviour** — the change is additive (a return value where there was
none, and two new accepted options). Same treatment for `adrCitationsResolve`.

Then correct `scripts/check-crossval.mjs:6` to describe one contract instead of
two.

A minor changeset covers both packages' surface change.

## Verification

- [ ] Red test written first: `diagramMatchesCode(..., { report: 'return' })`
      returns the violations and writes nothing to stderr/stdout — today it does
      not compile (`report` is not an accepted option). Same for
      `adrCitationsResolve`.
- [ ] Default behaviour unchanged: both still emit once and throw
      `ArchRuleError` when called without `report` (the existing
      `check:crossval` gates are the live proof).
- [ ] No exported preset in any package returns `void` — the family has one
      preset contract.
- [ ] `scripts/check-crossval.mjs:6` describes that one contract.
- [ ] `npm run validate` green.

Deferred:

- **Widening ADR-008's Enforcement mechanism so this class cannot recur** — the
  clause needs a Tier-1 rule over `packages/*/src/**` asserting no exported
  preset returns `void`, not just a kernel unit test. That is an ADR-enforcement
  change with its own authoring/validation loop (`.claude/workflows/adr-enforce.mjs`),
  so it is re-homed to [0101](../plans/0101-sibling-gates-go-fail-closed.md), which
  already owns making the family's gates honest. Filing this bug fixed
  without that row widened leaves the clause honest-but-narrow, not false.
