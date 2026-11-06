---
'@nielspeter/eess-md': minor
---

**Breaking:** `honestyAtClose` compares a state written under another label in a record's header with
the state it reads, and reports a disagreement as `ledger/states-disagree`, naming every such line.
`**State:** Draft` beside `## Status: Done`, `**Status:** Done` or `Status: Done` was green before
(the record also said it was done, under a label the preset does not read) and is red now. A record
in a done folder that was red as `ledger/state-folder-mismatch` can now be red as
`ledger/states-disagree` instead, at the other label's line: filters on the rule id see the move.

Only a whole value counts under another label: cleaned of markup, cut at the first `—` or `–`, a
trailing period dropped, it must be a state word. `**Phase 1:** Done (40/40 pages)`, a value that
agrees, and a plain label on a later line of a list item's paragraph (the history a record keeps in
its State bullet) stay quiet; `docs/markdown.md` lists the shapes that do. A record that writes a
second state under another label on purpose aliases that label or rewords the line. (Bug 0627.)
