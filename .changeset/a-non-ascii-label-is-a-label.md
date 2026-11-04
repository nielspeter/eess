---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a label's letters are Unicode letters (bug 0604). `## Größe: F7` used to end a record's header, because the field-heading shape read only ASCII letters, so a `fields()` rule over `region: 'header'` silently skipped every field below it, and a value continued over lines ran on into a plain `Größe: F7` below it. Both shapes now read Unicode letters and their combining marks (`\p{L}`, `\p{M}`), so a non-ASCII field heading continues the header and a non-ASCII plain label ends a value, as their ASCII twins do. `honestyAtClose` reads a record's state below such a heading too, so a closed record outside its done folder, which it passed, is now `ledger/state-folder-mismatch`. A rule over a corpus written in another language can newly go red: it now judges fields it used to skip.
