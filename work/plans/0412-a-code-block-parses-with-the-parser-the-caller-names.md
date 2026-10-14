# Plan 0412: a code block parses with the parser the caller names

## Status

- **State:** Draft — written 2026-10-14 against the 2026-10-14 review of proposal 006's Ask C,
  which split the ask into this plan (A, eess-md) and [plan 0413](./0413-eess-mermaid-ships-mermaids-own-parser.md)
  (B, eess-mermaid), in that order.
- **Implements:** proposal 006 — Ask C, the half that is useful without Mermaid. The conditions
  cited by number below are that review's.
- **Priority:** Medium — a new capability with one consumer waiting on it (proposal 006's consumer
  evidence, 2026-10-12). Nothing is green today that should be red; a corpus simply has no way to
  say "every block parses".
- **Effort:** Medium — one PR. A model file, a builder, a condition and one async function in
  eess-md; no kernel change. Additive, eess-md `minor`.
- **Created:** 2026-10-14
- **Depends on:** [bug 0290](../bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md),
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

### The port (conditions 2 and 4)

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

/** A parser, named. eess-md never loads one itself. */
export interface CodeBlockParser {
  readonly name: string
  readonly version: string
  /** One verdict per text, in order. May be synchronous. */
  parse(
    texts: readonly string[],
  ): readonly CodeBlockVerdict[] | Promise<readonly CodeBlockVerdict[]>
}
```

- The result type is `CodeBlockVerdict`, not `ParseResult`, which the kernel already exports.
- `parse` takes the whole batch (ADR-007's batch-first boundary): a worker-backed parser pays its
  cold start once, not per block.
- **Identity is checked, not trusted.** An empty `name` or `version` is a configuration finding.
  This is plan A's whole defence against a forged parser, and it is a thin one: a stub with an
  identity passes. The canaries that catch an always-`valid` stub are plan B's (condition 4), and
  the residual — a caller who forges both — is stated in the docs, not hidden.

### Facts, then a synchronous rule (condition 1)

```ts
const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser })
codeBlocks(parsed).should().parse().check()
```

- `parseCodeBlocks` is the only async call. It collects the blocks of one language, calls
  `parser.parse` once, and returns a `ParsedCodeBlocks` fact object: the parser's identity, one
  `ParsedCodeBlock` per block (`doc`, `block`, `verdict | null`), any instrument failure, and the
  near-miss tags it did not read.
- `codeBlocks(parsed)` is an ordinary `RuleBuilder<ParsedCodeBlock, ParsedCodeBlocks>`. Its elements
  **are** the parsed set, so a predicate (`resideInFile`, `resideInFolder`) can only narrow what was
  parsed; it can never select a block no parser saw.
- No rule surface becomes async. ADR-015's loader row gains one sentence saying so, where the next
  author of an async surface will find it: facts first, then a synchronous builder; an async
  `check()` needs an ADR.

### What can go wrong, and what each reports (conditions 5 and 9)

| what happened                                   | reported as                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| no Markdown file loaded                         | `sourceEmpty()` — the kernel's own precedence; `.expectEmpty()` cannot rescue it     |
| files loaded, no block of the language          | the zero-examined configuration finding, unless `.expectEmpty()` is declared         |
| parser has no `name` or `version`               | one configuration finding, before `parse` is called                                  |
| `parse` throws or rejects                       | one instrument finding naming the parser and its message; every block has no verdict |
| `parse` exceeds the budget                      | one instrument finding naming the parser, the batch size and the budget              |
| `parse` returns the wrong number of verdicts    | one instrument finding: "N blocks, M verdicts"                                       |
| a verdict that is not one of the three outcomes | the instrument, never `valid` — covers what `suppressErrors` returns                 |
| `invalid`                                       | a finding at the block's Markdown line plus the verdict's line, with its remedy      |
| `unrecognised`                                  | a finding with the parser's remedy — never worded as the author's syntax error       |

- **A block with no verdict is never a pass** (ADR-010). Each instrument finding is a
  `bypassFilters` configuration finding with a constant `ruleId`, `'eess-md: code-block parser'` —
  the same shape as eess-ts's walk exhaustion in `packages/ts/src/core/vacuity-diagnosis.ts` — so
  several rules reading one failed fact object collapse to one report through
  `dedupeConfigFindings` (ADR-016 C3). eess-ts's `check-all` already dedupes; a script gate that
  does not go through it must call `dedupeConfigFindings` itself, and the docs say so, because plan
  0413's dogfood row is such a gate.
- **The budget is a default with an override**, `{ budgetMs }`. The default is set in the build from
  the three measured timings for 39 blocks (588 ms, 0.99 s, 0.78 s) with headroom for cold CI, and
  the build records the figure it chose and why. eess-md stops _waiting_ at the budget; stopping the
  parser is the parser's job (plan B terminates its worker). Naming the block in flight is plan B's
  too: a batch port cannot know which block a parser is on.
- **The success line names the parser**: `✓ 4 mermaid blocks parse with mermaid 11.17.2` — never
  "render" (condition 11 is plan B's, but the word is fixed here).

### Selection (conditions 10 and 13)

- The language tag is matched exactly. A near-miss — a tag equal to the language only when
  case-folded, such as `Mermaid` — is disclosed beside the count as unread (ADR-016 rule 7), not
  parsed and not silently dropped. No alias list: any wider notion of "near" would be a list of
  spellings to keep, and there is no consumer for one yet.
- A block that is broken on purpose is kept out by the corpus glob or `.excluding()`. No skip
  comment: that would be a second exclusion mechanism (ADR-018).

## Phases

One PR, built red-first in this order.

1. **Model and port.** `code-block-parse.ts`: the types above, `parseCodeBlocks`, the instrument
   classification. Unit tests with in-test parsers: a sync parser, an async parser, one that throws,
   one that never resolves, one that returns too few verdicts, one with no identity, one returning
   `undefined` for a block.
2. **Builder and condition.** `builders/code-blocks.ts`: `codeBlocks()`, `resideInFile`,
   `resideInFolder`, `.should().parse()`, `sourceEmpty()` overridden from the fact object. Exported
   from the eess-md root; `check:family` stays green.
3. **Non-vacuity and docs.** The rows below; `docs/markdown.md` gains a "Code blocks" section with
   the two-line example, the forgery residual and a stub-parser example that is plainly a test
   double; ADR-015's sentence.

## Files Changed

- `packages/md/src/model/code-block-parse.ts` — new.
- `packages/md/src/builders/code-blocks.ts` — new.
- `packages/md/src/index.ts` — exports.
- `packages/md/tests/code-block-parse.test.ts` and fixtures under `packages/md/tests/fixtures/` — new.
- `scripts/nonvacuity/` — one fixture set and its case file; `scripts/check-nonvacuity.mjs` header
  count.
- `docs/markdown.md`, `packages/md/README.md` — the section.
- `adr/015-the-kernel-extends-resolution-never-execution.md` — one sentence.
- `.changeset/` — eess-md `minor`.

## Test inventory

- a valid corpus: every block `valid` → pass, `examined` equals the block count;
- an `invalid` verdict on a block nested in a list reports the block's own Markdown line plus the
  verdict's line;
- an `invalid` verdict with `line: null` reports the block's line and says the inner line is unknown;
- an `unrecognised` verdict carries the parser's remedy, and the message never says "syntax error";
- each instrument row in the table above → exactly one finding, `bypassFilters`, constant `ruleId`;
- two rules over one failed fact object → one finding after `dedupeConfigFindings`;
- no Markdown loaded with `.expectEmpty()` declared → still a finding;
- files loaded, no block of the language: a finding without `.expectEmpty()`, a pass with it;
- a near-miss tag is disclosed and not parsed;
- a predicate narrows; nothing can widen past the parsed set;
- the success line names the parser and its version.

## Non-vacuity rows (plan A's share of the review's table)

| row                                                                   | breaks                       |
| --------------------------------------------------------------------- | ---------------------------- |
| zero blocks without `.expectEmpty()`; no Markdown loaded              | condition 9                  |
| a parser with no identity                                             | condition 2's identity check |
| a parser that hangs; a parser that throws; a batch that drops a block | condition 5                  |
| a near-miss language tag disclosed                                    | condition 10                 |

Each row is a fixture that must red; emptying the condition or the classification must turn its row
green-when-it-should-be-red, which the gate catches.

## Out of scope

- **Any real parser.** Mermaid's is plan 0413; none for JSON or YAML ships, because none has a
  consumer.
- **Canaries against an always-`valid` stub** — plan 0413, condition 4.
- **The block in flight in a budget or exit finding** — plan 0413; a batch port cannot know it.
- **This repository's dogfood row** — plan 0413, which has the parser to run it with.
- `scripts/check-docs-code.mjs` — it type-checks TypeScript fences across files, which a per-block
  parse cannot express. Not a consumer, not migrated.
- **An async `check()`** — needs an ADR, per condition 1.

## Success

- The two-line example runs against a stub parser in eess-md's own tests and against a real parser
  in plan 0413's.
- Every row of the failure table has a test that drives the public entry points, and each
  non-vacuity row reds when its mechanism is removed.
- `npm run validate` green; `check:nonvacuity` prints the new count.

## Progress ledger

- [ ] Phase 1 — model and port, red-first
- [ ] Phase 2 — builder and condition, exported
- [ ] Phase 3 — non-vacuity rows, docs, ADR-015 sentence
- [ ] budget default chosen from measurement and recorded here
- [ ] changeset: eess-md `minor`

Deferred: none
