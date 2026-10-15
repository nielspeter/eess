# Plan 0413: eess-mermaid ships Mermaid's own parser

## Status

- **State:** Ready — re-frozen 2026-10-15 on [spike 0428](../spikes/0428-where-mermaid-puts-an-errors-line.md).
  First frozen in PR #217 after [spike 0425](../spikes/0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md);
  unfrozen in PR #218, when the post-merge architect and enforcement review found the line rule wrong
  after a mid-body comment and four decisions left to the builder. Every finding of that review is
  answered under "Decided at the re-freeze", which names where. The dogfood gate is
  [plan 0427](./0427-this-repository-checks-its-mermaid-blocks-parse.md). Written 2026-10-14 against
  the 2026-10-14 review of proposal 006's Ask C, as plan B of that review's split;
  [plan 0412](./completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md) (A, eess-md)
  defines the port this plan's parser fills.
- **Implements:** proposal 006 — Ask C, "every Mermaid fence parses, by Mermaid's own parser". The
  conditions cited by number below are that review's.
- **Priority:** Medium — the consumer's ask itself; plan 0412 alone gives them a loop with no parser.
- **Effort:** Medium — one PR. A worker, its classifier, canaries, the line map and its canary, and
  a conformance test; no kernel change. The dogfood gate is plan 0427's. Additive, eess-mermaid `minor`.
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
- **`version` is the installed `mermaid`'s, read without loading it.** At construction the host
  resolves `mermaid` from the worker file's location, `createRequire(workerUrl).resolve('mermaid')`,
  and walks up to the first `package.json` named `mermaid`. That needs no `./package.json` export
  (spike 0428 Q6; the `./*` wildcard spike 0425 relied on is not assumed). Three results, measured:
  - resolves → its version;
  - `MODULE_NOT_FOUND` → `'not installed'` (the missing-peer finding below);
  - any other error, e.g. `ERR_PACKAGE_PATH_NOT_EXPORTED` → `'unreadable'`, and `parse` rejects
    naming that cause. An installed `mermaid` is never reported as missing (ADR-009 rule 2).
- **The worker reports the version it loaded**, read the same way from inside the worker, once per
  run. If it differs from `version`, `parse` rejects: the identity on the success line would not be
  the parser that judged.
- **The worker is self-contained**: it imports only Node built-ins, `mermaid` and `jsdom`, with no
  relative import. It is authored as a plain `.mjs` file, so no loader has to transform it — ADR-015
  teaches the host resolver `.js` → `.ts` and nothing reaches a worker's own resolution. `tsc` does
  not emit it, so the build copies it from `src/` to `dist/` with `fs.cpSync` (not `cp`), beside
  `mermaid-parser.js`; both resolve it as `new URL('./mermaid-worker.mjs', import.meta.url)`, which
  finds the `src/` copy under vitest and the `dist/` copy when published. ESLint gets a block for
  `src/**/*.mjs` without type-checked rules, since no tsconfig includes it. **Its first test** runs it
  under vitest asserting the host's globals before and after, and once through the eess-ts CLI
  loader. If that test cannot be made green, the feature does not ship, and the plan returns for a
  decision.
