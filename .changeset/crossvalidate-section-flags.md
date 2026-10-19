---
'@nielspeter/eess-crossvalidate': patch
---

`adrCitationsResolve` and `adrCitationStats` find the enforcement table in every ADR when the `section` matcher carries a `g` or `y` flag (bug 0506). The flag made the match stateful, so one `RegExp` shared across ADRs skipped every other document's table and its cited titles were never checked. The flags are now dropped where the option is read.
