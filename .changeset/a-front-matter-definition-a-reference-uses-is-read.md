---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a line-1 `---` block holding the definition a reference uses is
read as Markdown, not as front matter (bug 0572). `[x]: ./gone.md` in the block with `See [x].` in
the body was front matter, so the body's reference was plain text and its broken target passed; it
is now examined and reported, as a reader of the whole document sees it. The definition counts when
it is the first of its label, a reference anywhere in the document uses it, and its URL is not
external. An unused definition, or an external one, leaves the block front matter. A rule over such
a document can newly go red, and a `haveTitle()` finding names the reason: "it holds the definition
at line N of a link into the repository at line M".
