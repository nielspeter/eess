---
'@nielspeter/eess-crossvalidate': none
---

Replace two raw NUL bytes with the `\0` escape sequence in
`md-gherkin.ts`'s key separator (bug 0144) — functionally identical at
runtime, ships nothing a consumer can observe. Fixes a source file that
`grep` silently treated as binary.
