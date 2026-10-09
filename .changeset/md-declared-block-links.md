---
'@nielspeter/eess-md': minor
---

`links()` gains `areLabelled(label)` and `areInSection(name)`, which select the links a record
declares under a label or under a heading:

```ts
links(c).that().areLabelled('Related to').should().resolve().check()
```

A label is read in any of four forms (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`), after a
list marker, task box or blockquote marker. Walking out from a link through the blocks enclosing it,
the nearest label decides, so an annotated item (`bug 0402: [b](b.md)`) stays in its declaration. A rule built with either
selector also reports what it cannot read: a label or heading that misses the declared spelling by
case or spacing, a different label nested inside the declaration, the label where no block starts
(mid-paragraph, in a table cell or heading) or in a form it does not read, a declaration holding reference-style links, and a
correctly spelt label with nothing under it. Each finding names its kind in its element, so one `.excluding()` sanctions one
kind, and carries its remedy as the suggestion. `MdLink` gains the optional `block`, `blockPath`
and `sectionPath` fields; the block type `MdLinkBlock` is exported. The ledger's `State:` reader shares the same
label grammar, with no change in what it reads.
