---
'@nielspeter/eess-md': minor
---

New: the rest of proposal 017's blocks 3 and 14 (plan 0522). `docs().haveTitle(name?)`, dual-use, and the root condition `haveTitle`: a document's title is its first heading at the top level, which must be at depth 1 and match `name` when given (a string exactly, or a `RegExp`); a document with no heading, or whose first heading is at another depth, is a finding naming which. On `sections()`, dual-use: `haveContent()`, `haveCodeBlock({ lang? })` (the tag compared in any letter case), `haveListItem()`, `haveLink()` and `haveCodePointer()`, each read after the section's heading through its last line, subsections included. Type: `SectionCodeBlockOptions`. A live code pointer under a named section is `haveCodePointer()` beside `pointers().satisfy(inSections(…)).should().resolve()`.
