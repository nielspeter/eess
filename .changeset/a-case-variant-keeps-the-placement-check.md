---
'@nielspeter/eess-md': minor
---

`honestyAtClose` reads a closed state the same way in both of its checks

**Breaking — a finding that went missing now fires.** Fixes
[bug 0379](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0379-a-case-variant-across-the-vocabulary-pair-drops-the-placement-check.md).

With the same token spelled differently in the two lists — `states: ['Draft', 'done']`
beside `terminalStates: ['Done']` — the placement check read a record's `State: Done` as
`done`, compared it to `Done` case-sensitively, and treated the record as open. A closed record
left outside a done-folder lost its `ledger/state-folder-mismatch` finding; one inside a
done-folder got a false one. The box checks, which read the state against the terminal set
alone, already answered correctly, so the two halves of the preset disagreed about the same
record.

Now the state is read once, against both lists, longest token first, and compared to
`terminalStates` with case and apostrophe glyph folded — by both checks and by `ledgerStats`.
That also fixes a declared multi-word state that begins with a terminal token
(`Done pending review` beside a terminal `Done`), which the box check read as closed.

If your lists spell a token differently, you may see an orphaned-close finding you were not
seeing before; it is real. If you use a multi-word state like the one above, a record of it no
longer has its open boxes checked as a closed record's.
