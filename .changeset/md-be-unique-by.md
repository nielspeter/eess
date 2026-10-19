---
'@nielspeter/eess-md': minor
---

New: `docs(c).should().beUniqueBy(key, what)` states that no two selected documents share `key`'s value, such as a record's number or a page's slug (plan 0459, proposal 017 block 13). Every document of a group is a finding at its line 1, named by its path and naming the others. Values compare exactly (`066` and `0066` differ): normalise in `key`, and select away a document without a value with `.that()` first.
