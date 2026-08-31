# Plan 0188: Unify the duplicated engine modules

## Status

- **State:** Draft — the two decisions it turns on are stated but not made.
- **Priority:** **High** — raised 2026-08-21. This read "Medium — nothing is
  broken today", and that was falsified within the same PR: `packages/core`'s
  `RuleBuilder.fork()` still cleared its condition list, so
  `.should().X().should().Y()` silently dropped `X` for `eess-md`,
  `eess-mermaid` and `eess-gherkin` — and `check:corpus`, `check:ledger` and
  `check:diagram` are md/mermaid gates, so this repo's own corpus enforcement
  ran on the defective copy. The fix had landed in `packages/ts` with the engine
  copy and never reached the kernel. Something WAS broken today, in exactly the
  way duplication breaks things, and nothing noticed until an architect review
  read both copies side by side.
- **Effort:** Large — two ADRs first, then a mechanical move with a real gate.
- **Created:** 2026-08-21

## Problem

[Plan 0165](./completed/0165-integrate-the-copied-ts-archunit-engine.md)
Phase 2 re-split the kernel and stopped at a stated line: **27 ts-morph-tainted
modules remain duplicated** between `packages/core/src` and
`packages/ts/src/core`, including the whole builder stack — `rule-builder`,
`terminal-builder`, `execute-rule` — plus `exclusion-comments`,
`project-relative`, `path-universe`, `disk-set` and `combinators`.

0165 was right to stop: unifying them is not a move, it turns on two design
decisions that constrain all five dialects, and this repo's own rule is that a
binding design decision belongs in `adr/` and not buried in a plan. This plan
exists so those decisions have an owner, and so the deferral 0165 closed with
points at something real.

## The state, measured 2026-08-21

`packages/ts/src/core/terminal-builder.ts` is **917 lines** against the kernel's
**455**, and the split runs down the middle of the family:

|                                    | builders                          | `TerminalBuilder`                  |
| ---------------------------------- | --------------------------------- | ---------------------------------- |
| `eess-md` (6) · `eess-mermaid` (1) | extend the kernel's `RuleBuilder` | `packages/core` — 455 lines        |
| `eess-ts` (9 importers)            | extend the ts `RuleBuilder`       | `packages/ts/src/core` — 917 lines |

The ts copy is a **diagnosis superset**, not a different contract: 17 methods
the kernel's lacks (`narrowingHint`, `examinedUnitNoun`, `zeroSubjectsAdvice`,
`ownsDiscoveryDiagnosis`, `assertionAdvice`, `asSeverity`, …). Both enforce
ADR-010's floor. md and mermaid adopters get a generic zero-examined message
where eess-ts names the narrowing and the unit noun — a weaker **diagnostic**,
not a weaker gate. That is the honest size of the gap and the reason this is
Medium rather than High.

## Why it is worth doing anyway — two measured consequences

**A fix lands on one copy and nothing notices.** Three demonstrated cases now —
and the third is the freshest, which is the argument this section most needed:
the hazard is not historical, it fired again nine days ago.

**Bug 0156, the kernel half.** `fork()` cleared conditions in `packages/core`
long after `packages/ts` stopped doing so. Three dialects and three of this
repo's own gates ran on it. Porting the one-line fix changed no test result
anywhere, so the suite could not tell either; the guard that closes it was
written in the same PR that found it.

**Bug 0163**, the original case: `setCallerAggregatesReports` arrived with the engine
copy and is wired end to end on the eess-ts path, while the kernel's
`executeWarn` still reports unconditionally — the exact line that bug cites. It
went half-fixed and no record said so until 2026-08-21.

**Bug 0227**, 2026-08-31, the newest. PR #88 fixed bug 0158 in
`packages/core/src/exclusion-comments.ts` — a reason-free `eess-exclude-start`
now reports against the `-start`. `packages/ts/src/core/exclusion-comments.ts`
never got it, so the dialect adopters install is **silent** on a bare `-start`
and blames the `-end` line for a fault on the `-start`. Nothing suppresses
wrongly, so no gate could notice; the divergence was found by running
`smells.duplicateBodies()` over this repo a week later, which is not a mechanism.

That case also carries a warning for this plan's own method. Comparing the two
copies by TEXT gives a wrong answer: grepping for bug numbers and fix keywords
says eess-ts is missing bug 0154's string-literal protection too. It is not —
eess-ts uses ts-morph's real lexer where the kernel had to hand-roll masking to
stay ts-morph-free. Same protection, different mechanism, zero shared
vocabulary. Any audit of what has and has not travelled between these copies has
to be behavioural.

**One hazard is held shut by a containment, not a fix.** 0165 Phase 2 names it:
module-level state in `execute-rule.ts` read by one copy and written by the
other. `src/cli/import-rule-module.ts` keeps it from firing by loading rule files
natively wherever it can. Measured today, the state is
`packages/ts/src/core/execute-rule.ts`'s `callerAggregatesReports`, and the
kernel copy has no equivalent — so the two copies cannot disagree about a value
only one of them holds. The containment is real and the hazard is currently
latent; neither is a reason to leave two copies.

## The two decisions — ADRs, not phases

