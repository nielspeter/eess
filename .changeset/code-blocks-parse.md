---
'@nielspeter/eess-md': minor
---

Add `parseCodeBlocks()` and `codeBlocks()`: every fenced block of one language is checked with a
parser you name.

`parseCodeBlocks(corpus, { language, parser, budget })` parses the language's blocks in one batch and
returns a frozen `ParsedCodeBlocks`. `codeBlocks(parsed)` returns a `CodeBlockRuleBuilder`, and its
`.should().parse()` is an ordinary synchronous rule over what was parsed. `.that()` narrows it with
`resideInFile` or `resideInFolder`. eess-md loads no parser itself.

- **The port.** A `CodeBlockParser` is `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`.
  It returns one `CodeBlockVerdict` per text, `valid`, `invalid` or `unrecognised`, synchronously or
  as a promise. Its `CodeBlockCanary` entries are blocks it must reject.
- **Failures are never a pass.** Each of these is one unsuppressable finding per rule, with the rule
  id `CODE_BLOCK_PARSER_INSTRUMENT`:
  - the parser throws;
  - it runs past its `CodeBlockBudget`;
  - it returns a malformed or missing verdict;
  - it answers one of its own canaries wrongly.
- **Configuration errors throw `ArchConfigError`:**
  - a parser with no name, no version or no canaries;
  - a canary that allows a pass;
  - an empty `language`;
  - a budget a timer cannot hold.
- **`summary()`** gives "N json blocks parsed with …". After a failure it gives "0 of N … checked"
  with the cause. A tag that matches only when case-folded (`Json` for `json`) is not read. It is
  named there, and in the zero-examined finding when it is why nothing was examined.
- **The default budget** is `DEFAULT_CODE_BLOCK_BUDGET`: 10 s plus 250 ms a block.
- **Also exported:** the types `ParseCodeBlocksOptions`, `ParsedCodeBlock`,
  `CodeBlockInstrumentFailure` and `NearMissTag`.

Additive: nothing that exists changes.
