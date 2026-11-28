# Plan 0662: the corpus rows run in one process

## Status

- **State:** Ready — frozen 2026-11-28 for its build; authored 2026-11-27 from a measurement the same
  day, then rewritten the same day against its review by the enforcement, testing and method lenses
  ("Review, 2026-11-27" below). Design 1 changed at the freeze ("Decided at the freeze").
- **Priority:** High.
- **Effort:** Medium to large. An estimate of about two days, not measured: the gate's split, output
  capture, a reset per mutable state the inventory finds, and five sabotage rows.
- **Created:** 2026-11-27
- **Builds on:** [bug 0548](../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md), which made
  both of `check-corpus.mjs`'s exits read one verdict and put the end-to-end proof in two rows. It is
  [spike 0631](../spikes/0631-where-ci-time-goes.md)'s option C ("make nonvacuity cheaper"), which
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
([bug 0547](../bugs/fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md)), which keeps
each tree for the life of the process, keyed by a sha1 of the text and confirmed by an exact compare,
so a later run parses only the texts that changed. A row may run the gate more than once, so a row
saves about 6 s per gate run, not per row.

**What it is worth in CI, a projection.** From the per-row times of CI run 45969038139 (PR #344's
final commit), each in-process gate run at the measured 26% of its cost, and only the rows this plan
converts (not the rows it keeps fresh, the ledger rows, or the fixture rows that never start the
gate), as the method review recomputed: the slowest shard about 7.3 minutes, down from 11.1, and
about 24 machine-minutes, down from 38.9. That is before each shard's first full parse and its
shard-end check. The build measures it in CI. The `test` job (8–10 minutes on the same PR's runs) then
sets a PR's wait: [spike 0663](../spikes/0663-where-the-eess-ts-suite-spends-its-time.md).

## Design

**Proof kept.** Every converted row asserts what it asserts today, on the production gate's own code.
The command CI runs is proven end to end by the two rows
[bug 0548](../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md) built for it,
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
   records that it once hid a defect from every fixture.
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
   - the parse memo (`packages/md/src/model/prose.ts:175`): kept, keyed by text;
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
     break class, and a sabotage row hoists one;
   - the source-text registry on `globalThis`
     ([ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)).

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
[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md), cite lines of that file:
each would point past its end and red `check:corpus`. So the body stays where it is, wrapped in an
exported `runCheckCorpus(argv)`, and the command runs when `import.meta.main` is true, the other form
the enforcement review named. `import.meta.main` is `true` for this file run directly and through a
symlinked path (measured under Node 24.22.0; CI's `node-version: 24`). Below Node 24.2 it is
`undefined`, so the file throws when it is not a boolean: an old runtime fails closed rather than
exiting 0 with no output. Lines move by the wrapper's few lines, which the pointer gate, judging only
that a line exists, does not see ([bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md)'s
known gap, unchanged).

## Phases

1. The library and the command (Design 1, 2). Its output is identical to today's, the elapsed time
   masked, on: a clean tree; a planted broken link; `--format json`; `--format github`; each of the
   three early exits (`check-corpus.mjs:134`, `:215`, `:275`); an uncaught throw. The rows that match
   the gate's text keep their anchors: `emitter/one-dead-check`'s `^const linksChecked` and the two
   copying rows' patterns are checked against the moved body.
2. The inventory of Design 4, recorded by value in this plan, and a reset per entry decided "reset".
3. `corpusInProcess`, the conversion and the shard-end check (Design 3, 5).
4. The sabotage rows, then CI's shard times before and after, recorded by value.

## The inventory, measured 2026-11-28

At 3562cad7, by two searches over `packages/core/src`, `packages/md/src` and the nine `scripts/lib`
modules `check-corpus.mjs` imports: every module-level `let`; every module-level `Map`, `Set`,
`WeakMap` and `WeakSet`; every module-level array assigned `[]`; every value made by a `create…`
factory; every `globalThis` access. 41 and 10 lines. Each, decided:

| state                                                                                                                        | decision                                      | why                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comment-suppression.ts:50` `suppressions`                                                                                   | **reset per run** (`resetCommentSuppression`) | grows by run and reaches `--format json`'s `commentSuppressed`                                                                                      |
| `prose.ts:174` the parse memo                                                                                                | kept                                          | the saving; keyed by the text, confirmed by an exact compare                                                                                        |
| `proposal-ruling.mjs:108-109` `readings`, `openFences`                                                                       | kept                                          | memos of pure functions, keyed by the text                                                                                                          |
| `packages/md/src/model/links.ts:151` `walked`, `ledger.ts:368` `itemContinuations`                                           | kept                                          | keyed by a tree the memo shares across runs; each a function of the tree and its text                                                               |
| `diff-disclosure.ts:92` `noticed`                                                                                            | kept                                          | set only under a `diff` option (`packages/core/src/execute-rule.ts:390-394`); the gate passes none                                                  |
| `packages/core/src/violation.ts:348` identity collisions, `edge-coverage.ts:72`, `report.ts:72` the emitted count            | kept                                          | read only by eess-ts's CLI (`identityCollisions`, `violationsEmittedCount`), never by this gate                                                     |
| `stderr.ts:45`, `cli-config.ts:188`                                                                                          | kept                                          | one-time flags; setting them again changes nothing                                                                                                  |
| `source-roots.ts:54` the source-text registry on `globalThis`                                                                | kept                                          | written only by `corpusFromText`; the gate reads the disk through `corpus()`                                                                        |
| `selection-memo.ts`, the eess-md `WeakMap`s keyed by a `Corpus`, an `MdDocument`, a violation, an `AnchorRule` or a `RegExp` | kept                                          | keyed by objects a run builds anew, or derived from a constant pattern                                                                              |
| `packages/md/src/model/section-declarations.ts:21`, `packages/md/src/predicates/in-documents.ts:81`, `:112`                  | kept, with a sabotage row                     | keyed by a predicate or builder: safe while each is built inside the gate's function; a predicate built at module scope would be shared across runs |
| the `WeakSet` markers (`cardinality.ts:40`, `owns-empty-discovery.ts:67`, `code-block-parse.ts:110`) and the constant `Set`s | kept                                          | adding an object again, or reading a constant, changes nothing                                                                                      |

## Files changed

- `scripts/check-corpus.mjs` and the new `scripts/lib/check-corpus-run.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/core/src/` only if a reset the inventory needs does not exist (a changeset then)
- `work/spikes/0546-where-a-corpus-check-spends-its-time.md`: a dated correction, since its "each
  non-vacuity row starts a fresh process, so its saving is the within-process repeats only" stops
  holding
- `work/spikes/0631-where-ci-time-goes.md`: option C, decided
- [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md): the measured shards, and
  whether its five-run criterion is met
- `work/plans/ROADMAP.md`

## Test inventory

Measured 2026-11-28 in a detached worktree at c7a99d1a and its follow-ups, with its own `npm ci` and
build (45 s, 7 s), never in the main tree.

- [x] Phase 1's output identity: the gate before the change (a reference copy) and after, the elapsed
      time masked, on a clean tree in terminal, `--format json` and `--format github`; a planted broken
      link in terminal and json; each of the three early exits, triggered by the same edit to both
      copies; an injected throw (both exit 1 and name it; only the stack's length differs). All eight
      output cases byte-identical in exit code, stdout and stderr. Importing the file runs nothing
      (0.12 s); a symlinked path runs the gate.
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

- [x] **Sabotage, an accumulating state:** a standing row, `corpus/in-process-leak-caught`. Two
      in-process runs without the reset differ from a fresh run, and one with it equals it: passes.
- [x] done-otherwise **Sabotage, a hoisted predicate:** not built as a synthetic row, because the case
      exists in production. `notLeftOut` (`scripts/lib/record-mention.mjs:168`) is an `inDocuments(…)`
      predicate built once at module scope, so every in-process run shares it. Its per-run memo is keyed
      by `MdDocument`, which each run builds anew, and every mention row passed with the agreement check
      identical after 100 in-process runs.
- [x] **Sabotage, a throw:** a standing row, `corpus/in-process-throw-is-harness-error`: exit 2, the
      throw named. A throw injected into the gate's body leaves both streams restored (measured
      directly).
- [x] **Sabotage, a rewritten module run in-process:** `corpusInProcess`'s refusal replaced by
      `if (false)`: `emitter/one-dead-check` FAILED (json exit 0, terminal exit 0). With the refusal it
      passes, sent to a fresh process.
- [x] **Sabotage, the command:** its output not written: `corpus/terminal-exit` FAILED (finding listed
      false, red summary false) and `corpus/adr-production` FAILED (the ADR finding not seen). Its exit
      deleted reds `corpus/terminal-exit`, measured by
      [bug 0548](../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md).
- [ ] Shard times, as CI job durations, before (run 45969038139) and after, recorded by value, with
      the caveat of one run each side against the 1.6x variance
      [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md) measured.

## Out of scope

Not filed as records yet; each is filed when this plan has measured what holds:

- the arch, family and diagram rows, which start `eess-ts` and load a TypeScript project;
- the ledger rows, after [bug 0661](../bugs/0661-check-ledger-exits-on-a-second-list.md) gives the
  ledger gate one verdict;
- a parse cache on disk, which [PR #343](https://github.com/nielspeter/eess/pull/343) plans;
- the `test` job, which [spike 0663](../spikes/0663-where-the-eess-ts-suite-spends-its-time.md)
  measures.

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
- **A command guard can fail open** (enforcement): no guard; a library and a command.
- **A throw was undefined** (enforcement): it is a harness error, with a sabotage row.
- **The projection applied the ratio to rows the design keeps fresh** (method): restated, about 7.3
  minutes and 24 machine-minutes.
- **The lineage and the overlap with PR #343** (method): stated in the header.
- Minor: the recipe for the measurement; 290 frozen on CI; the gate's early exits; the effort; the
  out-of-scope homes stated as unfiled.
