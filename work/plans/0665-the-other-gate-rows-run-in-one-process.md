# Plan 0665: the other gate rows run in one process

## Status

- **State:** Draft — filed 2026-11-28 as the home of what
  [plan 0662](./completed/0662-the-corpus-rows-run-in-one-process.md) left out of scope; not designed,
  not reviewed.
- **Priority:** Medium.
- **Effort:** Not estimated until its design is settled.
- **Created:** 2026-11-28

## Problem

[Plan 0662](./completed/0662-the-corpus-rows-run-in-one-process.md) ran the corpus rows of
`check:nonvacuity` in the harness's process. Two kinds of row still start a fresh process for every
gate run:

- **The ledger rows**, which start `scripts/check-ledger.mjs`. Its two exits read two lists
  ([bug 0661](../bugs/0661-check-ledger-exits-on-a-second-list.md)), which must become one verdict
  before its rows lose a process, as [bug 0548](../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md)
  did for the corpus gate.
- **The arch, family and diagram rows**, which start `eess-ts check` or `eess-mermaid check` and load a
  TypeScript project or a diagram each time. The same idea, a different engine: the project's load is
  ts-morph's, its caches are eess-ts's, and [plan 0662](./completed/0662-the-corpus-rows-run-in-one-process.md)'s inventory covered neither.

## What it must keep

[Plan 0662](./completed/0662-the-corpus-rows-run-in-one-process.md)'s design, as it held there: every row asserts what it asserts today; one row per gate runs
the real command; an inventory of the state the engine keeps, measured, with a reset for each piece
that must have one; a shard-end agreement check with a falsifier; a rewritten module sent to a fresh
process.

## Out of scope

Everything until a design is written and reviewed.
