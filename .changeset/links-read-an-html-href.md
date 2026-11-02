---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `links()` reads an `href` in raw HTML (plan 0580, Phase 2). Every
`<a>` and `<area>` with an `href`, in an HTML block or inline, any letter case and any quoting, is a
link at the line its `href` sits on, its value decoded: `.resolve()` checks it, `.beLinkedBack()`
counts it, `sections().haveLink()` sees it, and `examined` counts it. It is read as GitHub renders it;
`:href`, `v-bind:href`, `data-href` and `xlink:href` are not read. A broken one was green before and
is now red. To migrate: fix the target, or the `href`. Also new: its `.text` is the text a reader sees
in the element; an inline `href` is declared by `areLabelled()` and `areInSection()` as an inline link
is, so a label whose only link is an `href` now declares it; and an `<a>` inside a Markdown link's
text is a second link.

An HTML link eess-md cannot read is now reported as `md/unread-link` (exported as `UNREAD_LINK`),
which `.excluding()`, `.warn()` and a baseline cannot hide, wherever the rule's predicates reach it: a
tag a blank line cuts inside its block (remove the blank lines), a tag that never closes in its block
(close it), and an `<a>` the Markdown parser reads as text because an unquoted value holds a `/`
(quote it). `.select()` on a `links()` rule that reaches one refuses, as a configuration error naming
the site, rather than hand it to `correspondence()` without it.

`sections().haveLink()` and `.beLinkedBack()` still read a section or a target whose only link is
unread as having none; Phase 3 makes that undecided.
