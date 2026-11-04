---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a label's letters are Unicode letters (bug 0604). `## Größe: F7` used to end a record's header, because the field-heading shape read only ASCII letters, so a `fields()` rule over `region: 'header'` silently skipped every field below it, and a value continued over lines ran on into a plain `Größe: F7` below it. Both shapes now read `\p{L}`, so a non-ASCII field heading continues the header and a non-ASCII plain label ends a value, as their ASCII twins do. A rule over a corpus written in another language can newly go red: it now judges fields it used to skip.
