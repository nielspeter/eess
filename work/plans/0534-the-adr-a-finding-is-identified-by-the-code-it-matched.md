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

| clause                                                                                                                                                                                      | tier | mechanism, built by                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| identity is derived from the matched node's shape; position appears only to separate byte-identical shapes within one scope                                                                 | 2    | the seven-edit table and the `identityCollisions()` pin (plan 0533)              |
| no condition may mint an identity from a line number                                                                                                                                        | 1    | an arch rule over `packages/ts/src/conditions/`, run by `check:arch` (this plan) |
| a finding about a file is matched by its file. Not every finding: a slice cycle edge or a duplicate cluster belongs to no single file, and a finding with an empty `file` keeps today's key | 2    | the structural cross-run property test (plan 0532)                               |

The ADR also records, as decided context rather than new clauses: decision **E** (the matcher
checks the recorded file; maintainer, 2026-10-06, spike 0390), which plan 0346's ledger says "Phase
4's ADR carries"; and spike 0394's decisions 1 and 2 (per-file grouping; a rootless eess-ts baseline
matches nothing). If the author finds the no-root rule binding on the next change, it is a fourth
clause, and plan 0532's no-root row is its mechanism.

## Phases

All in one PR, into `main`.

**Phase 1: the arch rule for the line clause.** A Tier-1 rule over `packages/ts/src/conditions/`
that reds a condition building an `identity` from a line number, with its non-vacuity fixture (a
planted condition that does). Written first, so the row cites a mechanism that exists.

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
| `arch.rules.ts`                                             | the line clause's rule                           |
| `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/`       | the arch rule's planted fixture                  |
| `CLAUDE.md`                                                 | the ADR index row                                |
| ADR-009 or ADR-010, if extended                             | an `**Extended by:**` line                       |

## Test inventory

| break class                            | what must go red                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| the line clause's rule                 | the planted condition minting an identity from `getStartLineNumber()` reds `check:arch`; `check:nonvacuity`'s row proves it |
| a cited test title that does not exist | `check:crossval` resolves every `it('…')` the table cites against the real test AST                                         |
| a cited path that does not exist       | `check:corpus`'s `adrEnforcement`                                                                                           |
| an Extends without its link back       | `check:corpus`'s `corpus/adr-extends-linked-back`                                                                           |
| the index row                          | `check:spec`                                                                                                                |

**Sabotage matrix.** One row: delete the line clause's rule from `arch.rules.ts`, and the
non-vacuity row reds. The other rows are existing gates over the new ADR, and the build records each
gate's output.

## Out of scope

- **The mechanisms of the shape and file clauses**: plans 0533 and 0532 build them; this plan cites
  them.
- **Whether `.excluding()` and `// eess-exclude` key on identity**: spike 0386 and Proposed ADR-018
  (plan 0346, Out of scope). This ADR is upstream of that decision and does not make it.

## Progress ledger

- [ ] plans 0532 and 0533 merged to `main` before this plan is Ready
- [ ] Phase 1 — the line clause's arch rule and its planted fixture
- [ ] Phase 2 — the ADR, authored through `adr-enforce.mjs` so author ≠ validator
- [ ] **no `pending` rows** when it closes
- [ ] Phase 3 — the `CLAUDE.md` index row
- [ ] `npm run validate` green at the PR's head

Deferred: none.
