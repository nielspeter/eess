# Plan 0427: this repository checks that its Mermaid blocks parse

## Status

- **State:** Draft — fixed for plan 0413's re-freeze reviews (wording, dependencies, pinned count,
  scope and exclusions, row text). Split out of [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md) at its
  freeze, 2026-10-15. Its design is 0413's original "Dogfood row", unchanged.
- **Implements:** proposal 006 — Ask C's dogfood consumer.
- **Priority:** Medium, the same as plan 0413 and never lower — the dogfood half of Ask C, and the
  only production-tier proof of the parser. The parser ships without it, so it is no longer the
  parser's merge condition.
- **Effort:** Small — one script gate and one non-vacuity row; no new dependency.
- **Created:** 2026-10-15
- **Depends on:** plan 0413 (`mermaidParser()`).

## Problem

Plan 0413 ships `mermaidParser()`. This repository has Mermaid blocks in `work/`, `adr/` and `docs/`
and no gate that they parse. It was split out of 0413 so each is one reviewable PR. The 179 MB install
(spike 0425) is already paid by 0413's tests, which make `mermaid` and `jsdom` eess-mermaid dev
dependencies.

## Design

- **Scope:** every tracked `*.md` file (`**/*.md`, without `node_modules`), so a diagram added to a
  README, `kit/`, a skill or `work/*.md` is checked without anyone remembering to list it. An
  allowlist would be bug 0210's selector class. The gate prints its own count; this plan pins none,
  since bug 0426's case-folding changes it.
- **Exclusions, by glob (condition 13)**, each the tree of fixtures that are broken on purpose,
  measured 2026-10-15 over tracked Markdown: `packages/crossvalidate/tests/fixtures/**` (30 files with
  a Mermaid fence), `packages/md/tests/fixtures/**` (6) and `scripts/nonvacuity/**` (14). The build
  re-measures them; an exclusion that matches no block is dropped (ADR-018). The fences in
  `work/bugs/fixed/` sit inside four-backtick fences, so they are not blocks and need no exclusion.
  Nothing is excluded by comment.
- **Where:** a script gate, `check:mermaid-parses`, in the `validate` chain beside `check:corpus`. It
  is a script, not an eess-ts rule file, so it calls `dedupeConfigFindings` itself (plan 0412), and it
  prints the success line from the fact object's summary. CLAUDE.md's gate-output table gains its row.
- **The break:** a dangling `Route -->` added to `docs/manifesto.md`'s `graph` block reds it.
- **Cost:** the install is already in the workspace from plan 0413. The validate chain's added time is
  measured and recorded here before merge.

## Files Changed

- `scripts/check-mermaid-parses.mjs`, `package.json` (script and `validate`).
- `scripts/nonvacuity/` — the gate's production-tier row: "a dangling `Route -->` added to
  `docs/manifesto.md`'s `graph` block reds `check:mermaid-parses`, naming `docs/manifesto.md` and the
  line", matching on that file and line. The harness's gate list claims it.
- `CLAUDE.md` — the gate-output table row.
- `.changeset/` — `none` for every package (this repository only).

## Test inventory

- The gate reds on the manifesto break, naming file and rule.
- The gate prints eess-md's success line, "N mermaid blocks parsed with mermaid X.Y.Z"
  (`packages/md/src/model/code-block-parse.ts:390`).

## Out of scope

- The parser itself — plan 0413.

## Progress ledger

- [ ] the gate, its row and its CLAUDE.md line
- [ ] validate chain's added time measured and recorded

Deferred: none
