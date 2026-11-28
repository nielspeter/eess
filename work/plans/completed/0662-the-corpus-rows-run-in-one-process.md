# Plan 0662: the corpus rows run in one process

## Status

- **State:** Done — built and closed 2026-11-28 in [PR #346](https://github.com/nielspeter/eess/pull/346)
  after its build review ("Review of the build, 2026-11-28"); authored 2026-11-27 from a measurement
  the same day, rewritten the same day against its review by the enforcement, testing and method
  lenses ("Review, 2026-11-27"), frozen 2026-11-28 with Design 1 changed ("Decided at the freeze").
  Deferred: [plan 0665](../0665-the-other-gate-rows-run-in-one-process.md) (the ledger, arch, family and
  diagram rows), [bug 0664](../../bugs/0664-check-bun-load-exits-0-through-a-symlink.md) (found here),
  [spike 0663](../../spikes/0663-where-the-eess-ts-suite-spends-its-time.md) (the `test` job).
- **Priority:** High.
- **Effort:** Medium to large. An estimate of about two days, not measured: the gate's split, output
  capture, a reset per mutable state the inventory finds, and the sabotage proofs; it took about a day.
- **Created:** 2026-11-27
- **Builds on:** [bug 0548](../../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md), which made
  both of `check-corpus.mjs`'s exits read one verdict and put the end-to-end proof in two rows. It is
  [spike 0631](../../spikes/0631-where-ci-time-goes.md)'s option C ("make nonvacuity cheaper"), which
  that spike left undecided.
- **Competes with:** the eess-rust session's open
  [PR #343](https://github.com/nielspeter/eess/pull/343), whose parse-cache plan is motivated by the
  same rows and edits the same harness. The two go after the same saving: a parse cache on disk
  shares trees between processes, this plan keeps one process. Whichever merges second restates its
  projection against the other and links it.

## Problem

Every corpus row in `scripts/check-nonvacuity.mjs` plants a probe and starts `check-corpus.mjs` in a
fresh process, which reads and parses every document the gate reads (410 live and 289 frozen locally
at 8f3569ee; CI printed 290 frozen for the same tree) to judge the one file the row changed.

**Measured 2026-11-27**, on this machine at 8f3569ee. The recipe, so it can be repeated: copy
`scripts/check-corpus.mjs` beside it, keep its import lines, wrap the rest in an exported `run()`,
turn each `process.exit(n)` into a thrown exit code, and call `run()` repeatedly from a driver that
captures stderr. The scratch files were deleted.

|                                                          | time        |
| -------------------------------------------------------- | ----------- |
| a fresh process, one gate run (3 runs)                   | 8.27–8.53 s |
| importing the gate's modules                             | 0.11 s      |
| first run in one process (parses everything)             | 8.04 s      |
| a later run in the same process, one broken link planted | 2.15 s      |
| a later run in the same process, clean (2 runs)          | 2.14–2.17 s |

The in-process runs gave the verdicts a fresh process gives: exit 1 with the planted link named over
34,648 checks, and exit 0 over 34,647. The enforcement review reproduced it independently (8.40 s,
2.20 s, 2.27 s; 34,701 checks each, at its head). The saving is eess-md's parse memo
([bug 0547](../../bugs/fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md)), which keeps
each tree for the life of the process, keyed by a sha1 of the text and confirmed by an exact compare,
so a later run parses only the texts that changed. A row may run the gate more than once, so a row
saves about 6 s per gate run, not per row.

**What it is worth in CI, a projection.** From the per-row times of CI run 45969038139 (PR #344's
final commit), each in-process gate run at the measured 26% of its cost, and only the rows this plan
converts (not the rows it keeps fresh, the ledger rows, or the fixture rows that never start the
gate), as the method review recomputed: the slowest shard about 7.3 minutes, down from 11.1, and
about 24 machine-minutes, down from 38.9. That is before each shard's first full parse and its
shard-end check. The build measures it in CI. The `test` job (8–10 minutes on the same PR's runs) then
sets a PR's wait: [spike 0663](../../spikes/0663-where-the-eess-ts-suite-spends-its-time.md).

## Design

**Proof kept.** Every converted row asserts what it asserts today, on the production gate's own code.
The command CI runs is proven end to end by the two rows
[bug 0548](../../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md) built for it,
`corpus/terminal-exit` and `corpus/adr-production`, which keep their fresh processes. CI's own
`check:corpus` stays a fresh process, so a leak between in-process runs can make only a harness row
wrong, never the gate CI judges.

1. **The gate becomes a function and a command.** _Changed at the freeze, below._ The body was to move
   to `scripts/lib/check-corpus-run.mjs`, exporting `runCheckCorpus(argv)`, which returns
   `{ code, stdout, stderr }`, `code` computed from the verdict as today, nothing defaulting to 1;
   `scripts/check-corpus.mjs` keeping the command alone. No guard of the repository's existing shape
   (`scripts/check-bun-load.mjs:869`), which exits 0 silently when called through a symlinked absolute
   path, as the enforcement review measured.
2. **A throw is a harness error, never a verdict.** The function restores the captured streams in a
   `finally` and lets a throw escape. In-process, the harness reports a throw as its own error (exit
   2), never as the gate's exit 1. Today an uncaught throw exits 1, and `check-corpus.mjs:1701-1705`
   records that it once hid a defect from every fixture. _Pointers in this Design are as at 3562cad7;
   the build moved the gate's lines by +40 to +57 (that comment is now `check-corpus.mjs:1754-1758`)._
3. **The harness calls it, and refuses where it cannot.** One helper, `corpusInProcess(args)`, returns
   the shape `sh()` returns, so no row's assertion changes. It asserts that the working directory is
   the repository root. It refuses, falling back to a fresh process, when a module the gate imports is
   rewritten: the harness's `pendingRestores` (`scripts/check-nonvacuity.mjs:650`) names every file
   a row rewrites, and the loaded module would not see the rewrite. That keeps `emitter/one-dead-check`
   (`scripts/check-nonvacuity.mjs:3323-3346`), which rewrites the gate itself, a fresh process. Not
   converted either:
   - `corpus/terminal-exit` and `corpus/adr-production`;
   - the rows that run the gate in a clone (`runCorpusScript(…, { cwd: clone })`, 6 calls);
   - the two rows that copy the script and match its text, until their patterns are checked against
     the split.
4. **An inventory of shared state, measured, with a reset for each.** One process means one set of
   module-level state. Phase 2 lists every module-level `let`, `Map`, `Set`, `WeakMap` and
   `globalThis` key in the modules the gate imports (the kernel, eess-md and `scripts/lib`), by a
   recorded search, not from memory, and decides each:
   - **kept**, with the reason it cannot change a verdict;
   - **reset before each in-process run**, by its own reset, since `clearRegisteredCaches()` also
     empties the parse memo, which is the saving.

   Known before the inventory, from the reviews:
   - the parse memo (`packages/md/src/model/prose.ts:174`): kept, keyed by text;
   - comment suppressions (`packages/core/src/comment-suppression.ts:50`), not registered for reset:
     they grow by run (3, then 6, then 9, measured by the enforcement review) and reach every
     `--format json` document as `commentSuppressed` (`packages/core/src/format-json.ts:161`). No row
     reads that field today; it is reset per run anyway;
   - the kernel's emitted count (`packages/core/src/report.ts:72`), edge coverage
     (`packages/core/src/edge-coverage.ts:72`), the identity collisions
     (`packages/core/src/violation.ts:348`), the notice and listener flags
     (`packages/core/src/diff-disclosure.ts:92`, `packages/core/src/stderr.ts:45`), and two text-keyed
     maps in `scripts/lib/proposal-ruling.mjs:108-109`;
   - eess-md WeakMaps keyed by long-lived objects (`packages/md/src/model/section-declarations.ts:21`,
     which appends; `packages/md/src/predicates/in-documents.ts`; `packages/md/src/model/anchors.ts:126`),
     safe only while every predicate is built inside the function: a predicate hoisted out of it is the
     break class. _At the build: two are hoisted already, and are safe; no sabotage row was built, for
     the reason the inventory below records;_
   - the source-text registry on `globalThis`
     ([ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)).

   Files are read from disk on every run: `corpus()` lists and reads them, and the kernel reads
   waivers per run (`packages/core/src/execute-rule.ts:174-184`). Environment and colour differences
   reach no output today (verified by the enforcement review).

5. **A leak is checked at the end of each shard, and what it cannot see is stated.** After its last
   in-process row, each shard runs the gate both ways and requires them to agree:
   - on a clean tree, the whole terminal output, the elapsed time masked: every per-check count, not
     only the exit code and total;
   - with one planted probe, the full `--format json` output.

   It prints how many in-process runs preceded it. It sees state that survives to the shard's end and
   changes what the gate prints. A leak that flips a row mid-shard and is gone by the end is not seen
   by it; the defence there is Design 4's reset per mutable state, each with a sabotage row.

## Decided at the freeze, 2026-11-28

**Design 1 keeps the body in `scripts/check-corpus.mjs`.** Moving it to `scripts/lib/` would leave
the command file a few lines long, and 30 live `file:line` pointers in 21 records, two of them in
[ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md), cite lines of that file:
each would point past its end and red `check:corpus`. So the body stays where it is, wrapped in an
exported `runCheckCorpus(argv)`, and the command runs when `import.meta.main` is true, the other form
the enforcement review named. `import.meta.main` is `true` for this file run directly and through a
symlinked path (measured under Node 24.22.0; CI's `node-version: 24`). Below Node 24.2 it is
`undefined`, so the file throws when it is not a boolean: an old runtime fails closed rather than
exiting 0 with no output. Lines move by the wrapper's few lines, which the pointer gate, judging only
that a line exists, does not see ([bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s
known gap, unchanged).

## Phases

1. The function and the command (Design 1, as changed at the freeze; Design 2). Its output is identical to today's, the elapsed time
   masked, on: a clean tree; a planted broken link; `--format json`; `--format github`; each of the
   three early exits (at 3562cad7 `check-corpus.mjs:134`, `:215`, `:275`; after the build `:174`,
   `:255`, `:315`); an uncaught throw. The rows that match
   the gate's text keep their anchors: `emitter/one-dead-check`'s `^const linksChecked` and the two
   copying rows' patterns are checked against the moved body.
2. The inventory of Design 4, recorded by value in this plan, and a reset per entry decided "reset".
3. `corpusInProcess`, the conversion and the shard-end check (Design 3, 5).
4. The sabotage rows, then CI's shard times before and after, recorded by value.

## The inventory, measured 2026-11-28

At 3562cad7, by three searches over `packages/core/src/*.ts`, `packages/md/src/*.ts`,
`packages/md/src/*/*.ts` and the nine `scripts/lib` modules `check-corpus.mjs` imports
(`corpus-link-routing`, `frozen-scope`, `lane-coverage`, `ledger-lanes`, `pointer-classes`,
`proposal-ruling`, `record-key`, `record-mention`, `vitepress-anchors`), test files excluded:

- A, 41 lines: `grep -nE '^(let |var |const [A-Za-z_]+ *(: [^=]+)?= *new (Map|Set|WeakMap|WeakSet)\b)|globalThis\[|globalThis\.[a-zA-Z_]+ *='`
- B, 10 lines, comments excluded: `grep -nE '^const [A-Za-z_]+(: [^=]+)? = \[\]|^const [A-Za-z_]+(: [^=]+)? = create[A-Z]|globalThis|^export let |^let '`
- C, 2 lines, added at the build review, which found that A and B cannot see a value built by a call
  at module scope: `grep -nE '^(export )?const [A-Za-z_]+ = (inDocuments|not|or|and|definePredicate|resideInFile|resideInFolder)\('`

Each, decided:

| state                                                                                                                        | decision                                      | why                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comment-suppression.ts:50` `suppressions`                                                                                   | **reset per run** (`resetCommentSuppression`) | grows by run and reaches `--format json`'s `commentSuppressed`                                                                                                                                                                                           |
| `prose.ts:174` the parse memo                                                                                                | kept                                          | the saving; keyed by the text, confirmed by an exact compare                                                                                                                                                                                             |
| `proposal-ruling.mjs:108-109` `readings`, `openFences`                                                                       | kept                                          | memos of pure functions, keyed by the text                                                                                                                                                                                                               |
| `packages/md/src/model/links.ts:151` `walked`, `ledger.ts:368` `itemContinuations`                                           | kept                                          | keyed by a tree the memo shares across runs; each a function of the tree and its text                                                                                                                                                                    |
| `diff-disclosure.ts:92` `noticed`                                                                                            | kept                                          | set only under a `diff` option (`packages/core/src/execute-rule.ts:390-394`); the gate passes none                                                                                                                                                       |
| `packages/core/src/violation.ts:348` identity collisions, `edge-coverage.ts:72`, `report.ts:72` the emitted count            | kept                                          | read only by eess-ts's CLI (`identityCollisions`, `violationsEmittedCount`), never by this gate                                                                                                                                                          |
| `stderr.ts:45`, `cli-config.ts:188`                                                                                          | kept                                          | one-time flags; setting them again changes nothing                                                                                                                                                                                                       |
| `source-roots.ts:54` the source-text registry on `globalThis`                                                                | kept                                          | written only by `corpusFromText`; the gate reads the disk through `corpus()`                                                                                                                                                                             |
| `selection-memo.ts`, the eess-md `WeakMap`s keyed by a `Corpus`, an `MdDocument`, a violation, an `AnchorRule` or a `RegExp` | kept                                          | keyed by objects a run builds anew, or derived from a constant pattern                                                                                                                                                                                   |
| `packages/md/src/model/section-declarations.ts:21`, `packages/md/src/predicates/in-documents.ts:81`, `:112`                  | kept                                          | keyed by a predicate or builder: safe while each is built inside the gate's function; a predicate built at module scope would be shared across runs                                                                                                      |
| search C's two: `scripts/lib/record-mention.mjs:168` `notLeftOut`, `packages/md/src/rules/adr.ts:23` `notIndexDoc`           | kept                                          | built once at module scope, so shared by every in-process run; each is stateless or memoises per `MdDocument`, which every run builds anew: every mention and ADR row passed in process, and the agreement check was identical after 100 in-process runs |
| the `WeakSet` markers (`cardinality.ts:40`, `owns-empty-discovery.ts:67`, `code-block-parse.ts:110`) and the constant `Set`s | kept                                          | adding an object again, or reading a constant, changes nothing                                                                                                                                                                                           |

## Files changed

- `scripts/check-corpus.mjs` (the function, the command, the json escalation exit)
- `scripts/check-nonvacuity.mjs` (`corpusInProcess`, the agreement check, two rows, the lazy import)
- `package.json` (`engines` raised to `>=24.2.0`, for `import.meta.main`)
- `work/spikes/0546-where-a-corpus-check-spends-its-time.md`, `work/spikes/0631-where-ci-time-goes.md`:
  dated corrections
- [bug 0552](../../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md),
  [bug 0517](../../bugs/0517-a-gates-json-past-64-kib-is-cut-through-a-pipe.md): dated notes
- `work/bugs/fixed/0656-nonvacuity-runs-clean-passes-that-decide-nothing.md`: a correction
- [bug 0664](../../bugs/0664-check-bun-load-exits-0-through-a-symlink.md) and
  [plan 0665](../0665-the-other-gate-rows-run-in-one-process.md): filed
- `work/plans/ROADMAP.md`, `work/bugs/BUGS.md`

## Test inventory

Measured 2026-11-28 in a detached worktree at c7a99d1a and its follow-ups, with its own `npm ci` and
build (45 s, 7 s), never in the main tree.

- [x] Phase 1's output identity: the gate before the change (a reference copy) and after, the elapsed
      time masked, on a clean tree in terminal, `--format json` and `--format github`; a planted broken
      link in terminal and json; each of the three early exits, triggered by the same edit to both
      copies; an injected throw (both exit 1 and name it; only the stack's length differs). All eight
      output cases byte-identical in exit code, stdout and stderr. Importing the file runs nothing
      (0.12 s); a symlinked path runs the gate. The json escalation fix later changed one output not in
      those eight: on that path, Node's uncaught-error stack no longer follows the json on stderr.
- [x] The converted rows, locally: `QA_ONLY` over every `corpus/` and `emitter/` row and the rows
      the converted helpers back, 167 names, in 448 s. 163 passed. The agreement check passed after
      100 in-process runs and 2 sent to a fresh process. The failures:
  - `corpus/accepted-denominator-empty` returned exit 2, the harness's code for a throw. The gate's
    json branch let `reportViolations`'s escalation throw go uncaught: on `main` the row's exit 1 was
    Node's exit for an uncaught throw. Fixed in the gate: an `ArchRuleError` from `reportViolations`
    is exit 1, any other throw escapes. The row then passed in process.
  - `emitter/bare-builder-reds-the-cli` and `emitter/mermaid-bare-builder-reds-the-cli` fail the
    same way at `main` (3562cad7) in the same worktree: an environment difference, not this change.
    CI runs them green.
  - "rule-id coverage" fails under any `QA_ONLY` subset, since it audits every fixture.

  The whole set is CI's four shards on this PR.

- [x] **Sabotage, an accumulating state:** a standing row, `corpus/in-process-leak-caught`, the
      falsifier of the shard-end check. It runs the same comparison the shard end runs,
      `corpusAgreementCompare`, after one warm run without the per-run reset, and requires it to
      disagree. Then it runs it with the reset, and requires it to agree. Its probe plants its own
      waiver, so a comment suppression exists whatever the corpus holds. Passes; the disagreement is the
      accumulated `commentSuppressed` entries. Sabotage, the comparison made blind (`agree: true`): the
      row FAILED. _The build's first form of this row compared its own runs and proved only that the
      reset works (both build reviews); replaced._
- [x] dropped-on-purpose **Sabotage, a hoisted predicate:** no synthetic row. A harmful hoist needs a
      predicate whose own memo outlives a run under a key the next run reuses. The inventory's searches
      found no such predicate: the two built at module scope (search C) are stateless or memoise per
      `MdDocument`, and pass in process. A synthetic row would test a predicate the family does not
      have. The agreement check is the net for one added later. _The build first ticked this
      `done-otherwise` on `notLeftOut` passing, which shows a safe hoist, not a caught one (both build
      reviews)._
- [x] **Sabotage, a throw:** a standing row, `corpus/in-process-throw-is-harness-error`. It runs
      through the real `runCheckCorpus`, its body replaced by one that writes and throws, and requires
      exit 2, the throw named, and both write functions restored. Sabotage, a catch-all in
      `runCheckCorpus` turning a throw into exit 1: the row FAILED (exit 1, throw not named). Sabotage,
      the `finally` emptied: called directly, the write functions were not restored, which the row
      reads. _The build's first form drove a stand-in for the gate (both build reviews); replaced._
- [x] **Sabotage, a rewritten module run in-process:** `corpusInProcess`'s refusal replaced by
      `if (false)`: `emitter/one-dead-check` FAILED (json exit 0, terminal exit 0). With the refusal it
      passes, sent to a fresh process.
- [x] **Sabotage, the command:** its output not written: `corpus/terminal-exit` FAILED (finding listed
      false, red summary false) and `corpus/adr-production` FAILED (the ADR finding not seen). Its exit
      deleted reds `corpus/terminal-exit`, measured by
      [bug 0548](../../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md).
- [x] Shard times, as CI job durations, before (run 45969038139, PR #344's final commit) and after
      (run 46112549103, this PR's first commit, c546774f), one run each side against the 1.6x variance
      [bug 0552](../../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md) measured:

      | shard | before | after | corpus rows, before → after | untouched rows' runner speed |
      | --- | --- | --- | --- | --- |
      | 1 | 10.4 min | 12m40s | 290 → 175 s | ×1.45 (a slow runner) |
      | 2 | 7.6 min | 7m06s | 279 → 151 s | ×1.20 |
      | 3 | 9.8 min | 8m07s | 380 → 143 s | ×1.21 |
      | 4 | 11.1 min | 7m06s | 394 → 130 s | ×0.83 |

      The corpus rows fell from 1,343 to 599 s, to 31–45% of their cost once each shard's runner speed
      is taken out (from the rows this PR did not touch). The projection was 26%: the shard-end
      agreement check and the two new rows add about 57 s a shard on a slow runner, and a converted
      row runs the gate more than once. Shard 1, with the 4-minute examples row, sets the slowest
      time: 12m40s on a runner 45% slower than before. The merge job failed on that run, and on the next: the harness loaded the gate
      at the top (first statically, then by a top-level import skipped only in merge mode), while the
      merge job, and the shard runs its own tests start, run on Node builtins alone. Fixed by loading the
      gate the first time a row runs it (`require` of the ES module); checked by running the shard
      tests (22) and merge mode in a copy with no `node_modules`, and the in-process rows in a worktree.

## Out of scope

Each with its home, filed at the close:

- the ledger rows, and the arch, family and diagram rows: deferred→[plan 0665](../0665-the-other-gate-rows-run-in-one-process.md),
  the ledger half after [bug 0661](../../bugs/0661-check-ledger-exits-on-a-second-list.md);
- a parse cache on disk: the eess-rust session's open [PR #343](https://github.com/nielspeter/eess/pull/343),
  which plans one. In one process the memo already gives this plan's saving; that PR restates its
  projection against this one if it merges;
- the `test` job: deferred→[spike 0663](../../spikes/0663-where-the-eess-ts-suite-spends-its-time.md).

## Review, 2026-11-27

The first draft was reviewed by the enforcement, testing (on the spike) and method lenses; their full
reviews were written to the session's scratchpad. None found a critical defect in this plan; all held
it. Answered in this rewrite:

- **The shared-state list was written from memory** (enforcement, method): Design 4 is now a recorded
  inventory, with the unregistered state the reviews found named, and `clearRegisteredCaches()` ruled
  out because it empties the parse memo.
- **The shard-end check compared mostly empty sets** (enforcement, method): it compares the whole
  terminal output and one probe's full json, and says what it cannot see.
- **`emitter/one-dead-check` would have been converted** (enforcement, method): the helper refuses a
  row that rewrites a module the gate imports.
- **A command guard can fail open** (enforcement): no guard; a library and a command. _Changed at the
  freeze: the body stays, and the guard is `import.meta.main`, which fails closed._
- **A throw was undefined** (enforcement): it is a harness error, with a sabotage row.
- **The projection applied the ratio to rows the design keeps fresh** (method): restated, about 7.3
  minutes and 24 machine-minutes.
- **The lineage and the overlap with PR #343** (method): stated in the header.
- Minor: the recipe for the measurement; 290 frozen on CI; the gate's early exits; the effort; the
  out-of-scope homes stated as unfiled.

## Review of the build, 2026-11-28

The build ([PR #346](https://github.com/nielspeter/eess/pull/346)) was reviewed by the enforcement and
method lenses; their full reviews were written to the session's scratchpad. Neither found a critical
defect. Answered before the close:

- **The shard-end check had no falsifier, and the throw row drove a stand-in** (both): the leak row
  now runs the shard end's own comparison and requires it to disagree without the reset; the throw
  row runs through the real `runCheckCorpus`, and checks the streams come back. Each sabotaged and
  red, above.
- **A large json is cut through a pipe after `process.exit`** (enforcement, measured: about 128 KiB on
  Linux), so a fresh row with such output would red where the in-process one passes. The command now
  sets `process.exitCode` and lets Node drain the writes. It also refuses a gate result that is not 0
  or 1. [Bug 0517](../../bugs/0517-a-gates-json-past-64-kib-is-cut-through-a-pipe.md) gets a dated note: it is live on Linux, against its own record's doubt.
- **The hoisted-predicate box was not honest** (both): now `dropped-on-purpose`, with search C and the
  second module-scope predicate it found.
- **The inventory's searches were not recorded** (method): recorded, with their counts.
- **Stale plan text** (both): the pointers' real shift, Files changed, Phase 1's title, the effort, the
  out-of-scope homes, and `engines` raised to Node 24.2.
- **Found, filed:** the merge job's static-import failure (fixed here, CI found it), and
  [bug 0664](../../bugs/0664-check-bun-load-exits-0-through-a-symlink.md).
- Minor, done: an in-process throw prints its stack; the agreement line prints on a shard with no
  in-process run, and names the first line two outputs differ at. The fallback catches
  `.json`, `.mts` and `.cts` too. The write callback is called with `null`.
