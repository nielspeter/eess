---
'@nielspeter/eess-md': minor
---

**Breaking:** `MdTerm` gains two required fields, `label` and `form` (plan 0468). A test or helper that builds an `MdTerm` literal stops compiling; add `label` (the label as written, without its colon) and `form` (`'pattern'` for a `terms()` element).

New: `fields(corpus, { label, aliases?, forms, value?, split?, region? })` reads a labelled value in the forms you name (`'bold'`, `'heading'`, `'bold-line'`, `'plain'`; no default). `resolveAgainst` now takes a `Vocabulary` or a `RegExp`, which must match the whole value; a field's finding names the value, the label and the line. A label your rule's selection holds in a wrapped form it does not read is reported, not skipped. Helpers for cutting a value: `cleanValue`, `untilDelimiter`, `longestOf`. Types: `FieldForm`, `FieldOptions`.

`terms()` reads exactly what it read before.
