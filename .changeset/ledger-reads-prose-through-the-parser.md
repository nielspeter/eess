---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `honestyAtClose` reads a record's own `State:` and `Deferred:` lines
the way CommonMark reads the document, through the markdown parser its task-box pass already uses (bug
0286). An example of a State line in a code block — fenced with any run of backticks or tildes, or
indented — is no longer read as the record's own. Before, a closed record showing an example of an open
one in a four-backtick or four-tilde fence, or an indented block, was not classified done, and every
silent box on it went unreported. HTML blocks are read as before.

Two new findings report a record whose State line the parser reads as code, which would otherwise pass
with nothing checked:

- `ledger/unterminated-fence` — a fenced code block that never closes and runs to the end of the
  document, so the State line and boxes below it are code. Before, the State line after it was read but
  the boxes, code to the parser, were not, so the record passed with nothing checked. Close the fence
  where the example ends.
- `ledger/state-in-code` — a document whose header has a `State:` line only inside a code block. Four
  spaces of indent make one: a `State:` line indented that way was read before and is code now, so it is
  reported rather than silently dropped. A `State:` line in a three-backtick fence was already skipped
  before, and the document read as no item; it is reported now too. The gate cannot tell a record from a
  document that only shows the template, so a guide in the lane with a State line in a code block in its
  header reds where it was green: name it in `boardFiles`.

A green gate may report new findings: silent boxes on records the misreading hid, and the two above.
Messages of the existing findings are unchanged. `findState(text, vocabulary)` keeps its form and takes
the parsed tree as an optional third argument; it returns `null` for a State line found only in code.
