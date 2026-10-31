---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a line-1 `---` block is judged as a Markdown reader would read the whole document (bugs 0566, 0410, 0565). It is front matter only when it is a valid YAML mapping holding no task box and no link into the repository, as before; a reference-style link now counts when its definition sits in the body, not only in the block. A broken reference in front matter whose definition is in the body used to pass unread; it is now checked. The same rule reads `tags: [adr]` as Markdown when the body defines `[adr]` with an internal URL, so such a document shows the block as a section and its link is checked.

When a block read as Markdown is a document's first heading, `haveTitle()`'s finding says why: "it is the line-1 `---` block, read as Markdown, not as front matter, because" its YAML does not parse (the error and its line), or it holds a task box or a link into the repository (its line). It used to name only the phantom heading's depth.

To migrate: a document now reported this way holds front matter a Markdown reader would read as Markdown; fix the YAML, or move the link out of the block, or rename the body definition so the block's value is not a reference to it.
