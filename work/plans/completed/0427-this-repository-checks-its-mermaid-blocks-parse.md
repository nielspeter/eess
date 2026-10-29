# Plan 0427: this repository checks that its Mermaid blocks parse

## Status

- **State:** Done — built 2026-10-16 as `check:mermaid-parses`, from Draft: this plan was never
  marked Ready. Its design was reviewed inside [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md)'s freeze reviews (PR #219), where it was
  0413's "Dogfood row"; the departures from it are under "Decided at the build". Split out of
  [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md) at its freeze, 2026-10-15.
- **Implements:** [proposal 006](../../proposals/006-mermaid-beyond-classdiagram.md) — Ask C's dogfood consumer.
- **Priority:** Medium, the same as [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md) and never lower — the dogfood half of Ask C, and the
  only production-tier proof of the parser. The parser ships without it, so it is no longer the
  parser's merge condition.
- **Effort:** Small — one script gate and one non-vacuity row, as planned (built with six rows, see
  below); no new dependency.
- **Created:** 2026-10-15
- **Depends on:** [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md) (`mermaidParser()`).

## Problem

[Plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md) ships `mermaidParser()`. This repository has Mermaid blocks in `work/`, `adr/` and `docs/`
and no gate that they parse. It was split out of 0413 so each is one reviewable PR. The 179 MB install
([spike 0425](../../spikes/0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md)) is already paid by 0413's tests, which make `mermaid` and `jsdom` eess-mermaid dev
dependencies.

## Design

- **Scope:** every tracked `*.md` file (`**/*.md`, without `node_modules`), so a diagram added to a
  README, `kit/`, a skill or `work/*.md` is checked without anyone remembering to list it. An
  allowlist would be [bug 0210](../../bugs/fixed/0210-er-fence-selector-is-an-allowlist.md)'s selector class. The gate prints its own count; this plan pins none,
  since [bug 0426](../../bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md)'s case-folding changes it.
- **Exclusions, by glob (condition 13)**, each the tree of fixtures that are broken on purpose,
  measured 2026-10-15 over tracked Markdown: `packages/crossvalidate/tests/fixtures/**` (30 files with
  a Mermaid fence), `packages/md/tests/fixtures/**` (6) and `scripts/nonvacuity/**` (14). The build
  re-measures them; an exclusion that matches no block is dropped ([ADR-018](../../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)). The fences in
  `work/bugs/fixed/` sit inside four-backtick fences, so they are not blocks and need no exclusion.
  Nothing is excluded by comment.
- **Where:** a script gate, `check:mermaid-parses`, in the `validate` chain beside `check:corpus`. It
  is a script, not an eess-ts rule file, so it calls `dedupeConfigFindings` itself ([plan 0412](./0412-a-code-block-parses-with-the-parser-the-caller-names.md)), and it
  prints the success line from the fact object's summary. CLAUDE.md's gate-output table gains its row.
- **The break:** a dangling `Route -->` added to `docs/manifesto.md`'s `graph` block reds it.
- **Cost:** the install is already in the workspace from [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md). The validate chain's added time is
  measured and recorded here before merge.

## Files Changed

- `scripts/check-mermaid-parses.mjs`, `package.json` (script and `validate`).
- `scripts/nonvacuity/` — the gate's production-tier row: "a dangling `Route -->` added to
  `docs/manifesto.md`'s `graph` block reds `check:mermaid-parses`, naming `docs/manifesto.md` and the
  line", matching on that file and line. The harness's gate list claims it.
- `CLAUDE.md` — the gate-output table row.
- `.changeset/` — `none` for every package (this repository only). As built: no changeset, see below.

## Test inventory

- The gate reds on the manifesto break, naming file and rule.
- The gate prints eess-md's success line, "N mermaid blocks parsed with mermaid X.Y.Z"
  (`packages/md/src/model/code-block-parse.ts:374`). Checked by hand at the build; no row asserts
  the green line.

## Out of scope

- The parser itself — [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md).

## Decided at the build (2026-10-16)

Each is overrulable.

