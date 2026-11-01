---
'@nielspeter/eess-md': patch
---

A local link with a query string resolves to its file (bug 0583). `./logo.png?raw=true` and `./a.md?plain=1` were reported as broken links beside `logo.png` and `a.md`, because the resolver cut a URL at `#` only. A URL's path now ends at its first `?` or `#`, as GitHub reads it; a URL that is only a query names the document itself, as a pure `#anchor` does; and a moved target's fix keeps the query and the fragment. A `?` that is part of a file name is written `%3F` and still resolves.
