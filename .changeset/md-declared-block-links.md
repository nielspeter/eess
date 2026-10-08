---
'@nielspeter/eess-md': minor
---

`links()` gains `areLabelled(label)` and `areInSection(name)`, which select the links a record
declares under a label (`**Related to:**`, in any of four label forms) or under a heading. A rule
built with either also reports a declaration it cannot read: a wrapped label or heading that misses
the declared spelling by case or spacing, and a correctly spelt label whose block holds only
reference-style links or none. `MdLink` gains the optional `block` and `sectionPath` fields. The
ledger's `State:` reader now shares the same label grammar, with no change in what it reads.
