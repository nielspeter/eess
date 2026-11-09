# Plan 0649: md: a code reference resolves at its lines

## Status

- **State:** Draft — authored 2026-11-09 from
  [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A1, as
  ruled in its fourth Review. It is the third of three plans that own A1, and is built after plans
  [0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md) and
  [0648](./0648-md-a-code-reference-still-appears-in-its-file.md).
- **Implements:** [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)
  (ask A1: the line condition and the contract)
- **Priority:** High. It catches a cited line that has drifted off the code it names, and a line
  that names it only in a comment or a string.
- **Effort:** Large, about four hours. It is one delivery: the contract has no consumer without
  the condition, and the condition no input without the contract.
- **Created:** 2026-11-09
- **Decided, each overrulable:** the contract and the rules are [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s section "Ask A1,
  rewritten 2026-11-09", as amended after its fourth review. This plan copies what it builds from
  that section and does not reopen it.

## Problem

A cited file can still hold a name while the cited line no longer does. Over this repository's
before-form pairs, the line rule below finds 105 that hold as code and 64 that lie in the named
declaration's doc comment, and reds 285: 62, 35 and 138 live ([proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md), the fourth review).

Text cannot judge a line. It is green on a doc comment that only mentions the name, and red on a
correct import or use. So the condition takes code facts from the caller, as `beLinked({ fix })`
takes its targets, and eess-md never imports a parser.

## Phase 1 — the contract

`CodeFacts` and `CodeName` are exported from the eess-md root, as the proposal gives them. In
outline:

- `coverage: ReadonlySet<string>`: a file is in it only when every declaration, import, use and
  attached doc comment in it is listed.
- `names: readonly CodeName[]`.
- `CodeName` is a discriminated union. A declaration carries required keys `end`, `scope`,
  `container` and `doc`, with `null` where absent, and `doc` must end before `line`.

The type's doc states the producer's obligations:

- `{@link X}` is never a use;
- `doc` is the attached doc comment only, never leading trivia or a file header;
- `line` is the name's own line, and a decorator's line is not it;
- `member` never means an object-literal key;
- paths are relative to the corpus's `cwd`, in POSIX form;
- lines are 1-based.

## Phase 2 — the facts' emptiness and coverage, read by the builder

- **The registry.** `resolveAtTheirLines(code)` registers `code` on itself, in a registry shaped
  like `declaresSections` (`packages/md/src/model/section-declarations.ts:24`).
- **The read.** `MentionRuleBuilder.collectViolations` (`packages/md/src/builders/mentions.ts:141`)
  reads the registered facts.
- **An empty `coverage`** is reported once, in the two-branch shape at
  `packages/core/src/correspondence.ts:165-170`. Over nothing examined, the receipt carries
  `sourceEmpty`. Beside a non-zero `examined`, a `{ examined: 0, sourceEmpty: true }` member joins
  through `mergeCollectResults`. It outranks `.expectEmpty()`.
- **When the facts loaded something**, two configuration findings can follow:
  - "the code facts (`label`) cover none of the N files these references cite", when at least one
    reference is examined. It replaces that rule's per-file not-judged findings.
  - a covered file the facts hold no name for, once per file, instead of a red for its references.
- **A `doc` span that does not end before its declaration's line** is a configuration finding of
  the facts, once per name.

## Phase 3 — the condition

Each mention is checked as in [plan 0648](./0648-md-a-code-reference-still-appears-in-its-file.md):
its requirements and the path classifier come first. Then:

- **Not judged.** A cited file outside `coverage`, internal or external, gets one not-judged
  finding per file per rule, marked `bypassFilters` and failing `.warn()`
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 5). Its
  remedy: "F is not in the code facts' coverage. Cover it, or leave its references out with
  `.that()`; `.excluding()` cannot drop this finding."
- **Judged by the first cited line.** The reference holds when that line holds a `CodeName` of the
  name of any kind, or lies in the doc comment of a declaration of the name.
- **Otherwise one finding,** with the proposal's remedy for its class:
  - declared once at `module` or `member` scope, with both lines named and never "move to N";
  - imported, not declared;
  - used, neither declared nor imported;
  - declared more than once, or only as a local;
  - text-only;
  - a body line, using `end`;
  - a range whose first line misses, naming the declaration and the use inside the range;
  - no fact of the name in the file, with the rename remedy.

## Phase 4 — the examples and the binding

- `examples/md/a-code-reference-resolves-at-its-lines.test.ts`. Hand-built facts are given by
  value. The stock pattern runs the rule at `.warn()`, and one left-out file is listed with
  `.that().satisfy(not(predicateHaveTextMatching(…)))`, never derived from `code.coverage`.
- **The fixtures, by value:**
  - Appendix B's correct holders, less h30 and h05;
  - the 16 doc-comment rows of
    [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s sample, with
    the two disputed ones recorded as such;
  - h30 and h05, each asserting its red and its remedy;
  - one fixture for each class above.
- **The binding.** `examples/cross-dialect.md-ts.test.ts` gains a type-level assignment of a
  hand-written producer's output to `CodeFacts`. This is the binding that ask A2's producer will
  replace.

## Files changed

- `packages/md/src/model/code-facts.ts` (new: the contract and the registry)
- `packages/md/src/conditions/resolve-at-their-lines.ts` (new)
- `packages/md/src/builders/mentions.ts`
- `packages/md/src/index.ts`
- `packages/md/tests/conditions/resolve-at-their-lines.test.ts` (new)
- `packages/md/tests/builders/mentions-code-facts.test.ts` (new: emptiness, coverage, precedence)
- `examples/md/a-code-reference-resolves-at-its-lines.test.ts` (new)
- `examples/cross-dialect.md-ts.test.ts`
- `scripts/check-nonvacuity.mjs`
- `scripts/vacuity-matrix.mjs`
- `docs/markdown.md`
- `packages/md/README.md`
- `.changeset/`

## Test inventory

Each finding is asserted by its cause, a message fragment, never by rule id and severity alone.

- [ ] Each class of Phase 3, one test each, through the public root.
- [ ] Each finding of Phase 2. Empty facts are reported once over zero references and once beside
      some, and outrank `.expectEmpty()`.
- [ ] The precedence: empty facts alone, then "none covered" in place of the per-file findings,
      then a covered file with no names.
- [ ] Broken, ambiguous and stale pointers under this rule's id. These are unit tests, as
      [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s fourth review asked.
- [ ] A rename reported under both ids when both rules run, each with its own remedy, and twice
      under one id when both conditions are chained in one rule. Both are pinned, and the README
      says so.
- [ ] Every fixture of Phase 4.
- [ ] The reconciliation: over this repository, with facts hand-built from
      `scripts/measure-code-reference-names.mjs`'s own AST read and the doc span taken from the
      attached comment only, the condition's counts per class equal the instrument's. Every
      difference is listed as a count and a reason in this plan's ledger.
- [ ] Eight `check:nonvacuity` rows against `check:examples`. Each sabotages the built `dist` and
      asserts a named test by its cause:
  - a drifted reference ("declared at line N");
  - text-only ("only in a comment or a string");
  - the doc-comment clause widened to the whole declaration ("inside `X`'s body");
  - the coverage check emptied ("not in the code facts' coverage");
  - facts that loaded nothing, once under `.expectEmpty()`, plus a build that always merges;
  - the range rule widened to any line;
  - "none covered" emptied;
  - the `doc`-span refusal removed.
- [ ] The sabotage matrix, in a worktree with its own install, one mutant at a time.

## Out of scope

- Ask A2, the TypeScript producer. Its home is [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s open question 1; an eess-ts home
  needs an ADR first.
- This repository's wiring (`check:code-references`), its severity, its migration and the warning's
  exit, which belong to the plan that brings A2's facts.
- Partial coverage, where a producer knows only some kinds of fact for a file.
- Ask C's fix, and the per-group source offsets it needs.
