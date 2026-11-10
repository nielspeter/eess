# Plan 0648: md: a named code reference's name appears in the cited file

## Status

- **State:** Draft — authored 2026-11-09 from
  [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A1, as
  ruled in its fourth Review, and revised 2026-11-10 after its own review by the architect,
  enforcement, method and product lenses (the "Review, 2026-11-10" section below). It is the second
  of three plans that own A1, and is built after
  [plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md).
- **Implements:** [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)
  (ask A1: the file condition)
- **Priority:** High. It reds a named reference whose cited file no longer holds the name at all,
  which is a rename or a removal, or a move out of the file without the name being imported back.
  It works in any language whose names are ASCII identifiers, and needs no code facts.
- **Effort:** Large, about four hours: Phase 1 is a refactor of a path other code relies on, and
  lands as its own commit. [Plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md), estimated at an hour, closed with 19 tests, 15 mutants and a
  build review, so this estimate is not a promise.
- **Created:** 2026-11-09
- **Decided, each overrulable** (the departures from the proposal are marked):
  - **The condition is `mentions(…).should().appearInTheCitedFile()`.** _Renamed at review_ from
    the proposal's `appearInTheirFile`: on the same builder, `resideInFile` means the document
    that holds the mention, so "their file" read as that document. Plan
    [0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s twin is renamed to
    `resolveAtTheCitedLines` to match.
  - **It requires only the `name` and `path` groups.** _A departure:_ the proposal required `line`
    for both conditions, so that an optional group could not switch a check silently. This
    condition never reads a line, so nothing switches, and a reference that names only a file
    (`` `x` in `src/a.ts` ``) is judged too. A `line` or `end` group, if present, is ignored: a
    stale line is `pointers().resolve()`'s finding and [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s.
  - **It takes no `externalRoots`.** _A departure:_ the proposal gave both conditions the option. A
    path the corpus does not hold is broken, a finding, never a skip. The pointer gate's skip for an
    absent root is safe only because its caller prints the roots it found, which a rule file
    cannot. Reading external roots is left out of A1 here; an adopter who needs it brings it as a
    proposal.
  - **The commit-pinned lookahead in the stock pattern is not this plan's.** It moves with
    [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s deferred boxes to the
    plan that wires this repository, which must measure it over this repository's own references.
  - **The shared parts are built here and reused by
    [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md):** the path classifier, the
    mention requirements, the name rule and the refusals.
  - **The stock example runs it at `.warn()`.** The judged rate is 7 right of 27 (2 of 9 live), and
    it is published only after the reconciliation in the Test inventory. Severity is the caller's.

## Problem

A pointer that resolves to a file and a line in range is green under `pointers().resolve()`,
whatever the sentence names. When the named function is renamed or removed, the reference still
passes ([bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)).

`scripts/measure-code-reference-names.mjs` measures this. At f17759a6 it counted 27 before-form
pairs (9 live) whose name is not a token anywhere in the cited file. A judge on a different model
read all 27 ([proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md),
Appendix B):

- 7 are renames (2 of the 9 live);
- 9 cite old code: pinned to a commit, or "as shipped";
- 6 are pairing artefacts;
- 5 are sentences saying the name is absent.

At 2aa45855 the instrument counts 28 (9 live). The extra pair is the forged example quoted in
[plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md), whose `a.ts:1` resolves
by suffix to a test fixture. These are the instrument's counts, not the rule's: the reconciliation
below states the rule's own.

## Phase 1 — the path classifier (its own commit)

`model/code-path.ts` exports a factory, made once per corpus:

```ts
export type CitedPath =
  | { readonly kind: 'resolved'; readonly rel: string; readonly text: string }
  | { readonly kind: 'broken'; readonly wanted: string }
  | { readonly kind: 'ambiguous'; readonly wanted: string; readonly candidates: readonly string[] }

export function citedPaths(corpus: Corpus, mode: 'suffix' | 'exact'): (wanted: string) => CitedPath
```

- **One index and one text cache.** The path index is built once, the text is read once per file
  (`readCorpusFile`), and a file's token set is built once, when it is first asked for.
- **In-corpus resolution only.** `pointerResolves`
  (`packages/md/src/conditions/pointer-resolve.ts:107-264`) calls it for its in-repo step and keeps
  everything else as it is: the line checks, the external-roots branch with its documented skip
  (`:166-175`), the refusal of `externalRoots` over a `corpusFromText` corpus (`:79-89`), and its
  messages and fix.
- **The new condition always uses `suffix`**, as `pointers().resolve()` does by default.
- **A path that resolves outside the corpus** (a captured `../`) is `broken`.
- **The proof.** Every existing test of `pointers().resolve()` passes unchanged, and they already
  cover each exit of its resolution (`external-root-pointers.test.ts`, `pointers.test.ts`).

## Phase 2 — the requirements, the name rule and the refusals

**Refused when the rule is built**, as an `ArchConfigError` from the builder's method, which holds
the pattern and the opt-in:

- a pattern without a `name` or a `path` group. The groups are listed with
  `new RegExp('(?:' + source + ')|').exec('').groups`, never by searching the source for `(?<`;
- a rule over a reading without `keepBackticks`. The message names the option.

The condition is reached only through the builder's method; eess-md exports no standalone
condition factory, so `satisfy()` cannot bypass the refusals.

**Per mention, in this order.** Each is one finding under the rule's own id, and the first that
applies is the only one reported:

1. **`name` or `path` did not capture:** "the pattern's `<group>` group did not capture here; make
   it required".
2. **`name` or `path` is not inside one code span** (missing from `codeGroups`): "write the name and
   the path each in its own code span". This catches the forged name of [plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md).
3. **The judged name is not an identifier.** The name rule: the last `.`-separated segment of the
   `name` group must match `^[A-Za-z_$][\w$]*$`, so `` `foo.` `` (an empty segment) and
   `` `config.ts` `` (judged as `ts`) never become a token. The finding reads "`X` is not a name this
   rule can look for; write the identifier itself". A dotted name `a.b.c` is judged as `c`, and the
   message says so.
4. **The path is ambiguous.** This one is not judged: it is marked `bypassFilters`, fails `.warn()`
   and cannot be excluded, since the rule cannot tell which file is cited.

**Kinds of finding.** Findings 1–4 are "cannot judge", marked `bypassFilters`
([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) clause 5), so a rule
that judged nothing never exits 0 under `.warn()`. A test drives `.warn()` itself, since
`.violations()` cannot see the flag.

**The unread-mention wording.** The builder's unread finding
(`packages/md/src/builders/mentions.ts:232-233`) says a mention "can be judged neither linked nor
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
[plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md):

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
- `examples/md/fixtures/a-named-code-reference-appears-in-the-cited-file/` (new)
- `scripts/check-nonvacuity.mjs` (four rows, and their ids in `GATE_FOR['check:examples']`)
- `docs/markdown.md`
- `packages/md/README.md`
- `.changeset/`

`scripts/vacuity-matrix.mjs` does not change: it keys on builders, and `mentions` is already there.

## Test inventory

Each finding is asserted by its cause, a message fragment, never by rule id and severity alone.

- [ ] **Phase 1:** the classifier's three outcomes, each with its data; a `../` path is broken; one
      read per file across many references. Every existing `pointers().resolve()` test passes
      unchanged.
- [ ] **Phase 2, through the public root:**
  - each refusal;
  - each per-mention finding;
  - the order: a forged name whose group also failed to capture reports "did not capture" only;
  - the `bypassFilters` flag, through a `.warn()` run that must throw.
- [ ] **Phase 3:**
  - broken;
  - resolved and holds;
  - resolved and misses;
  - a name present only in a comment holds, the rule's stated limit;
  - `pathSuffix` does not hold where the file has only `pathSuffixIndex`;
  - two red references on one line give two findings, and the element's format is pinned.
- [ ] **The unread wording:** a `beLinked` rule and an `appearInTheCitedFile` rule over the same
      reference-style link both read "this rule cannot judge it".
- [ ] **Zero examined** is the kernel's finding unless declared; with `.expectEmpty()` over no
      reference, green.
- [ ] **The reconciliation.**
  - **Run.** The built condition, with the stock pattern, over this repository's corpus
    (`check:corpus`'s roots and frozen globs) at the build commit.
  - **Compare.** Its red count per document is set against the instrument's no-token rows at the
    same commit.
  - **Record.** Every difference goes in this ledger, with a count and a reason; 18 pattern-only or
    instrument-only pairs are expected from
    [spike 0646](../spikes/0646-what-ask-a1-of-proposal-021-reads-and-judges.md). The rate the
    docs publish is the rule's, from this run, with the judged sample's verdicts carried over where
    the pairs agree.
- [ ] **Four `check:nonvacuity` rows against `check:examples`.**
  - Each row names the built file it edits, the `from` string, and the test that must go red by its
    cause.
  - Each row has a control: a `refuses:` test in the same file that must stay passed, so a red
    caused elsewhere does not count.
  - `examples/md-a-renamed-reference-is-red`: the token check made always true. The test
    `violating-renamed:` reds on "is not in".
  - `examples/md-an-empty-name-is-not-judged`: the name rule removed. The test
    `violating-empty-name:` reds on "is not a name this rule can look for".
  - `examples/md-keep-backticks-is-read`, deferred from [plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md): the reading's opt-in ignored in
    `findMentions`. The `clean:` test reds on its examined count, which drops to zero.
  - `examples/md-code-groups-exclude-a-forged-span`, deferred from [plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md): `codeGroups` made to
    list every captured group. The test `violating-forged-name:` reds on "each in its own code
    span".
- [ ] **The sabotage matrix**, in a worktree with its own install, one mutant at a time, against the
      new test files and the example:
  - every check in Phases 1–3;
  - [plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md)'s mutants M1 (a caller's `d` flag), M3 (one cache for both copies), M4 (a group
    including its backticks), M5 (the line clamp) and M8 (a span across segments), run against
    this plan's example. Each is expected to survive the example, since the example does not
    exercise it. Each survivor is recorded as covered by [plan 0647](./completed/0647-md-a-mention-reading-that-keeps-backticks.md)'s package tests only.

## Out of scope

- The line condition, the `CodeFacts` contract and the facts' emptiness: plan
  [0649](./0649-md-a-code-reference-resolves-at-its-lines.md).
- External roots, and a stale line or range (see Decided).
- This repository's wiring, its severity and the commit-pinned lookahead: with
  [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s deferred boxes.
- Names beyond ASCII identifiers (`::`, `#`, `->` and non-ASCII names). The rule judges the last
  `.`-segment only, and says so.

## Review, 2026-11-10

Reviewed as a Draft by the architect, enforcement, method and product lenses; the full reviews were
written to the session's scratchpad. All four said not ready to freeze, and this revision answers
them.

- **Critical, raised by three lenses.** An external root absent from disk would have passed
  silently, since the pointer gate's skip (`pointer-resolve.ts:174`) has no outcome in a five-class
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

- **Not taken:**
  - a "one pointer resolver" arch rule, which the architect lens noted as a consideration;
  - the `paths: 'exact'` option for the new condition, which always uses `suffix`.
