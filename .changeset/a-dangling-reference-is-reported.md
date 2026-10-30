---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a reference-style link whose definition is missing is reported (bug 0558). `[text][gone]` and `[gone][]` with no `[gone]: url` (a definition deleted or renamed) are text to the parser, so no rule saw them, and GitHub shows the brackets. `links()` now reads them from the source as links with no destination (`url` `''`, and a new optional field `.undefinedReference` naming the label), and `.resolve()` and `.beLinkedBack()` report "the reference [gone] has no definition, so it is not a link", at the reference's line, with the remedies: add the definition, write an inline link, or put the text in a code span if it is not a link. A shortcut `[label]` is never read this way (`[WIP]`, a task box and `> [!NOTE]` share its shape), nor is text in code, a link, an image or HTML. Every `links()` rule sees these elements and counts them in `examined`.

A finding about a reference-style link names its definition's label as the source writes it, escapes kept (`[a\*b]`, not `[a*b]`); `MdLinkDefinition.label` holds that form.

To migrate: a reference this now reports was never a link; restore its definition or fix the label. Prose of the full shape that is not a link (`matrix[i][j]`) goes in a code span.
