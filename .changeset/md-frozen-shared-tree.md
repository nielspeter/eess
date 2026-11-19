---
'@nielspeter/eess-md': minor
---

**Breaking:** a document's `root` is now read-only. It is the parsed tree, deep-frozen, and documents of the same text may share it. Before, each document got its own mutable copy.

- A write to `doc.root`, including an mdast utility that transforms a tree in place (`mdast-util-find-and-replace`, removing nodes during `unist-util-visit`, setting `node.data`), throws a `TypeError` such as `Cannot add property data, object is not extensible` (in strict-mode code; sloppy-mode code loses the write silently). Reading it, `mdast-util-to-string`, `mdast-util-to-markdown` and `mdast-util-to-hast` work as before. To transform a tree, copy it first: `structuredClone(doc.root)`.
- Two documents of the same text may now share one `root` object, and may not: the sharing ends when the parse cache drops the tree. Key a per-document cache by the document, never by its `root`.
- Code that only reads documents is unaffected and gets faster: copying every tree was the largest part of eess-md's own time. Building several corpora over the same files is about 21% faster; a single corpus about 6% (bug 0657).
