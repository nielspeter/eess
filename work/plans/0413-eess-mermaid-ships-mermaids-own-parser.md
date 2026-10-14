# Plan 0413: eess-mermaid ships Mermaid's own parser

## Status

- **State:** Draft — written 2026-10-14 against the 2026-10-14 review of proposal 006's Ask C. This is
  plan B of that review's split; [plan 0412](./0412-a-code-block-parses-with-the-parser-the-caller-names.md)
  (A, eess-md) defines the port this plan's parser fills and is built first.
- **Implements:** proposal 006 — Ask C, "every Mermaid fence parses, by Mermaid's own parser". The
  conditions cited by number below are that review's.
- **Priority:** Medium — the consumer's ask itself; plan 0412 alone gives them a loop with no parser.
- **Effort:** Medium-large — one PR, the largest of the three items it waits on. A worker, its
  classifier, canaries, line recovery and a conformance test; no kernel change. Additive,
  eess-mermaid `minor`; crossvalidate moves with bug 0409, not with this plan.
- **Created:** 2026-10-14
- **Depends on**, in order:
  - [plan 0412](./0412-a-code-block-parses-with-the-parser-the-caller-names.md) — the port.
  - [plan 0214](./0214-extract-the-diagram-kind-predicate.md) — moves the preamble walk into
    eess-mermaid as `diagramKind()`. Conditions 6 and 7 extend that walk; there is no third copy.
    0214 is small and buildable now, so it lands first rather than being taken over here.
  - [bug 0409](../bugs/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md) — fixed before or with
    this plan (condition 12). Otherwise a block Mermaid accepts can still be reported by md-mermaid as
    the author's syntax error, beside this plan's green for the same block.

## Problem

After plan 0412, a corpus can say "every ` ```mermaid ` block parses" and name a parser, but eess
ships none for Mermaid. The only authority that agrees with what GitHub renders is the `mermaid`
package itself, and it does not run in plain Node: spike 0411 parsed 3 of 11 fences there, and a
labelled flowchart, a class, a state and a mindmap block — valid or not — all failed with a
`DOMPurify` `TypeError`. Loaded in-process with a DOM
shim, it would install globals into the adopter's test host.

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

- `mermaidParser()` returns an object of plan 0412's port shape, `{ name, version, parse(texts) }`.
  eess-mermaid matches the port **by shape** and does not import eess-md. The conformance test
  (Phase 4) lives in eess-crossvalidate, which already depends on both.
