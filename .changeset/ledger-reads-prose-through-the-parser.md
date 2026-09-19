---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `honestyAtClose` reads a record's own `State:` and `Deferred:` lines
the way CommonMark reads the document, through the markdown parser its task-box pass already uses (bug
0286). An example of a State line in a code block — fenced with any run of backticks or tildes, or
indented — is no longer read as the record's own. Before, a closed record showing an example of an open
one in a four-backtick or four-tilde fence, or an indented block, was not classified done, and every
silent box on it went unreported. HTML blocks are read as before.

Two new findings report a record the parser cannot read, where before it passed with nothing checked:

- `ledger/unterminated-fence` — a fenced code block that never closes and runs to the end of the
  document, so the State line and boxes below it are code. Close the fence where the example ends.
- `ledger/state-in-code` — a record whose only `State:` line in the header is inside a code block. Four
  spaces of indent make one: a `State:` line indented that way was read before and is code now, so it is
  reported rather than silently dropped. Remove the indent.

A green gate may report new findings: silent boxes on records the misreading hid, and the two above.
Messages of the existing findings are unchanged. `findState(text, vocabulary)` keeps its form and takes
the parsed tree as an optional third argument; it returns `null` for a State line found only in code.
