# Plan 0413: eess-mermaid ships Mermaid's own parser

## Status

- **State:** Draft — frozen in PR #217, unfrozen in PR #218 (both 2026-10-15). The post-merge
  architect and enforcement review found the frozen line rule wrong and four decisions left to the
  builder; [spike 0428](../spikes/0428-where-mermaid-puts-an-errors-line.md) measured them. The
  re-freeze owes "Owed at the re-freeze" below. The first freeze followed [spike 0425](../spikes/0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md)
  measured what this plan had deferred to its build. Three decisions are recorded under "Decided at
  the freeze". The dogfood gate moved to [plan 0427](./0427-this-repository-checks-its-mermaid-blocks-parse.md).
  Written 2026-10-14 against the 2026-10-14 review of proposal 006's Ask C, as plan B of that
  review's split; [plan 0412](./completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md)
  (A, eess-md) defines the port this plan's parser fills.
- **Implements:** proposal 006 — Ask C, "every Mermaid fence parses, by Mermaid's own parser". The
  conditions cited by number below are that review's.
- **Priority:** Medium — the consumer's ask itself; plan 0412 alone gives them a loop with no parser.
- **Effort:** Medium — one PR. A worker, its classifier, canaries, line recovery and a conformance
  test; no kernel change. The dogfood gate is plan 0427's. Additive, eess-mermaid `minor`.
  crossvalidate gains tests only, declared `none` in the changeset.
