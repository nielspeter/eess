---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a line-1 `---` block is judged by what its own lines hold in the whole document's Markdown parse (bugs 0566, 0410, 0565). It is front matter only when it is a valid YAML mapping holding no task box and no link into the repository, as before; a reference-style link now counts when its definition sits in the body, not only in the block. A broken reference in front matter whose definition is in the body used to pass unread; it is now checked. The same rule reads `tags: [adr]` as Markdown when the body defines `[adr]` with an internal URL, so such a document shows the block as a section and its link is checked.

When the heading a `haveTitle()` finding names starts inside a block read as Markdown, the finding says why: "it is in the line-1 `---` block, read as Markdown, not as front matter, because" its YAML does not parse (the error and its line), it is not a YAML mapping, it holds no key, or it holds a task box or a link into the repository (its line). It used to name only the heading. Not yet judged: a definition in the block that a reference in the body uses (bug 0572).

To migrate: a document now reported this way holds front matter a Markdown reader would read as Markdown; fix the YAML, or move the link out of the block, or rename the body definition so the block's value is not a reference to it.
