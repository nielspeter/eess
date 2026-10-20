# Plan 0534: the ADR — a finding is identified by the code it matched

## Status

- **State:** Draft — written 2026-10-20 as the last record of
  [plan 0346](./0346-a-finding-is-identified-by-the-code-it-matched.md)'s split ("The split", item 5):
  its Phase 4. **Written last on purpose** (plan 0346, Phase 4): an ADR written before its mechanisms
  exist lands every Enforcement row at `pending`, and
  [plan 0263](./completed/0263-adr-014s-residual-enforcement-rows.md) is the five-phase, four-PR bill
  for that. So this plan holds the ADR's clauses and their named mechanisms now, and writes the ADR
  once plans 0532 and 0533 have merged.
- **Priority:** High — the binding rule the next producer must follow. Without it, the rule lives in
  plan and bug records that freeze when they close (bug 0330).
- **Effort:** Small, one PR. One ADR, its Enforcement table, one Tier-1 arch rule, and the index
  rows.
- **Created:** 2026-10-20
- **Parent:** [plan 0346](./0346-a-finding-is-identified-by-the-code-it-matched.md), which closes
  when its children do.
- **Builds after:** [plan 0532](./0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md)
  and [plan 0533](./0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md), both merged
  to `main` through `release/0346-phase2`. Every mechanism it cites must exist on the tree it is
  written on.

## Problem

Plan 0346 decides how a finding is identified for a baseline: by the matched node's shape, never by
position or line, and, for a finding about a file, by its file. Those decisions are recorded in
plan 0346, bug 0338's Fix and spikes 0350, 0390 and 0394. Per
[bug 0330](../bugs/0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md), a binding rule the
next change must follow does not belong in a record that is about to be frozen. It needs an ADR.

## The clauses, and the mechanism each must cite

From plan 0346, Phase 4, **at minimum**. Each has its mechanism named before the ADR is written, so
that "no `pending` rows" cannot turn into "drop the clauses that cannot be gated":

