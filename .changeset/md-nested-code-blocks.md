---
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': minor
---

`codeBlocks` holds every code block at any depth, a block in a list item or a blockquote included

**Breaking (@nielspeter/eess-md) — a check that missed a diagram now reads it.** Fixes
[bug 0290](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md).

`MdDocument.codeBlocks` held the document's top-level code blocks only. A `mermaid` diagram inside
a list item or a blockquote never reached `eess-crossvalidate`'s `embeddedDiagramsMatchCode` or
`tableErAgree`: a diagram naming a class the code does not have passed, and the document did not
count in `embeddedDiagramStats`.

Now `codeBlocks` lists every code block, in document order, with its fence line. A nested block's
`value` has the container's markers (`> `, the list indent) removed. If you use the md↔mermaid
bindings, you may see findings on nested diagrams you were not seeing before; they are real. If you
read `codeBlocks` yourself, expect the nested blocks too.

An illustrative diagram you put in a list now counts too. Nesting does not mark a diagram as an
example. For `tableErAgree`, an earlier `erDiagram` in the document can supply the entity match or
the line a finding is reported at, as a top-level one already could.

`@nielspeter/eess-crossvalidate` is named so its changelog records the break: its rules are where
the new findings appear. Its own code does not change.