**1. A project abstraction for the kernel.** The kernel has _no_ project concept
(`PathUniverse` is its pure stand-in). Giving it one constrains all five dialects
forever. Re-measured for this plan, the coupling is thinner than 0165 recorded:
the ts `terminal-builder` touches `ArchProject` in **3** places — `import type`,
`getProject()`, `zeroSubjectsViolation(project)` — not 5.

**2. A pluggable tokenizer for `exclusion-comments`.** The copied version blanks
string literals with a real ts-morph tokenizer (bug 0154's fix); the kernel's
does a regex scan. The other four dialects have no TS AST, so the kernel needs an
injection point rather than a choice between the two.

Both are prerequisites. Neither is this plan's to settle by writing code.

## Implementation phases

### Phase 1 — write the two ADRs

Use `eess-adr-author` then `eess-adr-validate` (or `.claude/workflows/adr-enforce.mjs`,
which keeps author and validator on different models). Each needs its
`## Enforcement` table with honest tiers. **Stop and get the decisions ratified
before Phase 2.**

### Phase 2 — unify, one module at a time, measured

Take the 27 in dependency order, smallest coupling first. After each: full suite,
`check:family`, `check:arch`, `check:nonvacuity`. A module whose unification
changes behaviour for md/mermaid stops the phase and gets a record.

### Phase 3 — a gate that keeps them unified

The thing 0165 lacked. Something that reds when a kernel concept re-forks into a
dialect — otherwise this plan's result decays exactly the way the fold did, and
the next reader gets a third copy. Prove it by sabotage: re-fork a module, the
gate must red.

## Out of scope

- **ADR-008's preset default**, 0165's third deferral. Was filed separately as
  [bug 0189](../bugs/fixed/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md)
  and is now **fixed** — the engine enforces again by default and the ADR row
  cites a mechanism that fails. Kept in this list as a pointer rather than
  deleted: it was one of 0165's three deferrals, and a reader tracing where those
  went should find all three.
- Changing what md/mermaid adopters see. Better diagnostics for them are a
  _consequence_ this plan may enable; promising them here would make the success
  definition untestable.

## Success definition

- The 27 count is **zero**, or every survivor carries a written ruling naming why
  it must stay forked.
- `npm run validate` green; `check:family` green **and** non-vacuous.
- A gate exists that reds on a re-fork, sabotage-proven.
- No capability, message or finding available to any dialect before is missing
  after — asserted per dialect, not in aggregate.

## Progress ledger

- [ ] Phase 1 — the two ADRs written, validated, ratified
- [ ] Phase 2 — 27 → 0 (or ruled), each step measured
- [ ] Phase 3 — the anti-re-fork gate, sabotage-proven

Deferred: none.

## Measured inventory, 2026-08-31 — and it is now on every `validate` run

This plan argued its case from two incidents and a reading of the tree. There is
now a standing measurement, because eess started dogfooding its own
`agentGuardrails` preset (`check:guardrails`, added the same day). Its
`no-copy-paste` rule reports **84 warnings** across `packages/*/src/**`:

|                     | count  |
| ------------------- | ------ |
| cross-package pairs | **21** |
| within one package  | 63     |

The 21 are this plan's subject, and ten of them are **byte-identical**:

```
100%  assertHomogeneous        core ~ ts
100%  parseRuleIdsAndReason    core ~ ts
100%  isExcludedByComment      core ~ ts
100%  viewsFor                 core ~ ts
100%  validateOverrides        core ~ ts
100%  RuleBuilder.select       core ~ ts
100%  TerminalBuilder.excluding core ~ RuleDeclaration.excluding (ts)
 97%  DiffFilter.filterToChanged core ~ ts
```

Plus a second cluster this plan's title does not cover but its argument does —
the **CLI**, duplicated mermaid↔ts rather than core↔ts:

```
100%  requireRuleFiles         mermaid ~ ts
100%  findConfigFile           mermaid ~ ts
100%  RunScheduler.schedule    mermaid ~ ts
 98%  RunScheduler.executeRun  mermaid ~ ts
 98%  watchAndRerun            mermaid ~ ts
 99%  walk                     crossvalidate ~ md
```

`watchAndRerun` is the pair bug 0169's correction names as a literal copy-paste
differing in two tokens. None of these has a decision blocking it — they are not
waiting on this plan's two ADRs, which are about the kernel gaining a project
abstraction and a pluggable tokenizer. **A CLI-and-helpers slice could ship
before either decision is made.**

### Why the number is trustworthy now, and was not before

The count used to be quoted as **270** by-design-similar rule-wrapper bodies, in
`check-baseline.mjs`'s written rationale for not running the preset at all. Both
halves were wrong: it is 84, and they are largely true duplicates rather than
by-design similarity (bug 0169's correction of 2026-08-31 read the bodies —
`check` ~ `warn` differs in one call target, the metrics conditions differ in a
measure and a message). The rationale was self-sealing: it was the reason not to
run the preset, so nothing tested it.

### What changed structurally

The debt is no longer argued, it is **printed on every `validate` run** with this
plan named as its owner. That is the difference between a deferral and an
exemption — and this plan's own thesis is that a deferral nothing measures is how
`fork()`, `setCallerAggregatesReports` and bug 0227 each survived.

Deciding not to fold this plan into the PR that produced the measurement was
deliberate: its two prerequisites are ADR-shaped, and this plan already says
"neither is this plan's to settle by writing code."
