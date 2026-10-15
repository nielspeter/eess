---
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-crossvalidate': minor
---

`diagramKind` reads past a `%%{init}%%` directive closed mid-line

**Breaking (@nielspeter/eess-mermaid, @nielspeter/eess-crossvalidate):** a build that was green can go
red with no change of yours. The change is in eess-mermaid, and eess-crossvalidate's selection runs on
it, so upgrading eess-mermaid alone is enough to see it.

Fixes [bug 0429](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md).
A directive line that went on after its `}%%` — `%%{init: {"theme": "dark"}}%% %% note`, or the
diagram's kind on the same line — was read as a directive still open, so `diagramKind` returned `''`.
It now closes at the first `}%%`, as Mermaid's own parser does, and reads the rest of the line.

In eess-crossvalidate, both Mermaid bindings select by `diagramKind`:

- `tableErAgree` (`./md-mermaid-er`) now selects and compares an `erDiagram` behind such a line. It
  used to skip it without a word, so a build that was green can go red on drift it now sees.
- `embeddedDiagramsMatchCode` (`./md-mermaid`) now skips a sequence or other non-class diagram behind
  such a line, instead of reading it as a class diagram and reporting it.
