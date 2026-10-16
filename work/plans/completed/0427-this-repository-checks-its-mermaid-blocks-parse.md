# Plan 0427: this repository checks that its Mermaid blocks parse

## Status

- **State:** Done — built 2026-10-16 as `check:mermaid-parses`; the departures from the design are
  under "Decided at the build". Split out of [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md) at
  its freeze, 2026-10-15. Its design is 0413's original "Dogfood row".
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

## Decided at the build (2026-10-16)

Each is overrulable.

- **Scope is `git ls-files '*.md'`, not the glob `**/_.md`.** Measured: `corpus({ roots: ['\*\*/_.md'] })`loaded 843 documents against 862 tracked. It missed the 22 tracked files under`.claude/`and`.changeset/`, because `\*_`does not enter dot directories, and it loaded 3 gitignored files under`reports/`that CI never sees. The plan's own words were "every tracked`_.md` file", so the gate
  reads git. Each tracked path becomes a literal root; a path containing a glob character is refused,
  not read as a pattern (none does today).
- **An exclusion that covers no block is a finding, not "dropped".** The plan said the build drops
  one; the gate does it on every run instead, counting Mermaid blocks under each exclusion with
  eess-md's `tagIsLanguage` (ADR-019's one owner) before the exclusions are applied. The kernel's
  `.excluding()` was not used: it warns on an unused pattern, and a warning is not ADR-018's finding.
  All three exclusions are measured live; the fixture counts the plan pinned are not re-pinned.
- **`check()` reports, so there is no `dedupeConfigFindings` call.** done-otherwise: the gate runs
  one rule, so there is nothing to dedupe, and `check()` already owns the reporting (ADR-008) and
  refuses a run that examined no block (ADR-014). The plan's "prints the success line from the fact
  object's summary" holds: the line embeds `parsed.summary()`.
- **Four non-vacuity rows, not one**, one per check (`GATE_FOR`'s doctrine):
  `mermaid-parses/manifesto-break` (the plan's row: the real gate over the real tree, the finding on
  `docs/manifesto.md` at the planted line), `stale-exclusion`, `no-block` and `dot-directory` (the
  last three run the gate from a scratch git repository). Measured by sabotage of the gate, one
  mechanism at a time: removing the stale-exclusion loop reds `stale-exclusion` only; selecting by
  `**/*.md` reds `dot-directory` only; dropping the `ignore` reds `no-block` only; `violations()` in
  place of `check()` reds three; never failing reds all four.
- **The gate also runs in `ci.yml`**, beside `check:corpus`: the harness checks that CI runs every
  `validate` step.
- **No changeset.** done-otherwise: nothing under `packages/` changed, so `check:release` asks for none.
- **What it checks today:** 4 Mermaid blocks in 530 tracked documents outside the exclusions
  (`docs/architecture.md`, `docs/eess-walkthrough-calculator.md`, `docs/manifesto.md`, proposal 010).
  The fences in `work/bugs/fixed/` sit inside four-backtick fences. Not pinned; the gate prints it.

## Cost, measured

- `check:mermaid-parses`: 5.5 s inside `validate` (5464 ms, 4 blocks; mostly the worker's start-up).
- The four non-vacuity rows: 11 s together, run standalone.
- The whole `validate`: 632 s on this tree, against 612 s on plan 0413's. That is a different tree, so
  the difference is an indication, not a measurement of this plan alone.

## Progress ledger

- [x] the gate, its row and its CLAUDE.md line — four rows, see above
- [x] validate chain's added time measured and recorded — see "Cost, measured"

Deferred: none
