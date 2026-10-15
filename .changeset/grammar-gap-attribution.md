---
'@nielspeter/eess-crossvalidate': patch
---

`embeddedDiagramsMatchCode` and `tableErAgree` no longer tell an author their diagram has a syntax
error when eess-mermaid's grammar cannot read it. eess cannot yet tell a syntax error from valid
Mermaid that eess-mermaid does not model, so the finding now says it may be either.

Its fix line is to check the fence in the Mermaid Live Editor; fix it if Mermaid reports a parse error;
if Mermaid accepts it, keep it and report the construct to eess. The finding stays until eess-mermaid
models the construct, and no `eess-exclude` comment silences it yet. To be green meanwhile, move only
that fence into its own document and leave that document out, so the other diagrams are still checked.
A `classDiagram-v2` fence is told to change its header to `classDiagram`. The ER finding now has a fix
line; before, its remedy printed as its reason.

Only the wording changes, and the same fences are reported. Rule ids are unchanged, so a test that
asserts on these findings should match `ruleId` (`crossval/embedded-diagram`,
`crossval/table-er-agree`), not the message text.