- **The worker posts facts; the host decides.** An error loses `hash` and `result` crossing
  `postMessage` (spike 0428 Q3), so the worker reads each error where it was thrown and posts only
  plain data. The messages, `{ type, … }`:
  - `{ type: 'loaded', version }` once, after `mermaid` and `jsdom` load;
  - `{ type: 'load-error', code, missing, message }` when they do not, where `missing` is the package
    named by `Cannot find package '…'`;
  - `{ type: 'progress', index }` before each text;
  - `{ type: 'verdicts', results }` at the end, one per text:
    `{ shape: 'ok' | 'jison' | 'langium' | 'unknown-diagram' | 'other' | 'non-result', locFirstLine,
hashLine, langiumLines, message }`.

  Shapes are tested in the worker, by property, never by class name or message: `jison` is an error
  whose `hash` is an object; `langium` one whose `result` holds `lexerErrors` and `parserErrors`
  arrays (their lines are `lexerErrors[i].line` and `parserErrors[i].token.startLine`);
  `unknown-diagram` one whose `name` is `'UnknownDiagramError'`; `non-result` a resolved value that is
  not an object (`suppressErrors`'s `false`). The worker is the interop boundary: the host narrows
  every message with type guards, never `as` (ADR-005). The classification, the preamble and the line
  map are the host's, so nothing in the worker copies the preamble walk.

- The README names which parser is which: `parseClassDiagram` is eess's own grammar, used to bind a
  diagram to code; `mermaidParser()` is Mermaid's, used to say a block parses. It shows the install
  line, `npm i -D mermaid@11 jsdom`, and its cost: 179 MB on disk, of which `mermaid` is 83 MB and
  `jsdom` 8.3 MB (spike 0425, `du` of a fresh install).

### Three outcomes, by error shape and preamble (conditions 3 and 6)

The host reads the block's preamble first, with `diagramPreamble(text)` (below), then the worker's
fact for it.

| preamble reason          | worker's fact                                       | outcome           | remedy                                                                                                  |
| ------------------------ | --------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `unclosed-frontmatter`   | any                                                 | `invalid`, line 1 | "close the frontmatter with a `---` line"                                                               |
| `unclosed-directive`     | any                                                 | `unrecognised`    | "a `%%{` directive is never closed with `}%%`"                                                          |
| `declared`               | `jison`, `langium`                                  | `invalid`         | "fix the syntax at this line; Mermaid's message is above", at the mapped line (below)                   |
| `declared`               | `unknown-diagram`                                   | `unrecognised`    | "check the spelling, or this kind needs a newer `mermaid` or a plugin"                                  |
| `empty`                  | `unknown-diagram`                                   | `unrecognised`    | "the block is empty"                                                                                    |
| `no-kind-after-preamble` | `unknown-diagram`, or an `other` naming frontmatter | `unrecognised`    | "the block declares no diagram after its directives, comments or frontmatter"                           |
| any                      | `other`                                             | the instrument    | the block's index, Mermaid's message, and "if this block is wrong, fix it; otherwise report it to eess" |
| any                      | `non-result`                                        | the instrument    | "`mermaid.parse` resolved without a result; is `suppressErrors` set?"                                   |

- **Unclosed frontmatter is decided from the text, per block** (enforcement I1). Mermaid throws a
  plain `Error` for it, and for closed frontmatter with nothing after it (spike 0428 Q5); without the
  preamble read first, one author typo would reach "anything else" and un-judge the whole run.
- **"Anything else" stays the instrument**, because plan 0412's port has no per-block instrument
  verdict and an unknown throw means the parser cannot be trusted for the batch. It is measured rare:
  of the shapes spike 0428 tried, only the two frontmatter shapes, now read from the text, reached it.
  The finding names the block in flight, so the author can tell their block from a broken install.
- **`diagramPreamble(text)` stays internal** to eess-mermaid (not exported from the package root):
  `{ kind, kindLine, reason }`, `reason` one of `declared`, `empty`, `no-kind-after-preamble`,
  `unclosed-directive`, `unclosed-frontmatter`. Unclosed is read first; any mix of directives, comments
  and frontmatter with no kind after it is one reason, with one remedy that names all three. This
  replaces the first freeze's public sibling export and its five names (architect M1): no adopter
  needs the reason, and an internal name can be changed without a break. `diagramKind(text)` stays as
  it is, a `string`, and becomes `diagramPreamble(text).kind`. Frontmatter is "unclosed" when the
  first line is `---` (indent allowed, as Mermaid's regex does) and no later `---` line closes it.
- A misspelt kind and a kind not in core share one remedy, so no list of kinds is kept (OQ4
  untouched).

### The Markdown line (condition 7)

Mermaid counts an error's line on the text it has preprocessed, not on the block: it drops
frontmatter with the blank lines after it, collapses a multi-line directive, and removes every
whole-line `%%` comment anywhere, with the blank lines before it (spike 0428 Q1). So:

- **Mermaid's line, by shape:** jison with `hash.loc` → `hash.loc.first_line`; jison without
  `hash.loc` (lexical) → `hash.line + 1`; Langium → the smallest of `lexerErrors[i].line` and
  `parserErrors[i].token.startLine`. None is read from the message.
- **The line map** puts it back on the block's line: an internal function beside the preamble walk
  that applies Mermaid's four line-moving steps (CRLF, frontmatter, directives, whole-line comments
  then `trimStart`) to the text while carrying each UTF-16 unit's origin line. Its regexes are
  Mermaid 11.17.2's, cited by file in the source.
- **The line canary.** On every run, before the blocks, the parser parses one known-broken block of
  its own whose true line it knows: frontmatter, a three-line directive and two mid-body comments
  before a jison error, and the same comments before a Langium error. If the map does not put either
  on its known line, `parse` rejects with "eess-mermaid's line map disagrees with mermaid X.Y.Z" and
  the remedy "pin `mermaid` to a version eess-mermaid lists, and report it to eess". A `mermaid` that
  changes its preprocessing goes red, never misplaces lines in silence. eess-md's canaries cannot do
  this; their verdicts carry no line.
- **After a trailing comment, no line is claimed.** When a line before the mapped line has `%%` after
  code, the verdict is `invalid` with `line: null` (eess-md then names the block), and its message
  adds "Mermaid's line count is unreliable after a trailing `%%` comment; it reported line N". Two
  kinds were measured to undercount there (spike 0428 Q2). This is conservative, not exact: it also
  withholds the line in the four kinds measured to count right, and it claims the mapped line in kinds
  never measured. The README states that residual.
- The verdict's `line` is counted from the block's first body line, as plan 0412's port requires;
  eess-md adds the block's own line.

### A forged verdict, and an instrument that fails (conditions 4 and 5)

- **Canaries.** `mermaidParser().canaries` declares one known-broken block per error shape: a jison
  syntax error (`invalid`), a Langium syntax error (`invalid`) and an unknown kind (`unrecognised`).
  eess-md runs them (plan 0412), so the check applies to any object passed as the parser. What it
  catches here, specifically, is a `mermaid` that stopped throwing — a new major, a changed error
  shape, `suppressErrors`. Two residuals go in the README: an always-`valid` stub must forge both the
  identity and correct canary answers (plan 0412 owns that test), and the canaries cover one kind per
  shape, so a regression confined to another kind passes them (enforcement M3).
- **The worker's own failures**, each one instrument finding naming its cause, through plan 0412's
  structured failure and pinned instrument shape, each with a remedy that clears it:

  | cause                                        | remedy                                                                                                                | clearing test                                    |
  | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
  | `mermaid` or `jsdom` not installed           | `npm i -D mermaid@11 jsdom`                                                                                           | the same worker copy with the packages linked in |
  | another package missing (`missing` names it) | "`<pkg>`, a dependency of mermaid or jsdom, is missing; reinstall them"                                               | as above                                         |
  | version unreadable, or loaded ≠ declared     | names both versions; "reinstall `mermaid`"                                                                            | a stub whose versions agree                      |
  | version outside `11.x`                       | "eess-mermaid reads mermaid 11; install `mermaid@11`"                                                                 | a stub at `11.0.0`                               |
  | the worker exits without a result            | names the block in flight; "leave that document out of the corpus by its `ignore` glob, and report the block to eess" | the same corpus with that document ignored       |
  | a parse past plan 0412's budget              | names the block in flight and the budget; "raise `budget.perBlockMs`, or leave that document out"                     | the same run with a larger budget                |
  | the line canary disagrees                    | as above                                                                                                              | the real `mermaid` 11.17.2                       |

- **The version range** is "major 11": `11.0.0-alpha.1` is in, `12.0.0-rc.1` is out. It is read by
  hand (no semver dependency), and widened only by a release that has run the canaries and the line
  canary against the new major.
- The worker posts the index it is about to parse before each block, so the block in flight is
  known on every path. It is terminated on every path, abort and success included; the test asserts
  the host process exits.
- **Zero blocks with a missing peer.** eess-md calls no parser when nothing is selected
  (`packages/md/src/model/code-block-parse.ts:327`). Without `.expectEmpty()` that is eess-md's
  zero-examined finding; with it, the green is sanctioned and judged nothing. The README says so.

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

1. **The worker and its loading.** `mermaid-worker.mjs`, `mermaidParser()`, the version reads, the
   optional peers, the load-error and early-exit findings. The globals test under vitest and the CLI
   loader comes first.
2. **Preamble, classification and lines.** `diagramPreamble`, the outcome table, the line map with
   its fixtures, the trailing-comment rule, the line canary.
3. **Canaries, abort, version range.** The in-flight index and the terminate-on-every-path test.
4. **Conformance and docs.** In eess-crossvalidate: the test that `mermaidParser()` satisfies plan
   0412's port, by type and by one run, and the Markdown-line rows through plan 0412's builder. The
   package's `exports` resolve to `dist/`, so these run the built, copied worker — the published
   shape — and need the build first. README and docs.

## Dogfood row

Moved to [plan 0427](./0427-this-repository-checks-its-mermaid-blocks-parse.md) at the freeze.

## Files Changed

- `packages/mermaid/src/mermaid-js/mermaid-worker.mjs`, `mermaid-parser.ts` — new.
- `packages/mermaid/src/index.ts` — `mermaidParser` export.
- `packages/mermaid/package.json` — optional peers; `mermaid@11` and `jsdom` as dev dependencies for
  the tests; `files` keeps the worker.
- `packages/mermaid/package.json` build script — copies the worker into `dist/`.
- beside the moved `diagramKind()` (plan 0214's home): `diagramPreamble` and the line map, both
  internal; `diagramKind` keeps its signature.
- `eslint.config.ts` — a block for `packages/*/src/**/*.mjs` without type-checked rules.
- `packages/mermaid/src/mermaid-js/create-mermaid-parser.ts` — internal; `mermaidParser()` is
  `createMermaidParser({ workerUrl: <the worker beside it> })`. Tests pass a worker copied into a
  scratch directory whose `node_modules` holds a stub `mermaid`, nothing, or links to the real
  packages. Not exported from the package root, and the package's `exports` map has no deep path, so
  no rule file can name a module to run (ADR-015).
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
- each row of the outcome table, one block each, including unclosed frontmatter and closed
  frontmatter with nothing after it;
- the line rows, the verdict line right in eess-mermaid's tests and on the exact Markdown line through
  plan 0412's builder in crossvalidate's: spike 0428's 17 mapped blocks (mid-body comments, a bare
  `%%`, directives before and mid-body, frontmatter with blank lines, CRLF, lexical, Langium) and the
  trailing-comment block (`line: null`, Mermaid's line quoted);
- the line canary: a map with one step removed reds it, naming the version;
- each row of the instrument table: the finding names its cause and, where it applies, the block in
  flight as a file and line; then its clearing test turns it green. All through a worker copied into
  a scratch directory; none runs `npm install`;
- the version range: `11.0.0-alpha.1` in, `12.0.0-rc.1` and `10.9.0` out;
- the worker is terminated after success, failure, exit and abort, and the host process exits;
- the conformance test in crossvalidate.

## Non-vacuity rows (plan B's share of the review's table)

All are fixture-tier (bug 0127): each spawns a worker, about 0.5–0.9 s, and the build PR records the
rows' added time on `check:nonvacuity`. The production-tier row is plan 0427's.

| row                                                                                                    | breaks      | matches on                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------ |
| a syntax error after mid-body comments lands on its exact Markdown line                                | condition 7 | the file and line                                                                                |
| the line map with one step removed: the line canary reds                                               | condition 7 | "line map disagrees"                                                                             |
| a corruption that drops the worker's DOM shim: the labelled flowchart is no longer `valid`             | condition 8 | the block's file and line                                                                        |
| a missing peer; a worker that exits early; a version out of range                                      | condition 5 | each cause's own text                                                                            |
| a `mermaid` stub that stops throwing, at an in-range version: fails on the canaries                    | condition 4 | the canary cause text, so a range or missing-peer cause cannot red it instead (bug 0110's class) |
| a non-parse throw is the instrument, never `invalid`                                                   | condition 5 | the instrument cause text                                                                        |
| a resolved non-result is the instrument                                                                | condition 5 | "resolved without a result"                                                                      |
| a hang names the block in flight and the process exits                                                 | condition 5 | the block's index, and exit                                                                      |
| empty, no kind after a preamble, unclosed frontmatter, misspelt and `zenuml`, each with its own remedy | condition 6 | each remedy's text                                                                               |

The false-red row is encoded in the harness's polarity: its fixture is the sabotaged worker, and the
row passes when the gate goes red on the valid block.

## Decided at the freeze (2026-10-15), still standing

Each is overrulable.

- **One rule for the tag: any letter case.** md-mermaid reads `Mermaid` since bug 0423; `parseCodeBlocks`
  matched exactly. eess-md's side is [bug 0426](../bugs/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md),
  fixed before this plan. The architect review asked for an ADR, since the rule reverses a ruled
  condition, removes public API and claims the family; it is written before bug 0426, outside this plan.
- **A missing peer is a finding, never a throw at construction.** `mermaidParser()` never throws: its
  `version` is `'not installed'` or `'unreadable'` and its `parse` rejects with the remedy above.
- **The dogfood gate is its own plan,** [0427](./0427-this-repository-checks-its-mermaid-blocks-parse.md).
  This plan's own tests need the real `mermaid` and `jsdom`, so they become eess-mermaid's dev
  dependencies here, and this repository's CI pays the 179 MB with this plan.

The first freeze's fourth decision, a public `diagramPreamble` with five reasons, is replaced below.

## Decided at the re-freeze (2026-10-15)

Each is overrulable. Where each review finding is answered:

| finding                                                               | answered in                                                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| architect C1 — comments anywhere; the offset is wrong                 | "The Markdown line": the line map and its canary                                             |
| architect I1 — Langium lines are in `result`                          | "The Markdown line": the smallest of the structured lines                                    |
| architect I2, enforcement I2 — the worker/host split                  | "The worker posts facts; the host decides"                                                   |
| architect I3, enforcement I4 — seams and the loaded version           | Files Changed (`createMermaidParser`); the version bullets; the canary row matches its cause |
| architect I4 — the tag rule as an ADR                                 | the first decision above; outside this plan                                                  |
| architect M1, enforcement I1 — the reason names; unclosed frontmatter | the outcome table; `diagramPreamble` internal                                                |
| architect M2 — the version via `./*`                                  | the version bullets                                                                          |
| architect M3 — lint and copy of the `.mjs`                            | the worker bullet; Files Changed                                                             |
| architect M4 — the conformance test runs the built worker             | Phase 4                                                                                      |
| architect M5, enforcement M1 — zero blocks, missing peer              | the last instrument bullet                                                                   |
| architect M6 — no ADR for the isolation yet                           | recorded; nothing owed                                                                       |
| enforcement I3 — three missing non-vacuity rows                       | Non-vacuity rows                                                                             |
| enforcement I5 — remedies that clear                                  | the instrument table's clearing column                                                       |
| enforcement M2 — the false-red row's polarity                         | Non-vacuity rows                                                                             |
| enforcement M3 — one canary kind per shape                            | the canaries bullet                                                                          |
| enforcement M4 — a transitive `ERR_MODULE_NOT_FOUND`                  | the instrument table                                                                         |
| enforcement M5 — prerelease ranges                                    | the version range bullet                                                                     |
| enforcement M6 — the rows' cost                                       | Non-vacuity rows                                                                             |
| enforcement M7 and the 0427 residual                                  | plan 0427, fixed in the same PR                                                              |

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

## Progress ledger

- [ ] Phase 1 — worker, loading, globals test under vitest and the CLI loader
- [ ] Phase 2 — preamble, classification, line map and its canary
- [ ] Phase 3 — canaries, budget, version range, terminate on every path
- [ ] Phase 4 — conformance test, docs
- [ ] changeset: eess-mermaid `minor`
- [ ] the dogfood gate (proposal 006's "Dogfood is not optional") — deferred→plan 0427 at the
      freeze, so the parser and the gate are each one reviewable PR

Deferred: plan 0427
