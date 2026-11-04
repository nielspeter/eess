---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a mention inside a readable `<a href>…</a>` is linked to the tag's target (bug 0601). `mentions()` used to report it `md/unread-mention`, cause `html-link`, though `links()` reads that `href` since plan 0580: an unsuppressable finding asking the author to rewrite a link that works. It is now linked, as text in a Markdown link is, so `beLinked()` passes it, `areLinked()` selects it, and its `link` carries the tag's URL, the `<a>`'s text and where `resolveLink` takes it. An `<a>` its paragraph never closes is still reported unread. A rule that counted those unread findings sees fewer.
