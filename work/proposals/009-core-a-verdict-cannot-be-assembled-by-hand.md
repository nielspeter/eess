# Proposal 009 — core: a verdict cannot be assembled by hand — the emitters accept only what the pipeline minted

**State:** Draft — surveyed against the repo source at core 0.5.0 / md 0.4.0 / ts 0.4.0 (`packages/core/src/report.ts`, `violation.ts`, `execute-rule.ts`, `index.ts`, `packages/ts/src/presets/shared.ts`) and against ADR-008, ADR-010 and ADR-011; the two headline measurements below were re-run in this repo, not carried over. No red test written yet.
**Priority:** High — closes a gap between what eess claims and what it checks. ADR-010 says a pass without evidence is _unrepresentable_; the kernel root exports a seam at which it is one line.
**Origin:** inbound — a consuming project (`@nielspeter/eess` `0.4.0`, `@nielspeter/eess-md` `0.5.0`, `@nielspeter/eess-ts` `0.4.0`), found when an agent working there was asked why three corpus gates had gone silently inert in one week. The project is not named here: this repo does not carry consumer identities. Its field numbers appear below as reported context; every load-bearing claim is re-verified against this repo's own source.
**Affects:** `packages/core/src/report.ts` (`finishPreset`, `reportViolations`), `packages/core/src/violation.ts` (`ArchViolation`), `packages/core/src/execute-rule.ts` (`applyFilters`, the natural mint point), `packages/core/src/index.ts` (the root surface), `packages/ts/src/presets/agent-guardrails.ts`, `packages/md/README.md` / `docs/markdown.md`.

## Problem

ADR-010's Decision reads: _"A pass that is merely 'no violations were collected' is unrepresentable."_ Its
mechanism is the terminal seam — `collectViolations()` returns `CollectResult`
(`packages/core/src/terminal-builder.ts:39`: `{ violations, examined, sourceEmpty? … }`), so every
builder-family verdict carries evidence and a zero-examined rule becomes a configuration finding. The
vacuity matrix then probes _every published constructor_ over a zero-file project.

The kernel root also exports `finishPreset(violations: ArchViolation[], options?)`
(`packages/core/src/report.ts:77`) and `reportViolations`. Both take a bare array. Neither can tell an
array a builder produced from an array a consumer typed. `ArchViolation` is a plain interface
(`packages/core/src/violation.ts:27`) — `spec.rules.ts` in this very repo constructs it as an object
literal, correctly, inside a `Condition`. So the following program is type-correct, uses only root
exports, follows three separately-documented affordances, and constructs exactly the pass ADR-010
calls unrepresentable:

```ts
import { corpus } from '@nielspeter/eess-md' // "a one-off question about the corpus is a loop, not a new rule"
import { finishPreset, type ArchViolation } from '@nielspeter/eess' // the ADR-008 preset seam

const violations: ArchViolation[] = []
for (const d of corpus({ roots: ['work/**'] }).documents()) {
  if (!looksRight(d)) continue // the bug lives here, and nothing can see it
  // … assemble a literal per finding …
}
finishPreset(violations, { report: 'throw' }) // ✓ over a corpus of zero, or a loop that skipped everything
```

**This is not hypothetical.** The consuming project shipped four of these — record-shape, board
projection, priority agreement, drift — as its corpus gates, importing eess's _types_ and its
_printer_ and never a `RuleBuilder`. In one week three were found inert: a `continue` on a malformed
row, a counter that fell from 38 compared to 0 with `✓ 0 violations`, a header count compared against
nothing. Each was green. Each fix hand-rolled one more floor. The third defect shipped in the commit
that fixed the second. The agent that wrote them had been told to "embrace eess" in the same session
and had a working `eess-md` rule file in the same directory.

The vacuity matrix cannot see this family, and ADR-010 says why in its own Context: _"an enumeration
derived from the work in front of you does not contain the family outside your view."_ The matrix
enumerates the `package.json` exports map for check-**constructors**; `finishPreset` is a reporter, so
it is outside the enumeration while being the one seam a consumer walking around the pipeline must
still pass through.

