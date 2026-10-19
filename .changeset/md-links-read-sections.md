---
'@nielspeter/eess-md': minor
---

**Breaking:** `links().areInSection()` reads the sections every other reader reads (bug 0502). A heading inside a list item or a blockquote used to enter a link's section path, replacing the real headings at its depth for the rest of the document: a link under `### Sub` that came after `- ## Listed` was not selected by `areInSection('Sub')` (a rule green on a link it never examined), and was selected by `areInSection('Listed')`. Now a link's `sectionPath` is the sections that contain its line, as a table's is, and a heading in a container scopes no link, inside its container or after it. A rule that names such a heading reports it (`the heading "Listed" at line 7 is inside a list item, which does not start a section`). To migrate: a rule that relied on a heading inside a list or blockquote to scope links moves the heading to the top level; a rule over a real section may now examine, and report, links it used to drop.
