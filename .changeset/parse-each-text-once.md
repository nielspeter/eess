---
'@nielspeter/eess-md': patch
---

A text is parsed once per process (bug 0547). A second `corpus()` over the same files, and `findState` called without its tree, reused nothing and parsed every document again; this repository's `check:ledger` parsed 1,946 times for 502 texts and now parses 505 times, in 5.1 s instead of 12.5 s. Nothing you can observe changes: every document still gets its own tree, which you may edit without touching another document's. The memo holds up to 2^24 characters of text, least recently used dropped first, and is cleared with the kernel's other caches.