**The guard that nominally covers this is not wired.** `scripts/vacuity-matrix.mjs:213` reads:
_"A preset that constructs NOTHING still scores `fail-open` here, correctly: `finishPreset([], …)` has
nothing to throw about. That is `presetConstructsNothingViolation`'s case and it must stay
detectable."_ Measured 2026-09-02: `presetConstructsNothingViolation(` has **no call site under any
`packages/*/src`**. eess-ts's presets emit `preset/agent/constructs-nothing` through their own
`assertEnabled(attempted, …)` (`packages/ts/src/presets/agent-guardrails.ts:214`) — a preset-author
discipline, applied preset by preset. A consumer-authored "preset" has neither, and the docstring's
"must stay detectable" describes a helper nothing calls.

## Evidence

Re-measured in this repo against the workspace's built packages (a throwaway `.mjs` at the repo root,
deleted after):

| Probe                                                                                            | Result                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finishPreset([], { report: 'throw' })`                                                          | returned `[]`, **threw: false** — a verdict with no evidence, silent                                                                                        |
| `finishPreset([], { report: 'return' })`                                                         | returned 0 violations                                                                                                                                       |
| `docs(c).that().resideInFolder('docs/**').should().haveSection('Nope').violations()`             | 38 violations                                                                                                                                               |
| `docs(c).that().resideInFolder('docs/nonexistent/**').should().haveSection('Nope').violations()` | **1** violation: _"this rule examined zero units. If this is expected … declare it explicitly with `.expectEmpty()` — otherwise this is a dead selector …"_ |

Same corpus, same repo, two seams: the pipeline turns a dead selector into a finding with zero
configuration; the emitter turns the same nothing into a ✓.

**Where the evidence is thrown away, in this repo's own code.** `deliver()`
(`packages/ts/src/presets/shared.ts:419`) is what all five eess-ts presets return through:
`builders.flatMap((b) => b.violations())`, then `finishPreset(violations, …)`. The builders' evidence
is consumed one line earlier — correctly, since a zero-examined builder emits its configuration
finding _as_ a violation, so the array is non-empty when it should be. That is why the shipped
presets are safe. It is also why `finishPreset` has never needed to know: every caller inside the
family had already been through a terminal. The seam was designed for callers who hold a verdict,
and it cannot check that they do.

**What ADR-011 already decided, and what this does not re-ask.** ADR-011's first cut moved
`reportViolations` / `finishPreset` behind `/internal`; review sent them back to the root as _"named
seams in ADR-008"_ — a caller embedding eess owns emission, and `finishPreset` is how a preset honours
`report: 'return' | 'warn'`. That reasoning holds and this proposal keeps both on the root. ADR-011's
own Enforcement table also records the ceiling honestly: _"Consumers do not import
`@nielspeter/eess/internal` — None possible. A subpath export is published and resolvable by any
consumer"_ (`manual`). So **hiding is not the mechanism**. The mechanism has to be one that leaves the
seam public and still refuses a verdict that never came from a rule.

## Proposed API

Four asks, ordered by how much of the gap each closes. They compose; A alone closes most of it.

### A. The emitters accept only pipeline-minted violations (kernel)

The pipeline already touches every violation a rule produces — `applyFilters`
(`packages/core/src/execute-rule.ts:114`) stamps `ruleId` onto condition output. Make that the
**mint**: a violation that has passed through the pipeline is registered, and `finishPreset` /
`reportViolations` refuse one that has not.

```ts
// packages/core/src/violation.ts — the registry, same device as cardinality.ts
const MINTED = new WeakSet<ArchViolation>()
/** Called by the pipeline only (applyFilters / evaluateConditions). Not exported from the root. */
export function mint(v: ArchViolation): ArchViolation
export function isMinted(v: ArchViolation): boolean

