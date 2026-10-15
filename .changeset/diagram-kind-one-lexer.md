---
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-crossvalidate': minor
---

`diagramKind(text)` is exported from `@nielspeter/eess-mermaid`. It returns a Mermaid diagram's declared
kind token (`erDiagram`, `graph`, `stateDiagram-v2`, …), reading past `%%` comments, `%%{init}%%`
directives and `---` frontmatter, or `''` when none is declared. It is the one lexer for that question
in the family; `eess-crossvalidate` used to keep its own copy.

`tableErAgree` (`@nielspeter/eess-crossvalidate/md-mermaid-er`) now selects an `erDiagram` by its
declared kind instead of the fence's first line. An ER diagram behind a `%%{init}%%` theme directive
or `---` frontmatter used to be skipped without a word, so its drift from the property table passed.
It is now selected, so a build that was green can go red with no change of yours. A themed diagram
with a one-line `%%{init}%%` is compared. Two known gaps: the ER parser does not yet accept a
multi-line `%%{init}%%` block or `---` frontmatter, so such a diagram is reported as not parsing
instead of being compared.

`@nielspeter/eess-crossvalidate` now requires `@nielspeter/eess-mermaid` `>=0.7.0`, the release that
adds `diagramKind`. With an older eess-mermaid, its `md-mermaid` and `md-mermaid-er` entry points
would fail to load.
