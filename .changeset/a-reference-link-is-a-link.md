---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a reference-style link is a link (bug 0558). `links()` now reads `[text][label]`, `[label][]` and `[label]` wherever the label has a definition (`[label]: url`), with the definition's URL. A label matches its definition as the CommonMark spec says, by Unicode case fold, the first matching definition used. Each such link carries `.definition` (its label and line; a new optional field on `MdLinkRef`, with a new type `MdLinkDefinition`). Every `links()` rule sees them (its selectors, its conditions, `.select()` and so any `correspondence()` built on it, and `examined`), and four change visibly:

- `.resolve()` reports a broken one once, at the definition's line, however many references use it ("… (the definition of [label])"), with at most one fix over the definition's URL. It used to pass them unread, and `examined` left them out.
- `.beLinkedBack()` counts a link back written as a reference, which it used to report as missing; and a reference-style link in a declaration now needs its own link back, like an inline one.
- `.areLabelled()` selects a declaration's reference-style links, and the declaration finding "holds reference-style links, which eess-md does not read", with its `(reference links)` element, is gone.
- `sections().haveLink()` holds for a section whose only link is reference-style, in both its selector and condition form.

A `.resolve()` or `.beLinkedBack()` finding about a reference-style link sits at its definition's line, and an exclusion comment for it goes above the definition, not the reference; every other rule reports a reference-style link at its own line, as it reports an inline one.

To migrate: a broken reference this now reports was always broken; fix the definition's URL. An `.excluding()` that sanctioned a `(reference links)` declaration finding has nothing left to match; remove it.