// packages/core/src/report.ts
export function finishPreset(
  violations: ArchViolation[],
  options?: PresetReportOptions,
): ArchViolation[]
// …unchanged signature. Behaviour: any element with !isMinted(v) is replaced by ONE unsuppressable
// configuration finding — "N violation(s) were not produced by a rule: this verdict was assembled by
// hand, so nothing counted what it examined. Write a Condition and reach finishPreset through a
// builder's .violations()" — and an EMPTY array from a caller that holds no builder is the same finding.
```

Why a `WeakSet` and not a type brand: `packages/core/src/cardinality.ts` already records the argument
— a `unique symbol` keyed onto a public object is _"unlisted, not unreachable"_ and was forged in one
line through documented exports; the registry is unforgeable because a caller would need this
module's binding. The identical hazard applies here, and the identical answer. A compile-time brand
(`Minted<ArchViolation>` as the emitters' parameter type) is a worthwhile companion — it moves the
finding from run time to edit time for a TypeScript consumer — and is listed under Open questions
rather than asked for, because it changes the shape every test in this repo that hands a literal to a
reporter would have to satisfy.

**The empty case is the important one.** A hand-assembled array that _found_ something is at least
honest about what it found. The array that is empty because the loop examined nothing, or skipped
everything, is the pass ADR-010 exists to forbid — and it reaches `finishPreset` as `[]`, which is
indistinguishable from a clean run. Under A, `[]` from a caller with no minted evidence is the
finding, exactly as a zero-examined rule is at the terminal.

### B. Preset plumbing off the root (kernel, additive under ADR-011 §2)

`dispatchRule`, `validateOverrides` and `throwIfViolations` are exported from the kernel root
(`packages/core/src/index.ts:47`). No `docs/` page or package README teaches a consumer to call any
of them; `throwIfViolations` is documented as _"kept for backward compatibility"_. They are
preset-authoring plumbing, and ADR-011 §2 already provides the place: `/internal`, which a dialect may
import and must not re-export. eess-ts's `shared.ts` re-exports `validateOverrides` from the root
_specifically_ to satisfy ADR-011 clause 2 — moving the symbol makes that re-export unnecessary rather
than illegal. `finishPreset` and `reportViolations` stay on the root, per ADR-008 and the ADR-011
review; B is about the three symbols that review did not send back.

### C. A guardrail that catches the consumer walking around the pipeline (eess-ts)

`agentGuardrails` is _"the mistakes AI coding agents make most."_ This one now has a measured instance.
Add `preset/agent/no-parallel-checker`:

```ts
modules(p)
  .that()
  .resideInFolder(src) // the preset's existing `src` option
  .and()
  .satisfy(not(isRuleOrTestFile)) // *.rules.ts, *.test.ts, *.spec.ts
  .should()
  .notContain(call(/^(finishPreset|reportViolations|throwIfViolations|dispatchRule)$/))
  .rule({
    id: 'preset/agent/no-parallel-checker',
    because:
      'a script that assembles violations and calls the emitter is a rule without a pipeline — nothing counted what it examined',
    suggestion:
      'write a Condition and reach the verdict through a builder .check() / .violations(); move the file to *.rules.ts if it is a rule file',
    imperative:
      'Never call finishPreset/reportViolations from application code; a check is a rule.',
  })
