---
'@nielspeter/eess-md': minor
---

**Breaking:** a box's `text` is all of its own content (bug 0507): every paragraph of the list item and every sub-item that is not itself a box, with whitespace collapsed across lines. It used to be the first paragraph only, so `honestyAtClose` was green on a closed record whose `Deferred: none` contradicted a `deferred→` written on the box's second line or in a plain sub-bullet, and reported a box as undisposed when its disposition was on the second line. A nested box is still its own box; fenced code and HTML inside an item are not read. To migrate: a closed record whose deferral sits below its box now reds `ledger/deferred-none-lie` until its `Deferred:` line names it; a rule over `taskItems()` that tested `text` sees the box's other lines, joined by single spaces where they used to keep their line breaks. Measured on this repository: `check:ledger` reads the same 432 records and 190 done-items, with 0 findings, before and after.
