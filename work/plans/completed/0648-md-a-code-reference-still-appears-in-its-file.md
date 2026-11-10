# Plan 0648: md: a named code reference's name appears in the cited file

## Status

- **State:** Done — built 2026-11-10 on `build/0648-appear-in-the-cited-file` and closed in the
  same PR, after a build review by the enforcement, testing, architect and method lenses, recorded
  in "Build review, 2026-11-10" below. Previously read: Ready — frozen 2026-11-10 against `main` 3d15b27a, at the maintainer's "go" after
  the revision (PR #336); the design was reviewed by four lenses and re-checked by two, so the
  freeze adds no decision. Its pointers into `pointer-resolve.ts` give the lines as built in
  Phase 1. Authored 2026-11-09 from
  [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A1, as
  ruled in its fourth Review, and revised 2026-11-10 after its own review by the architect,
  enforcement, method and product lenses (the "Review, 2026-11-10" section below). It is the second
  of three plans that own A1, and is built after
  [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md).
- **Implements:** [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)
  (ask A1: the file condition)
- **Priority:** High. It reds a named reference whose cited file no longer holds the name at all,
  which is a rename or a removal, or a move out of the file without the name being imported back.
  It works in any language whose names are ASCII identifiers, and needs no code facts.
- **Effort:** Large, about four hours: Phase 1 is a refactor of a path other code relies on, and
  lands as its own commit. [Plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md), estimated at an hour, closed with 19 tests, 15 mutants and a
  build review, so this estimate is not a promise.
- **Created:** 2026-11-09
- **Decided, each overrulable** (the departures from the proposal are marked):
  - **The condition is `mentions(…).should().appearInTheCitedFile()`.** _Renamed at review_ from
    the proposal's `appearInTheirFile`: on the same builder, `resideInFile` means the document
    that holds the mention, so "their file" read as that document. Plan
    [0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s twin is renamed to
    `resolveAtTheCitedLines` to match.
  - **It requires only the `name` and `path` groups.** _A departure:_ the proposal required `line`
    for both conditions, so that an optional group could not switch a check silently. This
    condition never reads a line, so nothing switches, and a reference that names only a file
    (`` `x` in `src/a.ts` ``) is judged too. A `line` or `end` group, if present, is ignored: a
    stale line is `pointers().resolve()`'s finding and [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s.
  - **It takes no `externalRoots`.** _A departure:_ the proposal gave both conditions the option. A
    path the corpus does not hold is broken, a finding, never a skip. The pointer gate's skip for an
    absent root is safe only because its caller prints the roots it found, which a rule file
    cannot. Reading external roots is left out of A1 here; an adopter who needs it brings it as a
    proposal.
  - **The commit-pinned lookahead in the stock pattern is not this plan's.** Its home is
    [bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md), which owns the defect
    and gains an open box for it in this PR: it is measured over this repository's own references
    when this repository is wired, not in eess-md's example.
  - **The shared parts are built here and reused by
    [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md):** the path classifier, the
    mention requirements, the name rule and the refusals.
  - **The stock example runs it at `.warn()`.** The judged rate is 7 right of 27 (2 of 9 live), and
    it is published only after the reconciliation in the Test inventory. Severity is the caller's.

## Problem

A pointer that resolves to a file and a line in range is green under `pointers().resolve()`,
whatever the sentence names. When the named function is renamed or removed, the reference still
passes ([bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)).

`scripts/measure-code-reference-names.mjs` measures this. At f17759a6 it counted 27 before-form
pairs (9 live) whose name is not a token anywhere in the cited file. A judge on a different model
read all 27 ([proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md),
Appendix B):

- 7 are renames (2 of the 9 live);
- 9 cite old code: pinned to a commit, or "as shipped";
- 6 are pairing artefacts;
- 5 are sentences saying the name is absent.

At 2aa45855 the instrument counts 28 (9 live). The extra pair is the forged example quoted in
[plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md), whose `a.ts:1` resolves
by suffix to a test fixture. These are the instrument's counts, not the rule's: the reconciliation
below states the rule's own.

## Phase 1 — the path classifier (its own commit)

`model/code-path.ts` exports a factory, made once per corpus:

```ts
export type CitedPath =
  | {
      readonly kind: 'resolved'
      readonly rel: string
      readonly text: string
      readonly lines: number
    }
  /** `unique`: in `exact` mode, the one file that matches by suffix, which the pointer fix rewrites to. */
  | { readonly kind: 'broken'; readonly wanted: string; readonly unique?: string }
  | { readonly kind: 'ambiguous'; readonly wanted: string; readonly candidates: readonly string[] }

export function citedPaths(corpus: Corpus, mode: 'suffix' | 'exact'): (wanted: string) => CitedPath
```

- **One index and one text cache, keyed by corpus and mode.** The path index is built once, the text
  and its line count are read once per file (`readCorpusFile`; `pointerResolves` keeps counting a
  file's lines once, not once per pointer), and a file's token set is built once, when it is first
  asked for.
- **What it carries over from `pointerResolves`:** the stripping of a leading `./`
  (`wantedPath`, `packages/md/src/model/code-path.ts:35`) happens inside it, and in `exact` mode a path that matches only by
  suffix, even several times, is `broken`, never `ambiguous`, with `unique` set when one
  file matches, so the autofix (`packages/md/src/conditions/pointer-resolve.ts:215-225`, pinned by `autofix.test.ts`) needs no second resolution.
- **In-corpus resolution only.** `pointerResolves`
  (`packages/md/src/conditions/pointer-resolve.ts:103-256`, lines as built) calls it for its in-repo step and keeps
  everything else as it is: the line checks, the external-roots branch with its documented skip
  (`:156-165`), the refusal of `externalRoots` over a `corpusFromText` corpus (`:82-89`), and its
  messages and fix.
- **The new condition always uses `suffix`**, as `pointers().resolve()` does by default.
- **A path that resolves outside the corpus** (a captured `../`) is `broken`.
- **The proof.** Every existing test of `pointers().resolve()` passes unchanged, and they already
  cover each exit of its resolution (`external-root-pointers.test.ts`, `pointers.test.ts`).

## Phase 2 — the requirements, the name rule and the refusals

**Refused when the rule is built**, as an `ArchConfigError` from the builder's method, which holds
the pattern and the opt-in:

- a pattern without one of the groups its condition requires: `name` and `path` here, and `name`,
  `path` and `line` for [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s. The shared check takes the list. The groups are listed with
  `new RegExp('(?:' + source + ')|', flags).exec('').groups`, with the caller's flags less `g` and
  `y` (so a pattern that needs `u` or `v` compiles), never by searching the source for `(?<`;
- a rule over a reading without `keepBackticks`. The message names the option.

The condition is reached only through the builder's method; eess-md exports no standalone
condition factory, so `satisfy()` cannot bypass the refusals.

**Per mention, in this order.** Each is one finding under the rule's own id, and the first that
applies is the only one reported:

1. **`name` or `path` did not capture:** "the pattern's `<group>` group did not capture here; make
   it required".
2. **`name` or `path` is not inside one code span** (missing from `codeGroups`): "write the name and
   the path each in its own code span". This catches the forged name of [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md).
3. **The judged name is not an identifier.** The name rule: the last `.`-separated segment of the
   `name` group must match `^[A-Za-z_$][\w$]+$`, an identifier of at least two characters, so
   `` `foo.` `` (an empty segment) and `` `x` `` (a token in nearly any file) never become a token,
   as the instrument's own name filter refused them (`scripts/measure-code-reference-names.mjs:62-72`). The finding reads "`X` is not a name this rule can look for; write the identifier itself".
   A dotted name `a.b.c` is judged as `c`, and the message says so. **A known limit:** a file name
   the pattern captures as a name (`` `config.ts` ``) is judged as `ts`, an identifier, and holds
   wherever `ts` is a token, such as `'./x.ts'` in an import. eess-md keeps no list of extensions
   ([ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md)); the caller's pattern
   excludes file names, the stock pattern's documentation says so, and the reconciliation counts
   what remains.
4. **The path is ambiguous.** This one is not judged: it is marked `bypassFilters`, fails `.warn()`
   and cannot be excluded, since the rule cannot tell which file is cited. Its remedy: "F matches
   N files (…); write enough of the path to name one".

**Kinds of finding.** One finding per mention: each mention is its own cause, as eess-md's unread
findings are. Findings 1–4 are "cannot judge", marked `bypassFilters`
([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 5), so a rule
that judged nothing never exits 0 under `.warn()`. A test drives `.warn()` itself, since
`.violations()` cannot see the flag.

**The unread-mention wording.** The builder's unread finding
(`packages/md/src/builders/mentions.ts:232-233` at 3d15b27a; 254 as built) says a mention "can be judged neither linked nor
not", and two remedies end "as a link". Those are `beLinked`'s words. They become
condition-neutral: "so this rule cannot judge it", with the "as a link" ending dropped. A
`beLinked` rule still reads correctly. The changeset names the wording change.

## Phase 3 — the condition

`appearInTheCitedFile()` takes each mention that passed Phase 2 and classifies its path (Phase 1).

- **Broken:** a judged red, and suppressible: "F does not exist in this corpus, so `X` cannot
  appear in it". Beside `pointers().resolve()` that is a second report under a second id. The
  README and the changeset both say so, and both say that `corpus/pointers-resolve` waivers do not
  cover this rule.
- **Resolved:** the reference holds when the file's token set (the text split on
  `[^A-Za-z0-9_$]`) contains the judged name. The scan is literal, and no RegExp is ever built from
  a captured name. When it does not hold, the finding reads:

  > "`X` is not in F, as code or as text. If it was renamed, write its new name. If it moved, cite
  > the file it moved to. If this name belongs to another pointer in the sentence, reword so each
  > name sits beside its own. If the sentence cites old code on purpose, waive it here with
  > `<!-- eess-exclude <rule id>: <reason> -->`."

  The message claims no history ("no longer"), since the name may never have been there. Its four
  remedies cover the judged sample's four classes.

- **The element** carries the name and the path, so two findings on one line do not collide. A test
  pins its format, since `.excluding()` and baselines key on it.

## Phase 4 — the example and the docs

`examples/md/a-named-code-reference-appears-in-the-cited-file.test.ts` keeps the examples' fixture
contract (`scripts/check-nonvacuity.mjs:1155-1158`): `fixtures/<name>/clean/` and one
`fixtures/<name>/violating-<judgement>/` per judgement.

It uses the stock pattern, frozen by value in
[plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md):

```js
const NAMED =
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/g
```

The tests:

- `clean:` a reference that holds, and a dotted `a.b.c` that holds because `c` is present. It
  asserts the number of references examined.
- `violating-renamed:` a name the cited file does not hold, asserting "is not in" and the four
  remedies.
- `violating-broken-path:` "does not exist in this corpus".
- `violating-forged-name:` "each in its own code span".
- `violating-empty-name:` a reference to `` `foo.` ``: "is not a name this rule can look for".
- Two refusals, titled `refuses:` so the fixture swap does not touch them:
  - a pattern without a `path` group;
  - a reading without `keepBackticks`, whose message is asserted, not only that it throws.

The README and `docs/markdown.md` state the contract first:

- the required groups;
- the name and the path each in a code span;
- what a name is (an ASCII identifier, its last `.`-segment);
- no file links: a link into code is ask B.

They then state the claim: the file holds the name as code or as text. Neither the line, nor that
it is code there, is claimed. Then come these:

- the rate, quoted from the reconciliation;
- the three wrong-red classes, each with its remedy;
- the second report beside `pointers().resolve()`, and why waivers do not carry over;
- one condition per rule.

Their snippet scopes to live documents with `inDocuments(areLive())`, since 18 of the 27 judged reds
sit in frozen records.

## Files changed

- `packages/md/src/model/code-path.ts` (new: the classifier)
- `packages/md/src/conditions/pointer-resolve.ts` (calls the classifier for its in-repo step)
- `packages/md/src/conditions/code-reference.ts` (new: the requirements, the name rule and the
  refusals)
- `packages/md/src/conditions/appear-in-the-cited-file.ts` (new)
- `packages/md/src/builders/mentions.ts` (the method, the refusals, the unread wording)
- `packages/md/tests/model/code-path.test.ts` (new)
- `packages/md/tests/conditions/appear-in-the-cited-file.test.ts` (new)
- `examples/md/a-named-code-reference-appears-in-the-cited-file.test.ts` (new)
- `examples/md/fixtures/a-named-code-reference-appears-in-the-cited-file/` (new; its code files are
  Python)
- `scripts/check-nonvacuity.mjs` (four rows, and their ids in `GATE_FOR['check:examples']`)
- `docs/markdown.md`
- `packages/md/README.md`
- `.changeset/`

`scripts/vacuity-matrix.mjs` does not change: it keys on builders, and `mentions` is already there.

## Test inventory

Each finding is asserted by its cause, a message fragment, never by rule id and severity alone.
Built 2026-11-10 on `build/0648-appear-in-the-cited-file`: Phase 1 alone (1422068b), Phases 2–3
(45356d76), Phase 4 (c94448a7), a test the matrix asked for (b33c84c2), the ledger and close
(ffdf4175), and the build review's fixes (bb9718b0 and the commit after it).

- [x] **Phase 1** (`packages/md/tests/model/code-path.test.ts`, 6 tests): the classifier's three
      outcomes with their data; a `../` path is broken; `exact` mode's suffix match is broken with
      `unique`; one cache per corpus and mode. Every existing `pointers().resolve()` test passed
      unchanged (the whole eess-md suite, 76 files and 1,284 tests, 13 s, on the refactored tree before
      `code-path.test.ts` was added; on 1422068b itself the suite is 77 files and 1,290 tests), and
      `check:corpus` read this repository's 1,204 live pointers alike, its one finding being this
      plan's own pointer into the file the refactor shortened, refreshed at the freeze.
- [x] done-otherwise — the `resolved` outcome carries only `rel`; the file's text, line count and
      tokens come from the classifier object (`text`, `lines`, `tokens`), so a pointer that needs
      only its line count never builds a token set.
- [x] **The name rule's limit:** `` `config.ts` `` citing a file that imports `"./x.ts"` holds,
      pinned as the stated limit.
- [x] **Phase 2, through the public root** (`packages/md/tests/conditions/appear-in-the-cited-file.test.ts`,
      18 tests): each refusal, its message asserted; each per-mention finding; the order (a group
      that did not capture is reported alone); `bypassFilters` through a `.warn()` run that throws,
      beside a plain miss that does not. done-otherwise — the flags test uses a `v` pattern, since a
      `u` one compiles without its flag and pinned nothing (the matrix's survivor, below).
- [x] **Phase 3:** broken; resolved and holds; resolved and misses, with its four remedies; a name
      left only in a comment holds; `pathSuffix` does not hold where the file has only
      `pathSuffixIndex`; two reds on one line are two findings, their element format pinned; an
      ambiguous path, not judged.
- [x] **The unread wording:** a `beLinked` rule and an `appearInTheCitedFile` rule over one
      reference-style link both read "so this rule cannot judge it".
- [x] **Zero examined** is the kernel's finding unless declared; with `.expectEmpty()`, green.
- [x] **The reconciliation**, at 45356d76, the built condition over `check:corpus`'s roots and frozen
      globs with the stock pattern: 482 references examined in 0.23 s.
  - **"Is not in": 30 (10 live).** The instrument counts 29 (10 live) no-token before-form pairs
    at the same commit, and all 29 are among the 30. The one more is the stated limit:
    `` `mentions.ts` `` at `work/plans/completed/0580-md-a-raw-html-link-is-resolved.md:259`,
    judged as `ts`, which its cited file does not hold; the instrument's name filter drops file
    names.
  - **Cannot be judged: 7**, each correct, each failing `.warn()`:
    - 2 names of one character (`P` in [bug 0396](../../bugs/0396-doctor-assumes-every-rule-has-a-ts-morph-project.md),
      `g` in [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)), both live;
    - 1 name outside a code span: [bug 0608](../../bugs/0608-an-emitter-finding-prints-its-message-twice.md)'s
      line 25, the shifted-span shape [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md) pinned, live;
    - 4 ambiguous paths (`rule-builder.ts` twice, `cli/index.ts`, `project.ts`), all in frozen
      records.
  - **The step from 28 to 29** in the instrument's count (28 at 2aa45855, 29 here) is a citation this
    build made stale: [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)
    cited `readCorpusFile` at `pointer-resolve.ts:102`, which Phase 1 moved into `code-path.ts`. The
    rule's first catch here was its own build's; the build review found it, and the citation now
    names `code-path.ts`.
  - **What was narrowed, done-otherwise:** the reds were compared, not every pair, so [spike 0646](../../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s 18
    pattern-only or instrument-only pairs are not restated here; no broken path was reported; the
    docs quote the judged sample's rate, which is the rule's for the 27 rows they share.
  - **The published rate** is the judged sample's (27 at f17759a6, 7 renames), whose rows are among
    the 29; the docs quote it as such.
- [x] **Four `check:nonvacuity` rows against `check:examples`**, sharing one helper
      (`gateCodeReference` in `scripts/check-nonvacuity.mjs`), each naming its built file and
      `from` string, reading its target and its control (`refuses: a reading without
keepBackticks, when the rule is built`) by title. Each was run by hand the way the row runs
      it, 2026-11-10: unsabotaged, target and control passed; sabotaged, target failed and control
      passed.
  - `examples/md-a-renamed-reference-is-red`: the token check made always true.
  - `examples/md-an-empty-name-is-not-judged`: the name rule removed.
  - `examples/md-keep-backticks-is-read` (from [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md)): the reading's opt-in ignored;
    the `clean:` test fails on its examined count.
  - `examples/md-code-groups-exclude-a-forged-span` (from [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md)): every captured group
    listed as code.
- [x] **The examples' fixture contract:** each of the four `violating-*` swaps fails exactly its own
      tests and passes the rest, and the reverse swap fails `clean:` and passes every `violating-*`
      test, checked by hand with `EESS_EXAMPLE_SWAP`. Added at build: the fixtures' code files are
      Python (`src/index.py`), since `eess/examples-md-uses-a-block` reads a `.ts` file under
      `examples/md/` as an example that imports nothing from eess-md; it also shows the rule
      outside TypeScript.
- [x] **The sabotage matrix**, 2026-11-10, on c94448a7 and b33c84c2 in a worktree with its own
      `npm ci` and builds, one mutant at a time, against the two new package test files with
      `autofix.test.ts` and `pointers.test.ts` (43 s for the run). done-otherwise — the mutants ran
      against the package tests, not the example, and were chosen from the phases, not enumerated
      from the diff; the testing lens's own run found the lines this left unpinned (below). Restored, 0 red before and after.
      Every one of the 21 mutants of this plan's code red at least one test:

  | mutant                                     | tests red |
  | ------------------------------------------ | --------- |
  | `exact` mode: a unique suffix resolves     | 1         |
  | `exact` mode: `broken` carries no `unique` | 1         |
  | `suffix` mode: ambiguous read as broken    | 1         |
  | an empty token kept                        | 1         |
  | one cache for both modes                   | 1         |
  | a leading `./` kept                        | 1         |
  | the capture check removed                  | 1         |
  | the code-span check removed                | 2         |
  | the name rule removed                      | 2         |
  | one character is a name                    | 2         |
  | a dotted name judged whole                 | 3         |
  | cannot-judge findings waivable             | 4         |
  | the `keepBackticks` refusal removed        | 1         |
  | the group refusal removed                  | 1         |
  | the group listing drops the caller's flags | 1         |
  | the name rule checked before the capture   | 2         |
  | an ambiguous path judged                   | 1         |
  | a broken path passes                       | 1         |
  | the token check always true                | 4         |
  | the builder passes the wrong opt-in        | 1         |
  | the unread wording reverted                | 1         |

  [Plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md)'s reading mutants M1, M3, M4, M5 and M8, run against this plan's example
  after a rebuild, each red 0 there, as expected: the example does not exercise them. They
  stay covered by [plan 0647](./0647-md-a-mention-reading-that-keeps-backticks.md)'s package tests only.

  _The first run had three faults: a mutant whose text prettier had reformatted did not apply;
  "the builder skips the refusals" still called it and proved nothing, replaced by "passes the
  wrong opt-in"; and "the group listing drops the caller's flags" survived, since the `u`
  pattern compiled without its flag. A `v` pattern, which does not, now pins it._

## Build review, 2026-11-10

The enforcement, testing, architect and method lenses reviewed ffdf4175; the full reviews were
written to the session's scratchpad. None found a critical defect. Each important finding is fixed
in this PR unless marked otherwise.

- **A self-citation could never go red** (enforcement). A reference whose cited file is the document
  it sits in found the name in its own text and passed. It is now a finding the rule cannot judge.
- **Half of a guard was unpinned** (testing). Removing `path` from the code-span check reddened
  nothing, so a path written in prose passed as judged. A forged-path test now pins it, with tests
  for every other line the testing lens's own matrix found unpinned: the identifier's anchors, the
  `name` capture, the dotted note, the rule id in the remedy, a real `eess-exclude` waiver, the image
  remedies, and a leading `/`.
- **One group probe, written twice** (architect). `namedGroups` is now `packages/md/src/model/named-groups.ts`,
  used by `code-reference.ts` and by `agree-with-path.ts`'s `hasValueGroup`.
- **The records** (method): the build review was claimed before it existed; the 1,284 was not
  1422068b's count; this build made a live citation stale and the reconciliation did not say so;
  the wiring's home was split; the matrix table rendered as a code block. Each is corrected above.
  The wiring is A2's plan's; [bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)
  holds the lookahead and records what the rule found here.
- **Docs and wording:** "inside a code span", not "its own" (a quoted example in one double-backtick
  span is judged); the ASCII and keyword limits; the three live findings it cannot judge, which fail
  the snippet's `.warn()`; a second report only "if you run one"; `text()` dropped from the
  classifier's interface; the cache's lifetime stated.
- **Rows:** the three rows whose sabotage leaves `clean:` green now also require it to stay passed,
  so a sabotage that only makes the condition throw cannot pass for its mechanism going red. Re-run
  by hand: each target failed, each control passed.
- **A follow-up matrix**, 2026-11-10 on bb9718b0 in a worktree with its own `npm ci`, against the
  whole eess-md suite (2 min 44 s). Restored, 0 red before and after; every mutant red:

  | mutant                                       | tests red |
  | -------------------------------------------- | --------- |
  | a self-citation judged                       | 1         |
  | the path half of the code-span check removed | 1         |
  | the name anchor `^` dropped                  | 1         |
  | the name anchor `$` dropped                  | 1         |
  | a name may start with a digit                | 1         |
  | the dotted note dropped                      | 1         |
  | the remedy names no rule id                  | 1         |
  | a leading `/` kept                           | 1         |
  | the shared group probe lists nothing         | 24        |
  | the alt remedy names a link again            | 1         |

- **Recorded, not fixed here:** `corpusFromText` reads a code file from the caller's live map
  (architect), [bug 0650](../../bugs/0650-a-text-corpus-reads-a-code-file-from-the-callers-live-map.md).
  Three notes for plan [0649](../0649-md-a-code-reference-resolves-at-its-lines.md)'s Phase 3 are
  written there.
- **Not taken:** a fixture and a row for the ambiguous path (enforcement; package tests pin it); a
  `kind` field and an options object in `code-reference.ts` (architect, style); one finding per
  mention when an optional group fails often (enforcement: each mention is its own cause); the
  matrix's mutant text in the record (method).

## Out of scope

- The line condition, the `CodeFacts` contract and the facts' emptiness: plan
  [0649](../0649-md-a-code-reference-resolves-at-its-lines.md).
- External roots, and a stale line or range (see Decided).
- This repository's wiring and its severity: the plan that brings ask A2's facts, as plan
  [0649](../0649-md-a-code-reference-resolves-at-its-lines.md) and [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s A2 row say. The
  commit-pinned lookahead: an open box in
  [bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md), which also records
  what this rule found here.
- Names beyond ASCII identifiers (`::`, `#`, `->` and non-ASCII names). The rule judges the last
  `.`-segment only, and says so.

## Review, 2026-11-10

Reviewed as a Draft by the architect, enforcement, method and product lenses; the full reviews were
written to the session's scratchpad. All four said not ready to freeze, and this revision answers
them.

- **Critical, raised by three lenses.** An external root absent from disk would have passed
  silently, since the pointer gate's skip (`return []` in `pointerResolves`' external-roots branch; this citation was a line number at
  the review, rewritten at the freeze because Phase 1 moved the line) has no outcome in a five-class
  classifier. Resolved by taking no `externalRoots` here.
- **Critical, raised by two lenses.** An empty last segment (`` `foo.` ``) would always pass: the
  instrument's boundary check finds `""` in most files, and the instrument's name filter was not
  carried over. Resolved by the name rule.
- **Important, raised across the lenses:**
  - the classifier's per-class data and caching;
  - the build-time detection of groups;
  - the precedence of findings;
  - `bypassFilters` on the cannot-judge findings;
  - the range end, now out of scope;
  - the reconciliation and the stale 27 (28 at HEAD);
  - rows that could not fail, or named no cause or control;
  - the examples' fixture contract;
  - the unread wording;
  - the naming clash;
  - a message that claimed history;
  - the README contract and the double report;
  - the lookahead's home;
  - the effort.

  Each is decided above.

- **Re-checked the same day** by the architect and enforcement lenses, on the revision (40a7c441).
  Both found both criticals closed and all four rows able to go red. Five important items were
  still open, now answered:
  - the `broken` outcome carries the autofix's `unique`;
  - the name rule's claim about `config.ts` is replaced by a stated limit;
  - [plan 0649](../0649-md-a-code-reference-resolves-at-its-lines.md) records the same departures;
  - names of one character are refused too, as the instrument refused them;
  - the reconciliation counts the classes that cannot be waived, and the docs say they fail at
    `.warn()`;
  - the lookahead's home is [bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md), with an open box, since that bug files no wiring plan.
- **Not taken:**
  - a "one pointer resolver" arch rule, which the architect lens noted as a consideration;
  - the `paths: 'exact'` option for the new condition, which always uses `suffix`.
