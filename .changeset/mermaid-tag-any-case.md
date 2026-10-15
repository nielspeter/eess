---
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess-crossvalidate):** a build that was green can go red with no change of yours.

`embeddedDiagramsMatchCode` now reads a fence tagged `Mermaid` (any letter case) like one tagged
`mermaid`. Before, it compared the tag exactly, so a diagram in a ` ```Mermaid ` fence was neither
compared with the code nor counted, and its drift passed in any corpus that held another class diagram
(bug 0423). Such diagrams are now checked, so a build that was green can go red with no change of
yours. `tableErAgree` still has the exact comparison; that is bug 0424.
