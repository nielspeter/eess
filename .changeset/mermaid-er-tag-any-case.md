---
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-crossvalidate):** a build that was green can go red with no change of yours.

`tableErAgree` now reads an `erDiagram` in a fence tagged `Mermaid` (any letter case), as
`embeddedDiagramsMatchCode` does since bug 0423. Before, it compared the tag exactly, so such a
diagram was neither compared with its property table nor counted, and its drift passed beside any
other ER diagram (bug 0424).
