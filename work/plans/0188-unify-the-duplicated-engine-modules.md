# Plan 0188: Unify the duplicated engine modules

## Status

- **State:** Draft — the two decisions it turns on are stated but not made.
- **Priority:** Medium — nothing is broken today, and one containment is already
  holding a real hazard shut. It is the last structural remainder of the fold.
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

**A fix lands on one copy and nothing notices.**
[Bug 0163](../bugs/0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md)
is the demonstrated case: `setCallerAggregatesReports` arrived with the engine
copy and is wired end to end on the eess-ts path, while the kernel's
`executeWarn` still reports unconditionally — the exact line that bug cites. It
went half-fixed and no record said so until 2026-08-21.

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

- **ADR-008's preset default**, 0165's third deferral. Filed separately as
  [bug 0189](../bugs/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md) —
  it is a documented clause contradicted by the code, which is a defect, not a
  structural decision.
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
