---
'@nielspeter/eess-md': minor
---

`links()` gains `areLabelled(label)` and `areInSection(name)`, which select the links a record
declares under a label or under a heading:

```ts
links(c).that().areLabelled('Related to').should().resolve().check()
```

A label is read in any of four forms (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`), after a
list marker, task box or blockquote marker, and nested under another labelled line. A rule built
with either selector also reports what it cannot read: a label or heading that misses the declared
spelling by case or spacing, a label inside a paragraph rather than at its start, a declaration
holding reference-style links, and a correctly spelt label with no link. `MdLink` gains the optional
`block` (type `MdLinkBlock`, now exported) and `sectionPath` fields. The ledger's `State:` reader
shares the same label grammar, with no change in what it reads.
