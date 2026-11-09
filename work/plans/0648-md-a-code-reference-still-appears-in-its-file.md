# Plan 0648: md: a code reference still appears in its file

## Status

- **State:** Draft — authored 2026-11-09 from
  [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A1, as
  ruled in its fourth Review. It is the second of three plans that own A1, and is built after
  [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md).
- **Implements:** [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)
  (ask A1: the file condition)
- **Priority:** High. It catches a renamed, removed or moved name that a cited pointer still
  resolves to, in any language, with no code facts.
- **Effort:** Medium, about two hours.
- **Created:** 2026-11-09
- **Decided, each overrulable:**
  - **The condition is `mentions(…).should().appearInTheirFile(options?)`**, as [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md) names
    it. It takes `externalRoots`, which `pointers().resolve()` also takes.
  - **The shared parts are built here and reused by
    [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md):** the path classifier, the
    mention requirements and the configuration refusals.
  - **The stock example runs it at `.warn()`.** Over this repository 7 of its 27 reds are right
    ([proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md), Appendix B). Severity is the caller's.

## Problem

A pointer that resolves to a file and a line in range is green under `pointers().resolve()`,
whatever the sentence names. When the named function is renamed or removed, the reference still
passes ([bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)). Over this
repository's before-form pairs, 27 (9 live) name something whose token appears nowhere in the cited
file. A judge on a different model read all 27: 7 are renames (2 of the 9 live), 9 are pinned to an
old commit, 6 are pairing artefacts, and 5 are sentences saying the name is absent.

## Phase 1 — the path classifier

Extract the resolution inside `pointerResolves`
(`packages/md/src/conditions/pointer-resolve.ts:107-264`) into one function. It classifies a cited
path and line as one of:

- `resolved`, with the file's relative path and text;
- `broken`;
- `ambiguous`;
- `stale` (past the end);
- `external`, with the absolute path.

It reads files as the pointer check does (`readCorpusFile`, line 102; an external file through
`readFileSync`, line 180). `pointerResolves` calls it and keeps its documented `externalRoots` skip.
Every existing test of `pointers().resolve()` passes unchanged, which is how this phase proves it
changed nothing.

## Phase 2 — the requirements and the refusals

Shared by both conditions:

- **Configuration, refused when the rule is built** (an `ArchConfigError`):
  - a pattern without the `name`, `path` or `line` group;
  - a rule over a `mentions()` reading without `keepBackticks`. A rule built that way names its
    cause instead of examining nothing.
- **Per mention, one finding under the condition's own id:**
  - `name` or `path` missing from `codeGroups`: "write the name and the pointer each in its own
    code span";
  - a group that did not capture: "the pattern's `line` group did not capture here; make it
    required".
- **A dotted name** `a.b.c` is judged as `c`, and the message says so.

## Phase 3 — the condition

`appearInTheirFile()` classifies each mention's path (Phase 1).

- **Broken, ambiguous or stale:** one finding per reference, under this rule's id. Beside
  `pointers().resolve()` that is a second report, and the changeset says so.
- **External:** the external file's text is read.
- **Otherwise the verdict.** The reference holds when the cited file's text holds the name as a
  whole token (the boundary is `[A-Za-z0-9_$]`, as the instrument's). When it does not, the finding
  is: "`X` no longer appears in F. If it was renamed, write its new name; if it moved, cite the
  file it moved to. If the sentence says `X` is gone, historical or at an old commit, take the name
  or the pointer out of the reference form."
- **The element** carries the name and the pointer, so two findings on one line do not collide.

## Phase 4 — the example and the docs

`examples/md/a-code-reference-still-appears-in-its-file.test.ts` holds the stock pattern and a
`corpusFromText` corpus. Its fixture cases are:

- a reference that holds;
- a renamed name;
- a name moved to another file;
- a pinned reference, red, whose remedy clause is asserted;
- a broken pointer;
- a pattern without its `line` group, refused;
- a reading without the opt-in, refused.

The README and `docs/markdown.md` say three things:

- the rule claims the file holds the name, not that the name is code there, or that the line does;
- its rate over this repository;
- what one rule per condition means.

## Files changed

- `packages/md/src/conditions/pointer-resolve.ts`
- `packages/md/src/conditions/code-path.ts` (new: the classifier)
- `packages/md/src/conditions/code-reference.ts` (new: the requirements and refusals)
- `packages/md/src/conditions/appear-in-their-file.ts` (new)
- `packages/md/src/builders/mentions.ts`
- `packages/md/src/index.ts`
- `packages/md/tests/conditions/appear-in-their-file.test.ts` (new)
- `examples/md/a-code-reference-still-appears-in-its-file.test.ts` (new)
- `scripts/check-nonvacuity.mjs`
- `scripts/vacuity-matrix.mjs`
- `docs/markdown.md`
- `packages/md/README.md`
- `.changeset/`

## Test inventory

Each finding is asserted by its cause, a message fragment, never by rule id and severity alone.

- [ ] Every class in Phases 2 and 3, one test each, through the public root.
- [ ] A name present only in a comment of the cited file holds. This is the rule's stated limit,
      pinned so it cannot be read as a claim it does not make.
- [ ] A whole-token match: `pathSuffix` does not hold where the file has only `pathSuffixIndex`.
- [ ] An external root: a reference into it is read from disk. The fixture is a tree under
      `examples/fixtures/`, since `corpusFromText` refuses `externalRoots`
      (`packages/md/src/conditions/pointer-resolve.ts:82-89`).
- [ ] Every existing `pointers().resolve()` test passes unchanged.
- [ ] Zero examined is the kernel's finding unless declared; with `.expectEmpty()` over no
      reference, green.
- [ ] Two `check:nonvacuity` rows against `check:examples`, each asserting a named test's cause:
  - `examples/md-a-renamed-reference-is-red`: the token check always true. The renamed case goes
    red on "no longer appears".
  - `examples/md-a-failed-capture-is-a-finding`: the capture check removed. The case goes red on
    "did not capture".
- [ ] The sabotage matrix, in a worktree with its own install, one mutant at a time.

## Out of scope

- The line condition, the `CodeFacts` contract and the facts' emptiness: plan
  [0649](./0649-md-a-code-reference-resolves-at-its-lines.md).
- This repository's wiring and its severity, which belong to the plan that brings ask A2's facts.
- A lookahead in the stock pattern for a commit-pinned pointer. That is the wiring plan's to
  measure over this repository's references.