```

A alone makes the hand-rolled shape _fail_; C makes it fail at the file that did it, with the
remedy on the line, before a run.

### D. One paragraph where the two affordances meet (docs-only)

`packages/md/README.md` says _"a declarative rules file, not a custom validator script"_ and, one
section later, _"a one-off question about the corpus is a loop, not a new rule."_ Both are right. The
paragraph between them that does not exist: **a loop that ends in `finishPreset`, `reportViolations`
or `process.exit` is not a one-off question — it is a rule without a pipeline. Write a `Condition`.**
Same sentence in `docs/markdown.md` §"What did the corpus actually load?" and in `docs/presets.md`
beside the `report` table.

## What this cannot do, stated so the proposal does not over-claim

A library cannot make `for … process.exit(1)` impossible. Nothing in npm, TypeScript or this repo
controls a consumer's exit code, which is the same fact ADR-011's `manual` row records for `/internal`.
The honest claim is narrower and still worth having: **a verdict cannot be obtained from eess without
evidence** — by omission (A: the emitters refuse it at run time), by placement (B: the plumbing is not
where a consumer reaches), by file (C: the guardrail names it), and by prose (D). A consumer who
bypasses eess entirely has not misused eess; they have not used it, and that is the reviewer's to see.

## Alternatives considered

- **Retype `finishPreset` to take `{ violations, examined }`** — ADR-010's own shape, threaded from
  the terminal. Considered first and rejected as the primary: a hand-rolled loop supplies
  `examined: documents.length` honestly and is _still_ inert in exactly the way the consumer measured
  (the skip is inside the loop). ADR-010's Notes name this: evidence _"wired from the wrong layer …
  satisfies the letter over a fiction."_ A count is a proxy for the pipeline; A requires the pipeline.
- **Hide `finishPreset` / `reportViolations` behind `/internal`** — tried in ADR-011's first cut,
  reversed on review for ADR-008's reason. Not re-asked; see Evidence.
- **A type brand alone** — edit-time only; erased at run time; bypassed by `as`, which ADR-005 bans
  here and consumers may not. Companion to A, not a substitute (Open questions).
- **Wire `presetConstructsNothingViolation` into `finishPreset` for the `[]` case** — closes the empty
  array and nothing else: a hand-made non-empty array still passes, and an inert loop that found one
  real thing and skipped ninety is non-empty. It would also make the matrix's stale docstring true,
  which is a reason to fix the docstring, not the design.
- **Leave it to the consumer's own ADR** — the consuming project has written one and shipped the rule
  in C as its own eess-ts rule. That is the correct local answer and it is why C is a small ask. It
  does not help the next consumer, and the failure was made of three separately-correct documented
  affordances composing — which is the library's to name, not each consumer's to rediscover.

## Acceptance criteria

- **A, the empty case.** `finishPreset([], { report: 'throw' })` from a caller holding no builder
  throws one unsuppressable configuration finding naming the remedy; today it returns `[]` and does
  not throw (measured above). Break class: a future "optimisation" that early-returns on
  `violations.length === 0` before the mint check reintroduces the silent ✓ — pin with a test whose
  fixture is exactly `finishPreset([])`, not a preset over a zero-file project (the matrix already has
  that cell, and it passes today for a different reason).
- **A, the hand-made case.** `finishPreset([{ rule: 'x', element: 'e', file: 'f', line: 1, message: 'm' }])`
  produces the configuration finding, not the violation. A minted violation — obtained from
  `builder.violations()` — passes through unchanged, object-identical. Break class: a mint that
  registers a _copy_ rather than the object handed on (a `{ ...v }` in `applyFilters`) makes every
  real violation read as hand-made and turns the whole family red; the test asserts identity, not
  shape.
- **A, the aggregating caller.** `preset(p, { report: 'return' })` followed by
  `reportViolations(result)` — ADR-008's harness case — still emits every violation. Break class:
  the registry must survive the path from `evaluateConditions` through `applyFilters` to
  `deliver()`'s `flatMap`; a registration sited after a filter that drops elements loses the
  suppressed ones from the set while they may still be reported under `warn`.
- **B.** `import { dispatchRule } from '@nielspeter/eess'` fails to resolve; the same import from
  `@nielspeter/eess/internal` resolves; `check:family` and
  `packages/ts/tests/standalone-surface.test.ts` stay green with `validateOverrides` no longer
  forwarded by `shared.ts`. Break class: a dialect barrel that forwards the moved symbol —
  `it('no symbol behind @nielspeter/eess/internal is reachable from eess-ts')` covers eess-ts; ADR-011
  records that md/mermaid/gherkin/crossvalidate are unguarded on that clause, and this ask does not
  widen it.
- **C.** A fixture module under `src/` containing `finishPreset(vs)` reds `agentGuardrails` naming
  `preset/agent/no-parallel-checker`; the same call in `src/arch.rules.ts` does not. Break class:
  the `not(isRuleOrTestFile)` predicate declares its globs (`globAnyOf`) or the vacuity diagnosis
  cannot tell an empty `src` from a predicate that excluded everything. Non-vacuity row in
  `check-nonvacuity.mjs` per the fixture contract (bug 0109): sentinel on every exit path, rule id
  asserted, not just exit 1.
- **D.** `check:docs-code` and `check:corpus` green; no new symbol.

## Open questions

- **Brand as companion to A.** `Minted<ArchViolation>` on the emitters' parameter type would move the
  A finding to edit time for TypeScript consumers. Cost: every test in `packages/*/tests` that hands a
  literal to `reportViolations` must go through the mint or a test-only helper; the reviewer knows
  whether that count is tens or hundreds. Reserved for the maintainer.
- **Copies.** A `WeakSet` is identity-keyed, so a consumer that maps violations
  (`vs.map((v) => ({ ...v, file: rel(v.file) }))`) before `reportViolations` produces objects the
  registry has never seen. Either `reportViolations` stays lenient and only `finishPreset` requires
  minting (they have different audiences under ADR-008), or a documented `remint(v, from)` exists for
  the harness case. A symbol property would spread with `...` — and be forgeable, which
  `cardinality.ts` already rejected. Design taste; the evidence here does not settle it.
- **Where the mint sits.** `applyFilters` (`execute-rule.ts:114`) is where `ruleId` is stamped, but
  ADR-010's terminal (`TerminalBuilder.evidencedViolations()`) is where evidence is decided; the mint
  belongs wherever a violation is last touched by kernel code before any caller can hold it.
- **The stale docstring** at `scripts/vacuity-matrix.mjs:213`. Whether that is a bug against the
  matrix, a bug against the unwired helper, or simply resolved by A — it should not survive this
  proposal unaddressed either way.

## Scope

`packages/core` (A, B), `packages/ts` (C), docs (D). No change to `packages/md`'s API: the consumer
failure was in md's corpus but the seam is the kernel's. Split-and-sequence is the expected ruling —
B and D are additive; A is a behaviour change on a published seam and C is a new guardrail rule, each
its own release note.

## Review — 2026-09-03

**Ruling: Split and sequence**

Three lenses reviewed this independently. All three accept the Problem section: it is real, well-measured, and the two headline measurements re-run in this repo are correct. All three reject Ask A's _mechanism_. The asks do not share a fate, which is why this is a split.

**A — the `WeakSet` cannot reach the case the proposal calls "the important one".** `finishPreset` receives an array, not a caller. A `WeakSet<ArchViolation>` is interrogated per element; at `[]` there are zero elements. And the empty path is not a corner case, it is dominant: `packages/ts/src/presets/shared.ts:428` is `builders.flatMap((b) => b.violations())`, handed to `finishPreset` at `:450`, and **on every clean run of every preset that array is `[]`** — byte-identical to a hand-rolled loop's `[]`. Only two behaviours are available and both fail: fire on empty and every green preset run in all six packages reds; don't fire and A closes nothing on its headline case.

The Evidence section's defence — a zero-examined builder emits its configuration finding _as_ a violation, so the array is non-empty when it should be — is true for the **vacuous** case and conflates it with the **clean** case. A builder that examined 500 files and found nothing returns `[]`.

The enforcement lens supplied the decisive test: **no `scripts/check-nonvacuity.mjs` row can be written for it.** A fixture proves a gate reds on violating input; here the violating input and the passing input are the same value at the same call site. If the fixture cannot be written there is no capability, only a claim.

**A's named mint site does not cover the flagship dialect.** Ask A says make `applyFilters` (`packages/core/src/execute-rule.ts:114`) the mint. There are **two** `applyFilters`: the kernel's at `packages/core/src/execute-rule.ts:42` and `eess-ts`'s fork at `packages/ts/src/core/execute-rule.ts:62` — and `packages/ts/src/core/terminal-builder.ts:14` imports the local one, so eess-ts's terminal never calls the kernel's. A mint at the cited line registers nothing eess-ts produces, `deliver()` hands `finishPreset` an array of entirely unminted violations, and A replaces all of them. That is the "turns the whole family red" break class the proposal itself states, reproduced by the mint site it names. Open Question 3 frames the mint's location as taste; it is a correctness precondition, and the survey missed the fork.

**A as specified deletes true findings.** Its stated behaviour — a non-minted element is _replaced_ by one generic finding — destroys real, more actionable findings. `packages/crossvalidate/src/md-mermaid.ts:120` pushes a hand-built `crossval/embedded-diagram` parse-failure literal, carrying `because` and a deliberately-single remedy, into the array that reaches `finishPreset` at `:157`. Four synthetic builders in `packages/ts/src/presets/shared.ts` (`:127`, `:199`, `:265`, `:321`) hand-build `ArchViolation` literals and return them through `{ violations: () => … }`, never touching `applyFilters` — all four are `bypassFilters: true` ADR-010 configuration findings, so A would replace `assertEnabled`'s specific remedy with generic advice that is wrong for that case. Five of this repo's own gates call `reportViolations` on hand-assembled arrays (`check-baseline`, `check-corpus`, `check-guardrails`, `check-ledger`, `check-release`); `check-corpus` is mixed — builder call sites plus hand-assembled families — so A would collapse real broken-link and stale-pointer findings into one meta-finding and lose every `file`/`line`. Replacing a true finding with a meta-finding is an actionability regression under ADR-009, and the proposal does not price it. Its Open Questions half-anticipate this; the survey never looked at the repo's own scripts.

**The redesign that works: mint the container, not the element.** `CollectResult` (`packages/core/src/terminal-builder.ts:39`) is already the evidence shape ADR-010 mandates — `{ violations, examined, sourceEmpty?, deadGlob? }` — and every terminal produces one. A registry keyed on the _receipt_ rather than on each violation answers empty **and** non-empty, and survives `vs.map((v) => ({ ...v }))`, which the element-keyed design cannot address at all. The proposal rejected `finishPreset({ violations, examined })` for a correct reason — a caller-supplied `examined` number is forgeable — then applied the unforgeable device at the wrong granularity and never considered the combination. That combination is the design. Stated honestly: a receipt closes correctness, not forgeability; only the first is available from A as written.

**B — rejected.** Its stated premise is measurably false: "No `docs/` page or package README teaches a consumer to call any of them" — `docs/api-reference.md:566-568` documents all three in the public API table, and `packages/core/README.md:54` documents `Dispatchable`. They are also not kernel-root-only: `packages/md/src/index.ts:30-31` re-exports `dispatchRule` and `validateOverrides` as public `eess-md` API, and `packages/ts/src/index.ts:489,542` re-exports all three. ADR-011 clause 2 forbids re-exporting `/internal`, so B deletes documented public symbols from three packages with no in-dialect replacement, breaking the invariant `family.rules.ts:83` states verbatim: _"a standalone consumer of one dialect must never need a second, direct `@nielspeter/eess` install."_ B's acceptance criteria consider only `validateOverrides` in eess-ts and miss `eess-md` entirely. **Recorded disagreement:** the enforcement lens ruled B "ship as-is"; the architect and product lenses both rejected it, and the coordinator verified the false premise and the md re-export directly. The rejection stands on that evidence, and the dissent is noted rather than dropped.

**C — narrow it.** Two changes. Drop `dispatchRule` from the banned-call pattern: it is the sanctioned preset-authoring call, used correctly at `packages/md/src/rules/adr.ts:131-141`, and banning it contradicts the rule's own imperative, which names only `finishPreset`/`reportViolations`. And fix the exemption: `not(isRuleOrTestFile)` exempts `*.rules.ts`/`*.test.ts`/`*.spec.ts` but not a gate script, a shape this repo ships five of. The honest rule is not "never call the emitter" but "don't call it holding something you never counted."

**D — ship it, independently.** It is a discovery fix rather than new API: the proposal's own Evidence table shows the dead-selector finding arriving with zero configuration on the builder path, so the capability the consumer needed already shipped and they did not find it. Docs-only, zero risk, no dependency on A/B/C.

**Release shape for what survives.** D: docs only, `none` changesets. C: `@nielspeter/eess-ts` minor on 0.x — additive in API terms, but a new rule in a shipped preset reds adopters on upgrade, so the changelog must name the rule id and the `overrides` opt-out. If A is later pursued as a redesign it is `@nielspeter/eess` minor-as-break on 0.x and must **name** `-ts`, `-md`, `-crossvalidate` and `-gherkin` in the same changeset (bug 0185's class), which the Scope section does not.

**Recommended next step.** Ship D as documentation now. Ship C narrowed as its own small plan. Take A back to design as the container mint — and note that A is a new binding decision about what the kernel's emitters accept, so it belongs in an ADR before a plan, argued against ADR-008 and ADR-010 rather than buried here. Drop B. The Problem section should survive all of it: it is the strongest part of this proposal and it is correct.

### Addendum, same review — two findings that arrived after the ruling was written, one of which corrects it

**Correction to this review.** Above, "A as specified deletes true findings" is presented as an objection to the ask. It is an objection to the **granularity**, not to the ask, and the ruling overstated it. The four synthetic builders in `packages/ts/src/presets/shared.ts` are already shaped as `{ violations: () => [violation] }` — a `RuleBuilderLike`. Under element minting they are unminted literals and get eaten; under container minting the repair is one line each: return a minted receipt (`examined: 1`, or `sourceEmpty` where apt) instead of a bare array. That is honest rather than a workaround — those findings _did_ examine the preset's own configuration, and the receipt states exactly that, with `bypassFilters: true` untouched. The same one-line repair covers `packages/crossvalidate/src/md-mermaid.ts:120` (`examined` = fences seen) and `applyFilters`' own undocumented-exclusion push at `packages/core/src/execute-rule.ts:171`. The deletion problem is real and it is not a reason to abandon A; it is another reason the mint belongs on the container.

**Ask A is barred by a binding ADR as written, not merely under-specified.** Two direct textual conflicts, both verified:

- **ADR-010:136** — of the kernel-bound unforgeable `WeakSet`-backed registries: _"each guards a distinct, named audience, and **nothing may add a fourth**."_ Ask A adds a fourth, at any granularity. Whether an _admission_ gate falls outside a clause written about _suppression_ mechanisms is a decision someone must record, not infer.
- **ADR-008:30-31** — _"`reportViolations(violations, { format, reason })` is the single emitter … **It never throws or filters.**"_ Ask A makes it filter, and via `finishPreset` throw, on inputs that pass today. That is an amendment to ADR-008's text, not an implementation of it.

A third, weaker: ADR-011 §1, since A changes the contract of two root symbols across six independently-versioned packages.

The decision A actually asks for is one sentence: **the emission seam, not only the terminal seam, requires evidence — a verdict handed to `reportViolations`/`finishPreset` must carry proof it was examined.** ADR-010 §2 binds _"every published family's terminal path — `.check()` / `.warn()`"_ and is silent on the preset/reporter path, which is exactly why the gap this proposal found is reachable. That silence is the finding, and closing it is an ADR — call it 014 — with a plan under it. This does not change the ruling; it sharpens what "take A back to design" means.

That ADR is now accepted:
[ADR-014 — the emitter refuses a verdict without evidence](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
(Accepted 2026-09-03). Ask A's row reads `Accepted, reshaped` → plan 0235; the redesign it owed is ADR-014 §1–§2, which takes the receipt as a required field rather than a mint.

### Disposition, per ask

A proposal is a design record; it does not become work. `Split and sequence` means the split comes before any plan, so three rows below are `Held` — not as a soft no, but because no owner exists yet and this lane refuses an `Accepted` row whose owner does not resolve. Each `Held` row states what would unhold it. Rejected parts stay here with the reason, so the same ask does not return.

| ask                                                                               | disposition            | owner / condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — the emitters accept only pipeline-minted violations                       | **Accepted, reshaped** | [plan 0235](../plans/0235-the-emitter-takes-a-receipt.md), building [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) (Proposed). Reshaped in two ways the review established: the device is a **required field on the emitter's input**, not a `WeakSet` registry — the measured failure was an honest omission, not forgery, and a registry cannot see `[]` — and the shape is the **container** (`CollectResult`, `{ violations, examined }`), not the element. Hand-assembly stays legal; an evidence-free verdict does not. The ADR names the ceiling: a wrong `examined` is a lie someone types, not an oversight nobody can see |
| **B** — preset plumbing off the root                                              | **Rejected**           | Premise false: `docs/api-reference.md:566-568` documents all three and `packages/core/README.md:54` documents `Dispatchable`. They are also public `eess-md` (`packages/md/src/index.ts:30-31`) and `eess-ts` (`packages/ts/src/index.ts:489,542`) API, so moving them to `/internal` breaks `family/re-export-complete`'s invariant. On the record so the ask does not return                                                                                                                                                                                                                                                                                  |
| **C** — a rule banning direct emitter calls outside rule/test files               | **Accepted, reshaped** | [plan 0237](../plans/0237-eess-runtime-use-only-in-rule-files.md) (Draft, 2026-09-03) carries both narrowings this row required: drop `dispatchRule` from the banned pattern (it is the sanctioned preset-authoring call, used correctly at `packages/md/src/rules/adr.ts:131-141`), and widen the exemption past `*.rules.ts`/`*.test.ts` to cover gate scripts, a shape this repo ships five of. Ships `@nielspeter/eess-ts` minor; the changelog must name the rule id and the `overrides` opt-out                                                                                                                                                           |
| **D** — document that the dead-selector finding already ships on the builder path | **Held**               | No design question remains — it is a discovery fix, not new API, and carries zero risk. Unholds on a docs change owning it (`none` changesets)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Before A leaves `Held`, this record owes** the container-mint redesign written out, and the ADR conflicts above argued rather than noted — the current Proposed API section describes a mechanism the review found cannot deliver its own headline case.
