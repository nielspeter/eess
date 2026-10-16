---
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-crossvalidate': none
---

`mermaidParser()`: Mermaid's own parser for eess-md's `parseCodeBlocks` (plan 0413), so a corpus
can say "every ` ```mermaid ` block parses" by the parser GitHub renders with.

```ts
const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser: mermaidParser() })
codeBlocks(parsed).should().parse().check()
```

- `mermaid` (11) and `jsdom` are new **optional** peers, loaded only inside a worker thread, so the
  host process never gets DOM globals. An adopter who never calls `mermaidParser()` installs and
  loads neither. Install: `npm i -D mermaid@11 jsdom` (about 179 MB).
- A syntax error is reported on the block's Markdown line, mapped back through frontmatter,
  directives and comments; a block with a trailing `%%` comment claims no line. A misspelt or
  plugin kind, an empty block, a block with no kind after its preamble and an unclosed directive
  are `unrecognised`, each with its own remedy.
- Frontmatter whose YAML does not parse is `invalid` on its line.
- A missing or out-of-range `mermaid`, a `package.json` with no readable version, a missing
  `jsdom` or dependency, a loader hook that loads a different `mermaid`, a worker that exits or
  hangs, and a throw that is not a syntax error are each
  one instrument finding naming its cause and how to clear it. A line canary reds when an installed
  `mermaid` stops agreeing with the line map, which is written for 11.17.2.

Additive: nothing existing changes. eess-crossvalidate gains tests only.
