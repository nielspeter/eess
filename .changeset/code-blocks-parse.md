---
'@nielspeter/eess-md': minor
---

Add `parseCodeBlocks()` and `codeBlocks()`: every fenced block of one language is checked with a
parser you name.

`parseCodeBlocks(corpus, { language, parser, budget })` parses the language's blocks in one batch and
returns a frozen fact object. `codeBlocks(parsed).should().parse()` is an ordinary synchronous rule
over it. eess-md loads no parser itself.

- **The parser.** A parser is `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`. It
  returns one `valid`, `invalid` or `unrecognised` verdict per text. Its canaries are blocks it must
  reject.
- **Failures are never a pass.** Each of these is one unsuppressable finding per rule, with the rule
  id `CODE_BLOCK_PARSER_INSTRUMENT`:
  - the parser throws;
  - it runs past its budget;
  - it returns a malformed or missing verdict;
  - it answers one of its own canaries wrongly.
- **Configuration errors throw `ArchConfigError`.** These are: a parser with no name, no version or no
  canaries, a canary that allows a pass, an empty `language`, or a budget a timer cannot hold.
- **The default budget** is `DEFAULT_CODE_BLOCK_BUDGET`: 10 s plus 250 ms a block.

Additive: nothing that exists changes.
