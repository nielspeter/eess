---
'@nielspeter/eess-md': patch
---

A finding about a reference-style link names its definition's label as the source writes it, escapes and entities kept (`(the definition of [a\*b])`, not `[a*b]`), so an author can search for it (bug 0558). `MdLinkDefinition.label` holds that form.
