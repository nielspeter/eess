---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `honestyAtClose` reads a record's own `State:` and `Deferred:` lines
the way CommonMark reads the document, through the markdown parser its task-box pass already uses (bug
0286). An example of a State line in a code block — fenced with any run of backticks or tildes, or
indented — or in an HTML block is no longer read as the record's own. Before, a closed record showing an
example of an open one, in a four-backtick fence, an indented block, a `<pre>` or an HTML comment, was not
classified done, and every silent box on it went unreported.

A new finding, `ledger/unterminated-fence`, reports a fenced code block that never closes and runs to the
end of the document. By CommonMark everything after it is code, so the record's State line and boxes
below it cannot be read; before, such a record passed with nothing checked. Close the fence.

A green gate may report new findings: silent boxes on records the misreading hid, and unclosed fences.
Messages of the existing findings are unchanged. `findState(text, vocabulary)` keeps its form and takes
the parsed tree as an optional third argument.
