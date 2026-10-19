---
'@nielspeter/eess': minor
---

New on `@nielspeter/eess/internal` for dialect authors: `uniqueByCondition` and its options type `UniqueByOptions` (plan 0459, proposal 017 block 13). It is the one condition behind a dialect's `beUniqueBy`: no two selected elements share a key. Every member of a group is a finding at its own place through the dialect's own violation constructor, naming the others (at most ten, then "and N more"), so excluding one member cannot hide the group. Keys compare exactly; normalising is the caller's. It is not satisfied by an empty selection: zero elements is the kernel's zero-examined finding. No root export changes.
