---
'@nielspeter/eess-md': minor
---

`parseCodeBlocks` reads a code block's language tag in any letter case

**Breaking (@nielspeter/eess-md) — a block that was only disclosed is now checked, and an export is
gone.** Fixes [bug 0426](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md),
under [ADR-019](https://github.com/nielspeter/eess/blob/main/adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md).

A fence tagged ` ```Mermaid ` or ` ```MERMAID ` is now read as `mermaid`, as eess-crossvalidate
already read it. Nothing else in the tag is normalised: ` ```mmd ` is not `mermaid`, and
` ```json5 ` is not `json`. The caller's side is folded too, so `language: 'JSON'` selects
` ```json ` blocks; `ParsedCodeBlocks.language` and `summary()` keep the caller's spelling.

What changes for you:

- A block whose tag differed only in letter case used to be skipped and named in `summary()` or the
  zero-examined finding as a near miss. It is now parsed, so a green build can go red on it.
- A rule that declared `.expectEmpty()` because its corpus's only blocks were capitalised now has
  blocks, and the declaration is reported as expired. Remove it.
- `NearMissTag` and `ParsedCodeBlocks.nearMisses` are removed, with the near-miss text in
  `summary()` and in the zero-examined finding.
