---
'@nielspeter/eess-md': minor
---

New: `fields(c, { label, forms }).should().beUniqueBy(key, what)`, and the same on `terms()`, states that no two occurrences of a labelled value share `key`'s value: "no two records carry the same Id" without a hand-written reader (plan 0459's addendum, proposal 017 block 13). Each occurrence is a finding at its own line, naming the others. Values compare exactly, so normalise in `key` (`(f) => f.value.replace(/^0+(?=\d)/, '')` makes `066` and `0066` collide). A value the rule cannot read is reported on its own, never grouped.