- **Created:** 2026-10-14
- **Depends on**, in order:
  - [plan 0412](./completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md) — the port.
  - [plan 0214](completed/0214-extract-the-diagram-kind-predicate.md) — moves the preamble walk into
    eess-mermaid as `diagramKind()`. Conditions 6 and 7 extend that walk; there is no third copy.
    0214 is Done (PR #212); this plan does not take it over.
  - [bug 0426](../bugs/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md) —
    `parseCodeBlocks` reads the tag case-insensitively, the family rule this freeze settled. Sequenced
    **before** this plan so this PR carries no other package's change; nothing in this plan needs it
    technically.
  - [bug 0409](../bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md) — fixed **before** this
    plan (condition 12 allowed "before or with"; "before" keeps this PR from carrying another
    record's fix and close). Otherwise a block Mermaid accepts can still be reported by md-mermaid as
    the author's syntax error, beside this plan's green for the same block.

## Problem

After plan 0412, a corpus can say "every ` ```mermaid ` block parses" and name a parser, but eess
ships none for Mermaid. The only authority that agrees with what GitHub renders is the `mermaid`
package itself, and it does not run in plain Node: spike 0411 parsed 3 of 11 fences there, and a
labelled flowchart, a class, a state and a mindmap block — valid or not — all failed with a
`DOMPurify` `TypeError`. Loaded in-process with a DOM shim, it would install globals into the
adopter's test host.

Spike 0411 measured the way through: `mermaid` and `jsdom` inside a `worker_threads` worker leave
the host's globals clean. Three timings exist for 39 blocks, start-up included: 588 ms, 0.99 s and
0.78 s (the review's condition 5 says which population each measured).

## Design

### The parser (conditions 2 and 8)

```ts
import { mermaidParser } from '@nielspeter/eess-mermaid'
import { parseCodeBlocks, codeBlocks } from '@nielspeter/eess-md'

const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser: mermaidParser() })
codeBlocks(parsed).should().parse().check()
```

- `mermaidParser()` returns an object of plan 0412's port shape:
  `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`. eess-mermaid matches the port
  **by shape** and does not import eess-md. Every test that needs both — the conformance test and
  the Markdown-line rows — lives in eess-crossvalidate, which already depends on both.
- It rejects with plan 0412's structured failure (`remedy`, `blockIndex`), so each cause below
  reaches the finding with its own `Fix:` line and the block as a file and line.
- **No static import of `mermaid` or `jsdom`.** Both are optional peers (`peerDependenciesMeta`,
  the precedent is eess-ts's `graphql`, `packages/ts/package.json:112`); only the worker imports
  them. An adopter who never calls `mermaidParser()` installs and loads neither.
- `version` is read from `mermaid`'s own `package.json` with
  `createRequire(import.meta.url).resolve('mermaid/package.json')`, which resolves although `mermaid`'s
  `exports` map lists no `./package.json` (spike 0425).
- **The worker is self-contained**: it imports only Node built-ins, `mermaid` and `jsdom`, with no
  relative import. It is authored as a plain `.mjs` file, so no loader has to transform it — ADR-015
  teaches the host resolver `.js` → `.ts` and nothing reaches a worker's own resolution. `tsc` does
  not emit it, so the build copies it from `src/` to `dist/` beside `mermaid-parser.js`; both
  resolve it as `new URL('./mermaid-worker.mjs', import.meta.url)`, which finds the `src/` copy under
  vitest and the `dist/` copy when published. **Its first test** runs it under vitest asserting the host's globals before and
  after, and once through the eess-ts CLI loader. If that test cannot be made green, the feature
  does not ship, and the plan returns for a decision.
- The README names which parser is which: `parseClassDiagram` is eess's own grammar, used to bind a
  diagram to code; `mermaidParser()` is Mermaid's, used to say a block parses. It shows the install
  line, `npm i -D mermaid@11 jsdom`, and its cost: 179 MB on disk, of which `mermaid` is 83 MB and
  `jsdom` 8.3 MB (spike 0425, `du` of a fresh install).

### Three outcomes, by error shape (conditions 3 and 6)

| thrown inside the worker                                           | outcome        | remedy                                                                           |
| ------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------- |
| an `Error` carrying `hash` (the jison kinds)                       | `invalid`      | "fix the syntax at this line; Mermaid's message is above", at the recovered line |
| a `MermaidParseError` (the Langium kinds)                          | `invalid`      | the same; the line read from its text (`line 2, column 8`) or unknown            |
| `UnknownDiagramError`, block has a kind line                       | `unrecognised` | "check the spelling, or this kind needs a newer `mermaid` or a plugin"           |
| `UnknownDiagramError`, block empty                                 | `unrecognised` | "the block is empty"                                                             |
| `UnknownDiagramError`, only directives or comments (mixed: either) | `unrecognised` | "the block declares no diagram after its directives / comments"                  |
| `UnknownDiagramError`, only frontmatter                            | `unrecognised` | "the block declares no diagram after its frontmatter"                            |
| `UnknownDiagramError`, a directive never closed                    | `unrecognised` | "a `%%{` directive is never closed with `}%%`"                                   |
| anything else                                                      | the instrument | —                                                                                |
| a resolved value that is not a parse result                        | the instrument | covers `suppressErrors`'s `false`                                                |

- The **class** is decided from the error's shape, never from its message. The **line** may be read
  from the message, because the Langium kinds carry it nowhere else.
- Empty, directive-only and comment-only are told apart by `diagramKind()`'s walk (plan 0214),
  extended to say _why_ it found no kind. A misspelt kind and a kind not in core share one remedy,
  so no list of kinds is kept (OQ4 untouched).

### The Markdown line (condition 7)

_(Falsified by spike 0428: Mermaid drops `%%` comment lines anywhere, not only before the kind line.
Rewritten at the re-freeze.)_ **Measured (spike 0425):** Mermaid drops every line before the kind line (frontmatter, `%%` lines,
directives, blank lines) and counts its error line from the kind line. So the verdict's `line`, counted
from the block's first body line as plan 0412's port requires, is Mermaid's line plus the number of
lines before the kind line. It held for frontmatter, a directive and blank leading lines, for both
error families, and for lexical errors. Mermaid's line, by error shape:

- **jison, with `hash.loc`** (parse errors): `hash.loc.first_line`. At the end of input the message
  names the line after the last one, so the message is not used.
- **jison, without `hash.loc`** (lexical errors): `hash.line + 1`; `hash.line` is 0-based.
- **Langium** (`MermaidParseError`): the message's "line N"; nothing else carries it. _(Falsified by
  spike 0428: `result.lexerErrors` / `parserErrors` carry the lines.)_

eess-md then adds the block's own line. _(Corrected after PR #217's review: the first freeze took every
jison line from `hash.loc.first_line`, which a lexical error does not have. Spike 0425 records the
correction.)_

### A forged verdict, and an instrument that fails (conditions 4 and 5)

- **Canaries.** `mermaidParser().canaries` declares one known-broken block per error shape: a jison
  syntax error (`invalid`), a Langium syntax error (`invalid`) and an unknown kind (`unrecognised`).
  eess-md runs them (plan 0412), so the check applies to any object passed as the parser. What it
  catches here, specifically, is a `mermaid` that stopped throwing — a new major, a changed error
  class, `suppressErrors`. An always-`valid` stub must forge both the identity and correct canary
  answers; that residual is stated in the README, and plan 0412 owns its test.
- **The worker's own failures**, each one instrument finding naming its cause, through plan 0412's
  structured failure and pinned instrument shape:
  - a missing peer (`ERR_MODULE_NOT_FOUND`), with the install line;
  - a worker that exits without a result — measured, Node exits 13 naming nothing — naming the
    block in flight;
  - a parse past plan 0412's budget: eess-md aborts the `signal`, the worker is terminated, and the
    rejection names the block in flight;
  - a `mermaid` version outside the declared range (`>=11 <12`, widened only by a release that has
    run the canaries against the new major).
- The worker posts the index it is about to parse before each block, so the block in flight is
  known on every path. It is terminated on every path, abort and success included; the test asserts
  the host process exits.

### Two checks on one block (condition 12)

A `classDiagram` block may be judged twice, on purpose: by md-mermaid (eess's grammar, for binding)
and by this check (Mermaid's, for syntax). Each finding names its parser. After bug 0409 a block
Mermaid accepts is never reported by md-mermaid as the author's syntax error.

### Tier (condition 11)

Tier 1, static. The success line says "parses with mermaid 11.17.2", never "renders": `parse()`
accepts three things that fail at render — a `gantt` task dated `nonsense`, a `journey` step with a
non-numeric score, and an unclosed `mindmap` root. The README lists them.

## Phases

One PR, red-first.

1. **The worker and its loading.** `mermaid-worker.mjs`, `mermaidParser()`, the version read, the
   optional peers, the missing-peer and early-exit findings. The globals test under vitest and the
   CLI loader comes first.
2. **Classification and lines.** The outcome table, `diagramKind()`'s emptiness reason, the line
   recovery with one fixture per preamble shape.
3. **Canaries, abort, version range.** The in-flight index and the terminate-on-every-path test.
4. **Conformance and docs.** In eess-crossvalidate: the test that `mermaidParser()` satisfies plan
   0412's port, by type and by one run, and the Markdown-line rows through plan 0412's builder.
   README and docs.

## Dogfood row

Moved to [plan 0427](./0427-this-repository-checks-its-mermaid-blocks-parse.md) at the freeze.

## Files Changed

- `packages/mermaid/src/mermaid-js/mermaid-worker.mjs`, `mermaid-parser.ts` — new.
- `packages/mermaid/src/index.ts` — `mermaidParser` export.
- `packages/mermaid/package.json` — optional peers; `mermaid@11` and `jsdom` as dev dependencies for
  the tests; `files` keeps the worker.
- `packages/mermaid/package.json` build script — copies the worker into `dist/`.
- beside the moved `diagramKind()` (plan 0214's home), a **sibling export** for the emptiness reason
  and skipped offsets, with `diagramKind` kept as the string view of it. `diagramKind` returns a
  `string`, so changing its return type would be a break, not the additive minor this plan claims
  (PR #212's architect review).
- `packages/mermaid/tests/mermaid-parser.test.ts` and fixtures — new; the parser alone, no eess-md.
- `packages/crossvalidate/tests/mermaid-parser-port.test.ts` — new; conformance and the
  Markdown-line rows.
- `scripts/nonvacuity/` — plan B's rows. The harness header writes out no count and must not start to.
- `packages/mermaid/README.md`, `docs/` — the section.
- `.changeset/` — eess-mermaid `minor`; `@nielspeter/eess-crossvalidate: none` (tests only).

## Test inventory

- host globals unchanged after a parse, under vitest and under the CLI loader;
- one valid block of each kind spike 0411 measured — the labelled flowchart, class, state and
  mindmap that fail in plain Node among them — is `valid`;
- each row of the outcome table, one block each;
- the line rows: plain, frontmatter, directive, blank lead, a parse error mid-block, and a lexical
  error with and without frontmatter — the parser's verdict line is right in
  eess-mermaid's tests, and lands on the exact Markdown line through plan 0412's builder in
  crossvalidate's;
- a missing peer, an early exit, a hang and an out-of-range version: one finding each, naming the
  cause, carrying its own remedy, and, where it applies, the block in flight as a file and line;
- the remedy clears the finding: installing the peer turns the missing-peer row green;
- a stubbed `mermaid` module that stops throwing, under the real worker, fails on the canaries;
- the worker is terminated after success, failure, exit and abort, and the host process exits;
- the conformance test in crossvalidate;

## Non-vacuity rows (plan B's share of the review's table)

| row                                                                                                            | breaks      |
| -------------------------------------------------------------------------------------------------------------- | ----------- |
| a syntax error at the exact Markdown line, plus frontmatter, directive, blank-lead, mid-block and lexical rows | condition 7 |
| the false red: a labelled flowchart passes in the worker                                                       | condition 8 |
| a missing peer; a worker that exits early; a version out of range                                              | condition 5 |
| a `mermaid` that stops throwing fails on the canaries                                                          | condition 4 |
| empty, directive-only, misspelt and `zenuml`, each with its own remedy                                         | condition 6 |

## Decided at the freeze (2026-10-15)

Each is overrulable.

- **One rule for the tag: any letter case.** md-mermaid reads `Mermaid` since bug 0423; `parseCodeBlocks`
  matched exactly. A fence tagged `Mermaid` is plainly meant as Mermaid, so the family reads tags
  case-insensitively. eess-md's side is [bug 0426](../bugs/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md),
  fixed before this plan.
- **A missing peer is a finding, never a throw at construction.** `parseCodeBlocks` reads a parser's
  name and version before anything is selected, and refuses an empty one. So `mermaidParser()` never
  throws: when `mermaid` cannot be resolved its `version` is `'not installed'`, and its `parse`
  rejects with plan 0412's structured failure, `remedy: 'npm i -D mermaid@11 jsdom'` and
  `blockIndex: null`. The missing peer is then one instrument finding with the install line as its fix.
- **The preamble walk's new export is a sibling, `diagramPreamble(text)`**, returning
  `{ kind, kindLine, reason }`, where `kindLine` is the 0-based index of the kind line (or `null`) and
  `reason` is `'declared' | 'empty' | 'comments-only' | 'directives-only' | 'frontmatter-only' |
'unclosed-directive'`. A preamble that mixes them takes the first that applies of directive, comment,
  frontmatter: comments plus a directive is `'directives-only'`, frontmatter plus a comment is
  `'comments-only'`. _(`'frontmatter-only'` and the order added after PR #217's second review, which
  found the outcome table's frontmatter row had no `reason` to come from.)_
  `diagramKind(text)` stays a `string` and becomes `diagramPreamble(text).kind`, so nothing that
  exists changes.
- **The dogfood gate is its own plan,** [0427](./0427-this-repository-checks-its-mermaid-blocks-parse.md),
  so each is one reviewable PR. Its design moved there unchanged. The install cost is not the reason:
  this plan's own tests need the real `mermaid` and `jsdom`, so they become eess-mermaid's dev
  dependencies here, and this repository's CI pays the 179 MB with this plan.

## Out of scope

- **The loop, the port and the evidence** — plan 0412.
- **Moving the preamble walk** — plan 0214; this plan extends it after it moves.
- **md-mermaid's wrong attribution** — bug 0409, a prerequisite.
- **Render checks** (Tier 2): a headless browser, which `parse()` deliberately is not.
- **A list of Mermaid kinds** — condition 6 keeps one remedy, so none is needed (OQ4).
- **Parsers for other languages** — none has a consumer.

## Success

- The two-line example in Design runs in eess-crossvalidate's tests and prints its count and parser
  version.
- Every non-vacuity row reds when its mechanism is removed.
- `npm run validate` green.

## Owed at the re-freeze

From the post-merge review of the first freeze (architect and enforcement, 2026-10-15) and spike 0428.
Nothing below is decided until the re-freeze writes it into the sections above.

- **The line map** (architect C1): Mermaid removes `%%` comment lines anywhere, so the single offset
  is wrong. Spike 0428's map, the line canary, and no line claimed after a trailing `%%` comment.
  `diagramPreamble`'s frozen `{ kind, kindLine, reason }` changes or the map stays internal.
- **The worker/host split** (architect I2, enforcement I2): the worker posts shape facts; the host
  classifies with `diagramPreamble` and the map. Name the shapes and the message union.
- **Langium lines from `result`**, the smallest (architect I1).
- **Test seams and the loaded version** (architect I3, enforcement I4): copy the real worker; the
  worker reports the version it loaded, read by walking up; a mismatch is an instrument finding. The
  stubbed-mermaid non-vacuity row matches on the canary cause text, so a range or missing-peer cause
  cannot red it for the wrong reason (enforcement I4; bug 0110's class). The missing-peer clearing
  test must not run `npm install` inside a test (architect I3).
- **Unclosed frontmatter** (enforcement I1): a reason of its own, per block, the author's error;
  closed frontmatter with no newline after it throws the same `Error` (spike 0428 Q5). And
  whether "anything else" stays batch-fatal.
- **The reason enum's names** (architect M1, enforcement I1).
- **Three non-vacuity rows** (enforcement I3): a non-parse throw, a resolved non-result, a hang that
  names the block and exits.
- **Remedies that clear** (enforcement I5): early exit, budget, out-of-range version.
- **Minors**: the version read via `./*` (architect M2); the `.mjs` worker's lint and copy (M3); the
  conformance test runs the built worker (M4); zero blocks with a missing peer (architect M5,
  enforcement M1); the false-red row's polarity, per-kind canary residual, a transitive
  `ERR_MODULE_NOT_FOUND`, prerelease ranges, the rows' cost (enforcement M2–M6).
- **Plan 0427's drift** (enforcement M7), its priority, its exclusion glob (condition 13) and its
  production-tier row text, fixed in 0427 itself.
- No ADR for the worker isolation yet (architect M6): recorded, nothing owed.
- **The tag-case rule as an ADR** (architect I4): before bug 0426, not part of this plan.

## Progress ledger

- [ ] Phase 1 — worker, loading, globals test under vitest and the CLI loader
- [ ] Phase 2 — classification, emptiness reason, line recovery
- [ ] Phase 3 — canaries, budget, version range, terminate on every path
- [ ] Phase 4 — conformance test, docs
- [ ] changeset: eess-mermaid `minor`
- [ ] the dogfood gate (proposal 006's "Dogfood is not optional") — deferred→plan 0427 at the
      freeze, so the parser and the gate are each one reviewable PR

Deferred: plan 0427
