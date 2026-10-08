---
'@nielspeter/eess-md': minor
---

`resolveLink(link, corpus, options?)` is exported: the one resolver `links().resolve()` uses, so a custom rule over links can ask where a link points without re-implementing resolution. It returns a named case — `document`, `not-in-corpus` (with every reason: `not-markdown`, `ignored`, `outside-roots`), `directory`, `missing` (with every candidate tried), `self` or `external` — and never throws. `.resolve()` behaves as before, except that a link with malformed percent-encoding is now reported as broken instead of aborting the run. Plan 0404.
