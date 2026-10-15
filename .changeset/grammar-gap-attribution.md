---
'@nielspeter/eess-crossvalidate': patch
---

`embeddedDiagramsMatchCode` and `tableErAgree` no longer tell an author their diagram has a syntax
error when eess-mermaid's grammar cannot read it. eess cannot yet tell a syntax error from valid
Mermaid that eess-mermaid does not model, so the finding now says it may be either. Its remedy is to
check the fence with Mermaid itself: fix it if Mermaid rejects it; if Mermaid accepts it, keep it,
report the construct to eess-mermaid, and leave the document out of the rule's corpus globs until it
is modelled. The ER finding no longer claims what "standard Mermaid ER syntax" accepts. Only the
wording changes: the same fences are reported.
