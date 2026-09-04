<!-- Landed 2026-09-04 alongside CONCLUSION.md. Verbatim; this note is the only addition. -->

> **Landing note — 2026-09-04.** Landed from the deleted branch
> `spike/eess-over-ts-archunit` (tip `e9fe6bbcd70abafe57f287c06de84887bdff19fd`),
> together with [CONCLUSION.md](./CONCLUSION.md). See that file's note for why,
> and for the numbering caveats — they apply here too.
>
> **Two claims below no longer hold, and are left in place rather than edited.**
>
> - _"Run it: `npm install && npm run spike`"_ — the runnable artifacts
>   (`package.json`, `run.ts`, `spec.mmd`, `diagram-dialect.ts`, `tsconfig.json`)
>   stayed on the source branch and are **not** here. They were left behind
>   deliberately: the conclusion's own "Honest limits" section says `run.ts` is a
>   demonstration nothing runs, and its `file:` dependency made it
>   non-reproducible anyway. Nothing in this directory is executable.
> - _"plan 0084"_ — no plan 0084 exists in this repo; 0084 is a **bug**
>   (`work/bugs/0084-preserve-relations-right-to-left.md`). The number is from the
>   source branch's own allocation, which predates a renumbering.

# Spike 0001: can eess dialects run on ts-archunit's published core?

> **This spike is closed — see [CONCLUSION.md](./CONCLUSION.md)** for the verdict,
> what blocks it, and the honest limits of the evidence below.

**Question.** Instead of keeping the forked engine in sync (plan 0084 measured
that fork at 10,342 diff-lines / 37 missing modules and sized it XL), can eess
delete its engine and depend on `@nielspeter/ts-archunit` — with the kernel
shrinking to re-exports plus the genuinely eess-specific layer?

**Method.** Build a foreign dialect ts-archunit has never heard of — a toy
mermaid `classDiagram` dialect — on ts-archunit 0.57.0's **published dist**,
using the same extension pattern its in-repo graphql dialect uses (extend
`TerminalBuilder`, own `Predicate<T>`/`Condition<T>` lists over a foreign
element type, copy-on-write via `copy()`). No fork, no eess kernel, no
ts-morph.

**Result: YES — all three proofs pass.**

1. **Type-level** — the subclass compiles clean under TS 5.9 strict +
   `noUncheckedIndexedAccess` against the published `.d.ts`. `RuleBuilder<T>`
   machinery is generic; `ArchViolation` is plain data; `TerminalBuilder`
   needs no `ArchProject` (its `getProject()` is `| undefined`).
2. **Agent-first machinery fires for the foreign dialect, for free.**
   - A real violation renders through ts-archunit's own formatter with the
     full agent surface: `Why:` (because), `Fix:` (suggestion), `Docs:`.
   - A vacuous rule (condition-less chain) is **failed by the assertion
     gate** with the dialect's own advice and the unsuppressable notice —
     ts-archunit ADR-008's "a rule that can't fail, fails," inherited by a
     dialect it was never written for.
3. **Copy-on-write holds across a held selection** (the bug-0016 shape): two
   rules derived from one held selection each flag exactly their own
   offender, by identity. The fix is inherited, not re-implemented.

**Run it:** `npm install && npm run spike` (expects the ts-archunit checkout
as a sibling of the eess repo; demos A and B print deliberate failures).

## What the extension contract actually is

A dialect touches exactly this protected surface of `TerminalBuilder`:

- `copy()` — override to carry the dialect's predicate/condition lists
- `collectViolations()` — the one abstract member
- `assertsSomething()` / `assertionAdvice()` — feed the assertion gate
- `_reason` / `_metadata` — read when building the `ConditionContext`

Everything else consumed (`Predicate`, `Condition`, `ConditionContext`,
`ArchViolation`, `ArchRuleError`, formatters, `withBaseline`, exclusion
comments, `silent`, `diagnose`) is public API that held stable across
0.24→0.57 (zero exports removed or renamed).

## Seams found (the honest list)

- **Node strip-only mode** rejects TS parameter properties, so dialect code
  written to run uncompiled avoids them (this spike does). Compiled packages
  are unaffected.
- **`expectNonEmpty()` lives on `RuleBuilder<T>`, not `TerminalBuilder`** —
  the graphql-pattern dialect gets the assertion gate but not the opt-in
  empty-selection failure. Upstream candidate: hoist it.
- **`describeRule()`'s default renders `unnamed`** for a rule without
  metadata (visible in demo B). Dialects should override it as the graphql
  builder does; not done in this spike, deliberately, so the seam stays
  visible.
- **Extending `RuleBuilder<T>` itself** (for `filterElements`, silent
  exclusions, glob diagnosis) requires an `ArchProject` in the constructor —
  a two-member interface a non-TS dialect must stub. Upstream candidate:
  make the constructor arg optional.
- The protected surface above is **not a semver contract today**. If eess
  builds on it, the drift guard is an eess gate asserting the depended-on
  symbols still exist and typecheck — drift fails the build, which is the
  eess thesis pointed at its own dependency.

## What this means for plan 0084

The nine-stream XL port (W1 builders, W2 assertion gate, W5 exclusion
comments, W6 doctor, W7 JSON contract, W8 caches — and their forever-tail of
upstream releases) collapses into a dependency bump for every dialect at
once. What remains eess's own is exactly what the divergence audit measured
as eess-only: the caller-owns-reporting layer (`finishPreset`,
`PresetReportOptions`), `ArchFix`/`apply-fixes`, and the crossvalidate
primitives (`correspondence`, `ElementInfo`, `Selection`, `matching`).

Next step if adopted: an ADR superseding the fork premise (and revisiting
ADR-007's engine boundary — the boundary becomes ts-archunit itself), a
matching ADR in ts-archunit declaring the extension surface a contract, then
rescope 0084.

— Spiked 2026-08-06 on ts-archunit 0.57.0, Node 26.7.0, TS 5.9.
