---
'@nielspeter/eess-crossvalidate': minor
---

The Mermaid bindings take the tag comparison from eess-md

**Breaking (@nielspeter/eess-crossvalidate) — `./md-mermaid` and `./md-mermaid-er` need eess-md
`>=0.11.0`.** `embeddedDiagramsMatchCode` and `tableErAgree` read a fence's tag with eess-md's
comparison ([ADR-019](https://github.com/nielspeter/eess/blob/main/adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md)),
which eess-md 0.11.0 adds; with an older eess-md those two entry points fail to load. What they
read is unchanged: a tag in any letter case, and no aliases (` ```mmd ` is not read as Mermaid).
`./mermaid-ts`, `./gherkin-ts`, `./md-ts` and `./md-gherkin` need nothing new.
