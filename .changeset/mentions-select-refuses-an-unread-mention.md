---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `mentions().select()` refuses when its predicates reach a mention it cannot read (bug 0600): one inside a raw HTML block, an HTML link, a reference-style link's text, a definition's title or an image's alt or title. It used to return the selection without it, so a `correspondence()` built on it was short and said nothing. It now throws the kernel's undecided-selection error, naming each mention's line and where it sits, as `links().select()` does for an unread HTML link. A selection that reaches none is unchanged. Migration: move the mention out of the construct the error names, or narrow the selection with a predicate that leaves it out.