- **No static import of `mermaid` or `jsdom`.** Both are optional peers (`peerDependenciesMeta`,
  the precedent is eess-ts's `graphql`, `packages/ts/package.json:112`); only the worker imports
  them. An adopter who never calls `mermaidParser()` installs and loads neither.
- `version` is read from `mermaid`'s own `package.json`. Whether its `exports` map lets that file be
  resolved is measured in Phase 1; the fallback is resolving the package entry and walking up to its
  manifest.
- **The worker is self-contained**: it imports only Node built-ins, `mermaid` and `jsdom`, with no
  relative import. It is authored as a plain `.mjs` file shipped as-is in `dist`, so no loader has
  to transform it — ADR-015 teaches the host resolver `.js` → `.ts` and nothing reaches a worker's
  own resolution. **Its first test** runs it under vitest asserting the host's globals before and
  after, and once through the eess-ts CLI loader. If that test cannot be made green, the feature
  does not ship, and the plan returns for a decision.
- The README names which parser is which: `parseClassDiagram` is eess's own grammar, used to bind a
  diagram to code; `mermaidParser()` is Mermaid's, used to say a block parses. It shows the install
  line, `npm i -D mermaid@11 jsdom`, and its cost: about 180 MB on disk, of which `mermaid` is 84 MB
  and `jsdom` 9 MB (spike 0411's `du`).

### Three outcomes, by error shape (conditions 3 and 6)

| thrown inside the worker                           | outcome        | remedy                                                                            |
| -------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| an `Error` carrying `hash` (the jison kinds)       | `invalid`      | the parser's message, at the recovered line                                       |
| a `MermaidParseError` (the Langium kinds)          | `invalid`      | the parser's message; the line read from its text (`line 2, column 9`) or unknown |
| `UnknownDiagramError`, block has a kind line       | `unrecognised` | "check the spelling, or this kind needs a newer `mermaid` or a plugin"            |
| `UnknownDiagramError`, block empty                 | `unrecognised` | "the block is empty"                                                              |
| `UnknownDiagramError`, only directives or comments | `unrecognised` | "the block declares no diagram after its directives / comments"                   |
| anything else                                      | the instrument | —                                                                                 |
| a resolved value that is not a parse result        | the instrument | covers `suppressErrors`'s `false`                                                 |

- The **class** is decided from the error's shape, never from its message. The **line** may be read
  from the message, because the Langium kinds carry it nowhere else.
- Empty, directive-only and comment-only are told apart by `diagramKind()`'s walk (plan 0214),
  extended to say _why_ it found no kind. A misspelt kind and a kind not in core share one remedy,
  so no list of kinds is kept (OQ4 untouched).

### The Markdown line (condition 7)

A Mermaid error line is counted from what Mermaid parsed, not from the block body: measured,
frontmatter makes an error on body line 5 read "line 3". The walk returns the body offsets Mermaid
skipped, and the parser adds them back, so the verdict's `line` is counted from the block's first
body line, as plan 0412's port requires. Phase 2 measures which of frontmatter, directives and blank
leading lines Mermaid skips when it counts, one fixture each; eess-md then adds the block's own line.

### A forged verdict, and an instrument that fails (conditions 4 and 5)

- **Canaries.** Before the batch, the worker parses one known-broken block per error shape: a jison
  syntax error, a Langium syntax error, and an unknown kind. A canary answered with the wrong outcome
  is an instrument finding. This catches an always-`valid` stub dressed as this parser and a
  `mermaid` build that stopped throwing. The residual is stated in the README: a caller who forges
  identity and canaries both can still lie to themselves.
- **The worker's own failures**, each one instrument finding naming its cause, through plan 0412's
  constant-key, `bypassFilters` path:
  - a missing peer (`ERR_MODULE_NOT_FOUND`), with the install line;
  - a worker that exits without a result — measured, Node exits 13 naming nothing — naming the
    block in flight;
  - a parse past plan 0412's budget, naming the block in flight;
  - a `mermaid` version outside the declared range (`>=11 <12`, widened only by a release that has
    run the canaries against the new major).
- The worker reports the index it is about to parse before each block, so the block in flight is
  known on every path. It is terminated on every path, success included.

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
3. **Canaries, budget, version range.** The in-flight index and the terminate-on-every-path test.
4. **Conformance and dogfood.** eess-crossvalidate's test that `mermaidParser()` satisfies plan
   0412's port, by type and by one run. This repository's own row (below). README and docs.

## Dogfood row

- **Scope:** `work/`, `adr/` and `docs/`. mdast counts 4 top-level `mermaid` blocks and 0 nested
  there (bug 0290's record, 438 files; re-run by method review, 439). The gate prints its own count.
- **Where:** a script gate added to the `validate` chain beside `check:corpus`. It is a script, not
  an eess-ts rule file, so it calls `dedupeConfigFindings` itself (plan 0412).
- **The break:** a dangling `Route -->` added to `docs/manifesto.md`'s `graph` block reds it.
- **Exclusions:** fixture blocks that are broken on purpose stay out by glob (condition 13).
- **Cost:** `mermaid` and `jsdom` become root dev dependencies of this repository. The validate
  chain's added time is measured and recorded here before merge.

## Files Changed

- `packages/mermaid/src/mermaid-js/mermaid-worker.mjs`, `mermaid-parser.ts` — new.
- `packages/mermaid/src/index.ts` — `mermaidParser` export.
- `packages/mermaid/package.json` — optional peers; `files` keeps the worker.
- the moved `diagramKind()` (plan 0214's home) — the emptiness reason and skipped offsets.
- `packages/mermaid/tests/mermaid-parser.test.ts` and fixtures — new.
- `packages/crossvalidate/tests/mermaid-parser-port.test.ts` — new.
- `scripts/check-mermaid-parses.mjs`, `package.json` — the dogfood gate.
- `scripts/nonvacuity/` — plan B's rows; `scripts/check-nonvacuity.mjs` header count.
- `packages/mermaid/README.md`, `docs/` — the section.
- `.changeset/` — eess-mermaid `minor`.

## Test inventory

- host globals unchanged after a parse, under vitest and under the CLI loader;
- one valid block of each kind spike 0411 measured — the labelled flowchart, class, state and
  mindmap that fail in plain Node among them — is `valid`;
- each row of the outcome table, one block each;
- the line rows: plain, frontmatter, directive, blank lead — each lands on the exact Markdown line
  through plan 0412's builder;
- a missing peer, an early exit, a hang and an out-of-range version: one finding each, naming the
  cause and, where it applies, the block in flight;
- an always-`valid` stub wearing this parser's identity fails on the canary;
- the worker is terminated after success, failure, exit and timeout;
- the conformance test in crossvalidate;
- the dogfood gate reds on the manifesto break.

## Non-vacuity rows (plan B's share of the review's table)

| row                                                                                     | breaks      |
| --------------------------------------------------------------------------------------- | ----------- |
| a syntax error at the exact Markdown line, plus frontmatter, directive, blank-lead rows | condition 7 |
| the false red: a labelled flowchart passes in the worker                                | condition 8 |
| a missing peer; a worker that exits early; a version out of range                       | condition 5 |
| an always-`valid` stub fails on the canary                                              | condition 4 |
| empty, directive-only, misspelt and `zenuml`, each with its own remedy                  | condition 6 |

## Out of scope

- **The loop, the port and the evidence** — plan 0412.
- **Moving the preamble walk** — plan 0214; this plan extends it after it moves.
- **md-mermaid's wrong attribution** — bug 0409, a prerequisite.
- **Render checks** (Tier 2): a headless browser, which `parse()` deliberately is not.
- **A list of Mermaid kinds** — condition 6 keeps one remedy, so none is needed (OQ4).
- **Parsers for other languages** — none has a consumer.

## Success

- The two-line example in Design runs against this repository and prints its count and parser
  version.
- Every non-vacuity row reds when its mechanism is removed.
- `npm run validate` green, with the dogfood gate's time recorded.

## Progress ledger

- [ ] Phase 1 — worker, loading, globals test under vitest and the CLI loader
- [ ] Phase 2 — classification, emptiness reason, line recovery
- [ ] Phase 3 — canaries, budget, version range, terminate on every path
- [ ] Phase 4 — conformance test, dogfood gate, docs
- [ ] validate chain's added time measured and recorded
- [ ] changeset: eess-mermaid `minor`

Deferred: none
