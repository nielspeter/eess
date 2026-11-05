---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** an indented line that looks like a heading no longer ends a field header (bug 0622). `fields(c, { …, region: 'header' })` ended the header at the first line like `## Notes`, including one indented by four spaces or a tab, which CommonMark reads as code or as a paragraph's continuation, never a heading. A value rule over the header then passed without judging the field below it, while `haveField` read that field as present in the header. A heading now ends the header only with at most three spaces before its `#`, as CommonMark reads one, so a header value rule can newly report a value it skipped. To migrate: a finding this reports was a value never checked; correct it, or move the indented line.
