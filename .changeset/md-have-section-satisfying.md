---
'@nielspeter/eess-md': minor
---

`haveSection(name, { satisfying: p })` (plan 0582, proposal 026 ask A): a document has at least one section of the name that satisfies a section predicate, such as `sectionsWithCodePointer()`. It works in both phases of `docs()` and on `predicateHaveSection`, for `satisfy()`, `not()` and `inDocuments()`. As a condition, a document with no such section is `missing section "…"` as before, and one whose sections of the name all fail the predicate gets one finding, at the first of them, naming each; a pointer under another heading does not count. A section the predicate cannot judge leaves the document undecided (ADR-021): the cause is reported at its own line, unsuppressably, only where no other section decides the document, and the predicate's `test()` refuses it. Without the option, `haveSection`'s descriptions and messages are unchanged.
