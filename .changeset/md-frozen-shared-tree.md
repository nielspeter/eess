---
'@nielspeter/eess-md': minor
---

**Breaking:** a document's `root` is now the parsed tree shared by every document of the same text, deep-frozen. Writing to it throws `TypeError`. Before, each document got its own mutable copy. Copying every tree was the largest part of eess-md's own time in a corpus check: dropping it cuts a `check:ledger`-style run of three corpora over the same files by about 22%, and a single corpus check by about 6% (bug 0657). To change a tree, copy it first: `structuredClone(doc.root)`.
