# Plan 0412: a code block parses with the parser the caller names

## Status

- **State:** Done — built 2026-10-14 in one PR, closed in the same PR. All three phases are built,
  every ledger box is ticked, and the ledger records three places the build changed the plan. Frozen
  to Ready the same day. Written against the 2026-10-14 review of proposal 006's Ask C, which split
  the ask into this plan (A, eess-md) and [plan 0413](../0413-eess-mermaid-ships-mermaids-own-parser.md)
  (B, eess-mermaid), in that order.
- **Implements:** proposal 006 — Ask C, the half that is useful without Mermaid. The conditions
  cited by number below are that review's.
- **Priority:** Medium — a new capability with one consumer waiting on it (proposal 006's consumer
  evidence, 2026-10-12). As of 2026-10-14 that consumer has an open bug of its own that waits on
  plans 0412 and 0413; the maintainer scheduled this plan next. Nothing is green today that should be red; a corpus simply has no way to
  say "every block parses".
- **Effort:** Medium — one PR. A model file, a builder, a condition and one async function in
  eess-md; no kernel change. Additive, eess-md `minor`.
- **Created:** 2026-10-14
- **Depends on:** [bug 0290](../../bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md),
  fixed — `MdDocument.codeBlocks` reads blocks at any depth, so a loop over it misses none.

## Problem

eess-md reads every fenced code block (`MdDocument.codeBlocks`, `packages/md/src/model/document.ts`)
and exposes no rule over them. A corpus that wants "every ` ```mermaid ` block parses" — or every
`json` block, or every `sql` block — has to write the loop, the error handling and the evidence
itself, and the hand-written loop is exactly where a check goes green on nothing: a parser that
fails to load, a parser that throws on block 3, a corpus that holds no blocks of that language.

eess-md cannot own the parsers. The one with a consumer, Mermaid's, needs a DOM and a worker
(spike 0411), and owning a grammar per language would put a second authority beside the real one.
So eess-md owns the **loop** and the **evidence**, and the caller names the parser.

## Design

### The conditions, by value (as of 2026-10-14)

The review conditions this plan answers, from proposal 006's `## Review — 2026-10-14` and its
amendment the same day. They are recorded here so the build depends on this file, not on that one.

| #   | condition, as amended                                                                                                                                   | answered in        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | One async call parses one language's blocks in one batch into a fact object; the builder is built from it; no rule surface becomes async                | Facts, then a rule |
| 2   | The port is `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`; a parser with no identity is a configuration error                       | The port           |
| 4   | The parser declares canaries and eess-md runs them; the residual (a caller who forges identity and canaries) is stated                                  | The port           |
| 5   | Every instrument failure is one unsuppressable finding per run, naming its cause with a remedy; once means one dedupe key (`file`, `ruleId`, `element`) | What can go wrong  |
| 9   | No Markdown loaded outranks everything, `.expectEmpty()` included; no block of the language is the zero-examined finding unless `.expectEmpty()`        | What can go wrong  |
| 10  | The tag is matched exactly; a near-miss is disclosed as unread beside the count                                                                         | Selection          |
| 13  | A block broken on purpose is kept out by glob or `.excluding()`, never by a skip comment                                                                | Selection          |

Conditions 3, 6, 7, 8, 11 and 12 (the outcome shapes, `unrecognised` wording for Mermaid, the
Markdown line through frontmatter, the worker, the tier claim and bug 0409) belong to plan 0413.

### The port (conditions 2 and 4, as amended)

```ts
// packages/md/src/model/code-block-parse.ts

/** What a parser says about one block. Never inferred: a parser that cannot tell says so. */
export type CodeBlockVerdict =
  | { readonly outcome: 'valid' }
  | {
      readonly outcome: 'invalid'
      readonly message: string
      /** 1-based, counted from the block's first body line; `null` when the parser cannot tell. */
      readonly line: number | null
      readonly remedy: string
    }
  | { readonly outcome: 'unrecognised'; readonly message: string; readonly remedy: string }

/** A block the parser must reject, with the outcome it must give. */
export interface CodeBlockCanary {
  readonly text: string
  readonly expect: 'invalid' | 'unrecognised'
}

/** A parser, named. eess-md never loads one itself. */
export interface CodeBlockParser {
  readonly name: string
  readonly version: string
  /** At least one. eess-md parses them in the same batch and checks their verdicts. */
  readonly canaries: readonly CodeBlockCanary[]
  /** One verdict per text, in order. May be synchronous. Must stop when `signal` aborts. */
  parse(
    texts: readonly string[],
    options: { readonly signal: AbortSignal; readonly budgetMs: number },
  ): readonly CodeBlockVerdict[] | Promise<readonly CodeBlockVerdict[]>
}
```