| clause                                                                                                                                                                                      | tier | mechanism, built by                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------- |
| identity is derived from the matched node's shape; position appears only to separate byte-identical shapes within one scope                                                                 | 2    | the seven-edit table, the ordinal's-key row and the `identityCollisions()` pin (plan 0533)                             |
| no producer may mint an identity from a line number or a source position                                                                                                                    | 1    | an arch rule over every place an `identity` is constructed, at least `packages/*/src`, run by `check:arch` (this plan) |
| a finding about a file is matched by its file. Not every finding: a slice cycle edge or a duplicate cluster belongs to no single file, and a finding with an empty `file` keeps today's key | 2    | the structural cross-run property test (plan 0532)                                                                     |
| an `identity` is unique per rule **and file** (the kernel's `ArchViolation.identity` contract)                                                                                              | 2    | plan 0532's per-file reservation row (C12a) and C14's subject row                                                      |
| grouping for disambiguation is per file                                                                                                                                                     | 2    | plan 0532's per-file grouping rows, R3 and R4 (C12)                                                                    |

**The last two are kernel contracts across the family** (architect review of PR #255, I2): plan 0532
changes `ArchViolation.identity` from unique per rule to unique per rule and file, and grouping with
it. They bind the next change, in particular
[plan 0188](./0188-unify-the-duplicated-engine-modules.md), which must follow them when the sibling
dialects gain disambiguation (spike 0394, census C15). So they are clauses, not context. If spike
0395 sends per-file grouping back to the maintainer, these two clauses follow whatever is decided.

**The line clause's scope is every producer, not `conditions/`** (architect I2, enforcement item 5).
On 2026-10-20, `identity:` is constructed in these modules, and the rule must examine each:

- `packages/core/src/violation.ts` (the suffixes `disambiguateIdentities` assigns);
- `packages/ts/src/conditions/`: `match-identity.ts`, `body-analysis.ts`, `body-analysis-module.ts`,
  `body-analysis-function.ts`, `dependency.ts`, `call.ts`, `slice.ts`, `exports.ts`;
- `packages/ts/src/core/metric-violation.ts`, `packages/ts/src/rules/errors.ts`,
  `packages/ts/src/smells/duplicate-report.ts`, `packages/ts/src/smells/inconsistent-siblings.ts`,
  `packages/ts/src/builders/call-rule-builder.ts`.

The matched pattern is named now, because this plan's premise is that the mechanism is named before
the ADR: inside an `identity` property's initializer, and inside any function of the same module
whose result it is built from, no call to `getStartLineNumber`, `getEndLineNumber`,
`getLineAndColumnAtPos`, `getStart`, `getPos` or `getEnd`. Where the rule cannot follow an identity
built in another module (such as `identifyMatches`' result used by `call.ts`), that module is
examined in its own right, and the Enforcement row states the rule's exact reach: which calls and
which directories. A row whose scope is narrower than its clause is reworded to the scope, never
marked `gated` over the wider claim.

The ADR also records, as decided context rather than new clauses: decision **E** (the matcher
checks the recorded file; maintainer, 2026-10-06, spike 0390), which plan 0346's ledger says "Phase
4's ADR carries"; and spike 0394's decision 2 (a rootless eess-ts baseline matches nothing). If the
author finds the no-root rule binding on the next change, it is a further clause, and plan 0532's
no-root row is its mechanism.

## Phases

All in one PR, into `main`.

**Phase 1: the arch rule for the line clause.** A Tier-1 rule over every producer listed above (at
least `packages/*/src`), with the matched pattern above, and its non-vacuity fixtures: a planted
producer outside `conditions/` (under `smells/`) that builds an `identity` from `getStartLineNumber()`,
and one that builds it from `getStart()`. Written first, so the row cites a mechanism that exists.

**Phase 2: the ADR, through the prescribed route.** Authored with
`.claude/workflows/adr-enforce.mjs`, which keeps the `eess-adr-author` and `eess-adr-validate`
agents separate and on different models. The separation matters more than usual here: the ADR's
author would otherwise also be the builder of the mechanisms it binds (plan 0346, Phase 4). It takes
the next free ADR number **when it is written**; the number is not written here, because plan 0346's
draft went stale once already (it said ADR-016, now Bounded Instruments). If the ADR declares
`**Extends:**` ADR-009 or ADR-010, each extended ADR gets its `**Extended by:**` line in the same PR
(`corpus/adr-extends-linked-back`).

**Phase 3: the index.** The ADR index table in `CLAUDE.md` (`check:spec` gates it). `README.md`
lists no ADRs today, so it needs no row.

## Files Changed

| file                                                        | change                                           |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `adr/NNN-a-finding-is-identified-by-the-code-it-matched.md` | new, Accepted, its Enforcement table all `gated` |
| `arch.rules.ts`                                             | the line clause's rule, over every producer      |
| `work/plans/0346-…` → `work/plans/completed/`, `ROADMAP.md` | the parent closed, its row struck                |
| `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/`       | the arch rule's planted fixture                  |
| `CLAUDE.md`                                                 | the ADR index row                                |
| ADR-009 or ADR-010, if extended                             | an `**Extended by:**` line                       |

## Test inventory

| break class                            | what must go red                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the line clause's rule                 | each planted producer (one under `smells/` using `getStartLineNumber()`, one using `getStart()`) reds `check:arch`; `check:nonvacuity`'s rows prove it |
| a cited test title that does not exist | `check:crossval` resolves every `it('…')` the table cites against the real test AST                                                                    |
| a cited path that does not exist       | `check:corpus`'s `adrEnforcement`                                                                                                                      |
| an Extends without its link back       | `check:corpus`'s `corpus/adr-extends-linked-back`                                                                                                      |
| the index row                          | `check:spec`                                                                                                                                           |

**Sabotage matrix.** Two rows: delete the line clause's rule from `arch.rules.ts`, and the
non-vacuity rows red; narrow its scope back to `packages/ts/src/conditions/`, and the `smells/`
fixture's row reds. The other rows are existing gates over the new ADR, and the build records each
gate's output.

## Out of scope

- **The mechanisms of the shape and file clauses**: plans 0533 and 0532 build them; this plan cites
  them.
- **Whether `.excluding()` and `// eess-exclude` key on identity**: spike 0386 and Proposed ADR-018
  (plan 0346, Out of scope). This ADR is upstream of that decision and does not make it.

## Closing order

1. Plans 0532 and 0533 close, with bug 0388, bug 0159's collision 3 and bug 0338's boxes, in the PR
   that merges `release/0346-phase2` to `main`. That merge is plan 0346's last open box.
2. This plan builds only after that merge. Its own PR closes it and moves plan 0346 to `completed/`,
   because 0346 closes when its last child does **and** the branch has merged to `main`, and both are
   true then.

## Progress ledger

- [ ] plans 0532 and 0533 merged to `main` before this plan is Ready
- [ ] Phase 1 — the line clause's arch rule and its planted fixture
- [ ] Phase 2 — the ADR, authored through `adr-enforce.mjs` so author ≠ validator
- [ ] **no `pending` rows** when it closes
- [ ] Phase 3 — the `CLAUDE.md` index row
- [ ] plan 0346 moved to `completed/` in this PR, its ROADMAP row struck, its last box (the
      integration branch merged to `main`) ticked
- [ ] `npm run validate` green at the PR's head

Deferred: none.
