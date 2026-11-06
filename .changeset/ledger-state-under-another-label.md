---
'@nielspeter/eess-md': minor
---

**Breaking:** `honestyAtClose` compares a state word written under another label in a record's header
with the state it reads. `**State:** Draft` beside `## Status: Done` (or `**Status:** Done`, or
`Status: Done` opening a line) is now `ledger/states-disagree`, naming both lines, where it passed
before: the record also said it was done, under a label the preset does not read. One that agrees
(`Done` beside `done`), a value that is no state word, and a history line continuing a list item
(`  Previously read: Ready — …`) stay quiet. A corpus that writes a second state word under another
label on purpose either aliases that label or rewords the line. (Bug 0627.)