- **Scope is the Markdown git sees, not a glob.** Measured: `corpus()` with the root glob
  `**/*.md` loaded 843 documents against 862 tracked. It missed the 22 tracked files under
  `.claude/` and `.changeset/`, because a `**` segment does not enter dot directories, and it
  loaded 3 gitignored files under `reports/` that CI never sees. The plan's own words were "every
  tracked Markdown file", so the gate asks git: `git ls-files --cached --others --exclude-standard`.
  Untracked files that are not ignored count too (an enforcement review finding), so an author who
  runs the gate before `git add` has their new diagram checked. Each path becomes a literal root; a
  path containing a glob character is refused, not read as a pattern (none does today). The gate
  also checks that every listed path loaded.
- **An exclusion is resolved against the rule's violations, and a stale one is a finding.** The plan
  said "an exclusion that matches no block is dropped". As first built, the gate counted blocks;
  the enforcement review measured that 60 of the 77 excluded blocks are valid, so an exclusion
  whose broken fixtures were all fixed would have stayed green. The gate now parses the excluded
  blocks too and calls an exclusion stale when no block under it fails. This follows [ADR-018](../../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)'s
  rule 1, but [ADR-018](../../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md) is Proposed, so it is the direction, not a binding ruling. The kernel's
  `.excluding()` was not used: it only warns on an unused pattern.
- **`check()` reports, so there is no `dedupeConfigFindings` call.** The gate runs one rule, so
  there is nothing to dedupe, and `check()` already owns the reporting ([ADR-008](../../../adr/008-caller-owns-reporting.md)) and refuses a run
  that examined no block ([ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)). The gate's own findings (stale exclusion, unsafe path, a path
  that did not load, git unavailable, excluded blocks unparseable) go to the same places: stderr,
  and stdout under `--format json`. The success line embeds `parsed.summary()`.
- **Six non-vacuity rows, not one**, one per check (`GATE_FOR`'s doctrine):
  `mermaid-parses/manifesto-break` (the plan's row: the real gate over the real tree, the finding
  on `docs/manifesto.md` at the planted line), then five that run the gate from a scratch git
  repository: `stale-exclusion` (exclusions holding only valid blocks, in both formats),
  `no-block`, `dot-directory`, `unsafe-path` and `untracked`. Measured by sabotage of the gate,
  one mechanism at a time, each reds the row named for it:
  - stale-exclusion check skipped, or counting documents instead of violations: `stale-exclusion`;
  - stale findings left out of the JSON stream: `stale-exclusion`;
  - `--others` dropped: `untracked`;
  - unsafe-path check emptied: `unsafe-path`;
  - `violations()` in place of `check()`: `manifesto-break`, `no-block` and `dot-directory`.
- **Unpinned guards:** the loaded-every-path check, the git-unavailable finding and the
  excluded-blocks-unparseable finding have no row. Each fails closed (a finding, exit 1), but
  nothing reds if one is deleted.
- **The gate also runs in `ci.yml`**, beside `check:corpus`: the harness checks that CI runs every
  `validate` step.
- **No changeset.** done-otherwise: nothing under `packages/` changed, so `check:release` asks for
  none.
- **What it checks today:** 4 Mermaid blocks in the 530 documents outside the exclusions
  (`docs/architecture.md`, `docs/eess-walkthrough-calculator.md`, `docs/manifesto.md`, [proposal 010](../../proposals/010-ts-performance-at-scale.md)). The fences in `work/bugs/fixed/` sit inside four-backtick fences. Not pinned; the gate
  prints it.
- **Residual:** when every block is excluded, the kernel's refusal speaks of "an empty project, an
  unreadable tsconfig, or a glob resolving to nothing", which is the kernel's wording for every
  dialect. The gate's own line says "0 mermaid blocks parsed".

## Cost, measured

- `check:mermaid-parses`: 4.2 s on this tree. The method review timed the first build's phases:
  loading the corpus took about 2.3 s and ran twice, and the worker plus the parse took about
  0.5 s. The rebuilt gate loads each file once (the kept and the excluded files as two corpora)
  and starts the worker twice.
- The six non-vacuity rows: 12 s together, run standalone.
- The whole `validate`: 632 s on the first build's tree, against 612 s on [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md)'s. A different
  tree, so an indication, not a measurement of this plan alone.

## Progress ledger

- [x] the gate, its row and its CLAUDE.md line — six rows, see above
- [x] validate chain's added time measured and recorded — see "Cost, measured"

Deferred: none
