---
'@nielspeter/eess-md': minor
---

**Breaking:** `MdTerm` gains two required fields, `label` and `form` (plan 0468). A test or helper that builds an `MdTerm` literal stops compiling; add `label` (the label as written, without its colon) and `form` (`'pattern'` for a `terms()` element).

**Breaking:** `TermRuleBuilder`'s constructor takes a different argument. Build one with `terms()` or `fields()`; a subclass or a direct `new TermRuleBuilder(corpus, options)` stops compiling.

The shared label grammar (`honestyAtClose`, `links().areLabelled()`) now also reads a label after a numbered list marker (`1. **State:** Done`), as it read one after a bullet.

New: `fields(corpus, { label, aliases?, forms, value?, split?, region? })` reads a labelled value in the forms you name (`'bold'`, `'heading'`, `'bold-line'`, `'plain'`; no default). `resolveAgainst` now takes a `Vocabulary` or a `RegExp`, which must match the whole value; a field's finding names the value, the label and the line. A line in your rule's selection that names the label with markup it does not read is reported (with the form to add, or a rewrite), and a value that is empty after cutting is a finding; plain prose is never taken for a label. CRLF files read as LF ones. Helpers for cutting a value: `cleanValue`, `untilDelimiter`, `longestOf`. Types: `FieldForm`, `FieldOptions`.

`terms()` reads exactly what it read before.