- The result type is `CodeBlockVerdict`, not `ParseResult`, which the kernel already exports.
- `parse` takes the whole batch (ADR-007's batch-first boundary), so a worker-backed parser pays its
  cold start once, not per block.
- **The parser declares canaries, and eess-md runs them.** They are prepended to the batch, and their
  verdicts are checked before any block's is read. A canary answered with the wrong outcome is an
  instrument finding. This puts the check where every parser passes through it. An always-`valid` stub
  must now forge both an identity and canaries that it answers correctly. That is the residual the
  docs state, and it is the residual condition 4 meant.
- **A parser rejects with a structured failure when it knows why.** eess-md reads two fields by
  shape: `remedy: string` and `blockIndex: number | null`. It does not check the class, so plan 0413
  needs no import of eess-md. eess-md uses `remedy` as the finding's `Fix:` line and maps
  `blockIndex` back to the block's file and line. A rejection without those fields gets eess-md's
  generic wording.

### Facts, then a synchronous rule (condition 1)

```ts
const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser })
codeBlocks(parsed).should().parse().check()
```

- `parseCodeBlocks` is the only async call. It returns a `ParsedCodeBlocks` fact object. The object
  holds:
  - the parser's identity;
  - one `ParsedCodeBlock` per block (`doc`, `block`, `verdict | null`);
  - any instrument failure;
  - the near-miss tags it did not read;
  - the number of documents loaded.
- **The fact object is registered.** `parseCodeBlocks` adds what it returns to a module-private
  `WeakSet`, as the kernel does for cardinality asserters (`packages/core/src/cardinality.ts`).
  `codeBlocks()` given an unregistered object throws `ArchConfigError`. Without this, a hand-built
  object of all `valid` verdicts would skip every guard below.
- `codeBlocks(parsed)` is an ordinary `RuleBuilder<ParsedCodeBlock, ParsedCodeBlocks>`. Its elements
  **are** the parsed set, so a predicate (`resideInFile`, `resideInFolder`) can only narrow what was
  parsed. It can never select a block no parser saw.
- **No rule surface becomes async.** The builder's doc comment and `docs/markdown.md` say why:
  facts first, then a synchronous builder.
  - The review placed this sentence beside ADR-015's loader row. That would add a binding clause to an
    Accepted ADR with no mechanism behind it, and ADR-015 is about module resolution. So this plan
    keeps it in the docs. The dated amendment in proposal 006 records the change.

### What can go wrong, and what each reports (conditions 5 and 9)

**Thrown by `parseCodeBlocks`, before anything is selected.** These are the configuration errors.
Neither depends on what a rule selects, so neither can be lost to an empty selection or to
`.expectEmpty()`. Condition 9's "any finding passes through" holds by construction.

- A parser with no `name` or `version`.
- A parser with no canaries.

**Reported by the rule:**

| what happened                                   | reported as                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| no Markdown file loaded                         | `sourceEmpty()`, the kernel's own precedence: `.expectEmpty()` cannot rescue it                         |
| files loaded, no block of the language          | the zero-examined finding unless `.expectEmpty()`, naming any near-miss tags and their files            |
| a canary answered wrongly                       | the instrument: which canary, what it expected, what came back                                          |
| `parse` throws or rejects                       | the instrument, with the failure's `remedy` and block when it carries them, else the parser's message   |
| `parse` exceeds the budget                      | the instrument, naming the budget, the value read and `budgetMs`, and the block if the parser named one |
| `parse` returns the wrong number of verdicts    | the instrument: "N texts, M verdicts"                                                                   |
| a verdict that is not one of the three outcomes | the instrument, never `valid`; this covers what `suppressErrors` returns                                |
| a verdict with an empty `message` or `remedy`   | the instrument                                                                                          |
| `invalid` with a line outside the block's body  | reported at the block's line, with "the parser gave line N for an M-line block"                         |
| `invalid`                                       | a finding at the block's Markdown line plus the verdict's line, with its remedy                         |
| `unrecognised`                                  | a finding with the parser's remedy, never worded as the author's syntax error                           |

- **A block with no verdict is never a pass** (ADR-010).
- **The instrument finding's shape is pinned.** It carries:
  - `rule` and `ruleId` = `'eess-md: code-block parser'`;
  - `element` = `'<name>@<version>'`;
  - `file: ''`;
  - `bypassFilters: true`.

  It follows eess-ts's walk exhaustion (`packages/ts/src/core/vacuity-diagnosis.ts`). It is emitted
  **once per rule from the fact object**, not per block. The builder appends it in its own
  `collectViolations()` override, after the kernel's. An instrument failure needs at least one block
  parsed, so it never meets the kernel's zero-examined early return.

- **Several rules over one failed fact object** collapse to one report through
  `dedupeConfigFindings`, whose key is `file`, `ruleId` and `element` (ADR-016 C3). eess-ts's
  `check-all` already calls it. A script gate must call it itself, and the docs say so, because plan
  0413's dogfood gate is such a script.
  - Two `parseCodeBlocks` calls with one parser over two corpora would also collapse. No consumer has
    two, so this is stated in the docs rather than keyed apart.
- **The budget is a start-up allowance plus a per-block allowance.** The caller overrides either
  through `parseCodeBlocks(corpus, { …, budget: { startUpMs, perBlockMs } })`. eess-md computes
  `budgetMs = startUpMs + perBlockMs × texts.length` (canaries included) and passes that total to
  `parse`. **Decided at the freeze:** `startUpMs = 10_000` and `perBlockMs = 250`. The evidence is
  three measured timings for 39 blocks, each including a worker's cold start of about 400 ms:
  - 588 ms;
  - 0.99 s;
  - 0.78 s.

  That is about 15 ms a block once the worker is up. The defaults sit at roughly 25× the cold start
  and 16× the per-block cost. A budget is a hang detector, not a performance gate. A false red on a
  slow CI runner costs more than a long wait on a real hang, so the margin is wide. 39 blocks get
  about 20 s. A test pins both defaults. When the budget runs out, eess-md aborts the `signal` it
  passed. Stopping is the parser's job, and plan 0413's worker terminates on it.
  - **A synchronous parser cannot be interrupted.** Its overrun is detected after it returns, as the
    same finding. One that never returns is unbounded, and the docs say so.

- **The fact object exposes a summary**: blocks parsed, parser name and version. A script gate prints
  it as "N mermaid blocks parse with mermaid 11.17.2", never "render". `check()` prints nothing on
  success, so the line belongs to the gate that prints it, which is plan 0413's.

### Selection (conditions 10 and 13)

- The language tag is matched exactly, per condition 10.
- **Near-miss** is this plan's decision, not the review's. It means a tag equal to the language
  only when case-folded, such as `Mermaid`. No alias list is kept: any wider "near" would be a list of
  spellings to maintain, with no consumer for one.
- A near-miss is disclosed on a green run as unread (ADR-016 rule 7). When it is the reason nothing
  was examined, the zero-examined finding names it, through the kernel's `deadGlobDiagnosis()` hook
  (`packages/core/src/rule-builder.ts`). The author is then sent to the spelling, not to
  `.expectEmpty()`.
- A block that is broken on purpose is kept out by the corpus glob or `.excluding()`. There is no
  skip comment, because that would be a second exclusion mechanism (ADR-018).

## Phases

One PR, built red-first in this order.

1. **Model and port.**
   - `code-block-parse.ts`: the types above, `parseCodeBlocks`, the registry, the canary check, the
     signal and budget, and the instrument classification.
   - Unit tests use in-test parsers:
     - a sync parser;
     - an async parser;
     - one that throws a structured failure;
     - one that throws a bare error;
     - one that never resolves, which must see its signal abort;
     - a sync parser that overruns;
     - one that returns too few verdicts;
     - one returning `undefined` or `{ outcome: 'ok' }`;
     - one with no identity;
     - one with no canaries;
     - one that answers a canary wrongly.
2. **Builder and condition.**
   - `builders/code-blocks.ts`: `codeBlocks()`, `resideInFile`, `resideInFolder`, `.should().parse()`.
   - `sourceEmpty()` and `deadGlobDiagnosis()` overridden from the fact object.
   - The instrument finding appended once per rule.
   - Exported from the eess-md root, with `check:family` still green.
3. **Non-vacuity and docs.**
   - The rows below.
   - `docs/markdown.md` gains a "Code blocks" section with:
     - the two-line example;
     - the forgery residual;
     - the synchronous-parser caveat;
     - the dedupe note;
     - a stub parser that is plainly a test double.

## Files Changed

- `packages/md/src/model/code-block-parse.ts` — new.
- `packages/md/src/builders/code-blocks.ts` — new.
- `packages/md/src/index.ts` — exports.
- `packages/md/tests/code-block-parse.test.ts` and fixtures under `packages/md/tests/fixtures/` — new.
- `scripts/nonvacuity/` — one fixture set and its case file. The harness header writes out no
  count, and must not start to.
- `docs/markdown.md`, `packages/md/README.md` — the section.
- `.changeset/` — eess-md `minor`.

## Test inventory

- A valid corpus, every block `valid`: a pass, with `examined` equal to the block count.
- An `invalid` verdict on a block nested in a list reports the block's own Markdown line plus the
  verdict's line.
- An `invalid` verdict with `line: null` reports the block's line and says the inner line is unknown.
  One with `line: 0` or past the body does the same, and names the bad value.
- An `unrecognised` verdict carries the parser's remedy, and the message never says "syntax error".
- Each instrument row in the table gives exactly one finding per rule, with the pinned shape.
  - Two rules over one failed fact object give one finding after `dedupeConfigFindings`.
  - A structured failure's `remedy` becomes the `Fix:` line, and its `blockIndex` becomes a file and
    line.
- On budget overrun, the parser's signal is aborted.
- A parser with no identity or no canaries throws, including over a corpus with no blocks of the
  language and `.expectEmpty()` declared.
- An unregistered fact object throws.
- Empty cases:
  - no Markdown loaded with `.expectEmpty()` declared is still a finding;
  - files loaded with no block of the language is a finding without `.expectEmpty()`, and a pass
    with it;
  - zero exact blocks and one `Mermaid` block is a finding that names `Mermaid`;
  - on a green run, a near-miss is disclosed in the summary.
- A predicate narrows, and nothing can widen past the parsed set.

## Non-vacuity rows (plan A's share of the review's table)

These are fixture-tier rows: they drive the builder over fixtures, not a `check:*` script. The
harness lists them in that tier (bug 0127).

| row                                                                       | breaks                                 |
| ------------------------------------------------------------------------- | -------------------------------------- |
| an `invalid` verdict reds at the block's Markdown line                    | the condition itself                   |
| a malformed verdict (`undefined`, `{ outcome: 'ok' }`) reds as instrument | condition 5, the `suppressErrors` path |
| zero blocks without `.expectEmpty()`; no Markdown loaded                  | condition 9                            |
| a parser with no identity; a parser with no canaries                      | conditions 2 and 4                     |
| a canary answered `valid` reds as instrument                              | condition 4                            |
| a parser that hangs; a parser that throws; a batch that drops a block     | condition 5                            |
| zero exact blocks, one `Mermaid` block: red, naming the tag               | condition 10                           |

Each row is a fixture that must red. Emptying the condition or the classification must turn that
row's red into a green, and the gate catches it.

## Out of scope

- **Any real parser.** Mermaid's is plan 0413. No JSON or YAML parser ships, because none has a
  consumer.
- **Which canaries Mermaid needs, and the worker's own failures** (missing peer, exit, version):
  plan 0413. This plan gives them a channel.
- **This repository's dogfood gate and its success line**: plan 0413, which has the parser to run
  them with.
- `scripts/check-docs-code.mjs`. It type-checks TypeScript fences across files, which a per-block
  parse cannot express. It is not a consumer and is not migrated.
- **An async `check()`**: needs an ADR, per condition 1.

## Success

- The two-line example runs against a stub parser in eess-md's own tests, and against a real parser
  in plan 0413's.
- Every row of the failure table has a test that drives the public entry points. Each non-vacuity
  row reds when its mechanism is removed.
- `npm run validate` is green, and `check:nonvacuity` prints its count.

## Progress ledger

- [x] Phase 1 — model and port, red-first: `packages/md/src/model/code-block-parse.ts`. Red first: the
      suite failed to import before the module existed. 26 tests now pass. A sabotage matrix of ten
      mutations turned each one red, then the code was restored: - the condition emptied; - the canary check off; - a malformed verdict read as valid; - the registry off; - the instrument not appended; - no abort on timeout; - a synchronous overrun ignored; - `sourceEmpty` off; - the near-miss diagnosis off; - the verdict-count check off.
- [x] Phase 2 — builder and condition, exported: `packages/md/src/builders/code-blocks.ts`, exported
      from the eess-md root with the port's types.
- [x] Phase 3 — non-vacuity rows, docs: - `scripts/nonvacuity/bad-code-block-parse.mjs`, with eleven rows in `check-nonvacuity.mjs`, one
      per row of the table above. Each scenario was run and fires. - `no-markdown` was tightened to its own message, and shown to go vacuous with `sourceEmpty`
      removed. - Docs: `docs/markdown.md` "Code blocks that parse" and a README section.
- [x] budget defaults (decided at the freeze) pinned by a test.
- [x] changeset: eess-md `minor` (`.changeset/code-blocks-parse.md`).

**What the build changed from the plan, and why:**

- **`parse` returns `readonly unknown[]`**, not `readonly CodeBlockVerdict[]`. eess-md checks every
  verdict's shape anyway. With the narrower type, the malformed-verdict tests (`undefined`,
  `{ outcome: 'ok' }`) could not be written without an `as` (ADR-005). The doc comment says to
  return `CodeBlockVerdict`s.
- **The docs do not tell a script gate to call `dedupeConfigFindings`.** It is exported only from
  `@nielspeter/eess/internal`, which ADR-011 makes family plumbing, not consumer API. The docs say
  instead that `eess-ts check` collapses the instrument to one, and that a script collecting findings
  itself sees one per rule. Plan 0413's own gate is in this repository and may import it.
- **The budget's caller-facing option** is `budget: { startUpMs, perBlockMs }`, as frozen. The total
  passed to `parse` is named in the instrument, together with which budget it came from.

Deferred: none
