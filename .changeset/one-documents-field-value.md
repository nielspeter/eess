---
'@nielspeter/eess-md': minor
---

New: `resolveFieldValue(doc, options)` reads one document's labelled value as `haveField` decides it (plan 0624, proposal 028's ask 1). It returns a `FieldReading`, one of: `value` (the split `values`, `line`, `label` as written, `form`, and `notes` for disagreeing prose or a label in a form not read); `absent` (with `haveField`'s message, a section region whose section the document lacks included); or `unreadable` (the causes: a conflict, an empty value, a label only in a form not read, code, a value outside the region). Only `value` carries a value. It is not a rule, so a waiver comment does not apply. An empty label, `forms: []`, a malformed region or a `oneOf` is an `ArchConfigError`. `haveField`'s own output is unchanged, pinned by a golden table of its decisions. The docs gain a "which reader" table beside it: `fields()`, `predicateHaveField`, `findState` and `resolveFieldValue`.
