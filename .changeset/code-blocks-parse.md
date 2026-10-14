---
'@nielspeter/eess-md': minor
---

Add `parseCodeBlocks()` and `codeBlocks()`: every fenced block of one language checked with a parser
you name (plan 0412).

`parseCodeBlocks(corpus, { language, parser })` parses the language's blocks in one batch and returns
a fact object; `codeBlocks(parsed).should().parse()` is an ordinary synchronous rule over it. eess-md
loads no parser itself. A parser is `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`
and returns one `valid`, `invalid` or `unrecognised` verdict per block.

A parser that throws, runs past its budget, returns a malformed or missing verdict, or accepts one of
its own canaries is reported as one unsuppressable finding per rule, never as a pass. A parser with no
name, no version or no canaries makes `parseCodeBlocks` throw `ArchConfigError`. Additive: nothing
existing changes.
