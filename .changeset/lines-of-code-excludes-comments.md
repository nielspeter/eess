---
'@nielspeter/eess-ts': minor
---

`linesOfCode` counts code lines, not span lines — comments and blanks excluded (bug 0170).

**Breaking (0.x — minor signals it, not a 1.0 stability claim):** `linesOfCode`
returns substantially smaller numbers, so `maxClassLines`, `maxMethodLines`,
`maxFunctionLines`, `haveMoreLinesThan` and `haveMoreFunctionLinesThan` all
report fewer violations at the same threshold. A rule you tuned against the old
behaviour is now looser than you intended.

It was `end - start + 1`, which counts documentation as size. That made it
collide with JSDoc-coverage rules head-on: requiring a doc block on every public
method drives the same class over its line budget, so satisfying one rule broke
the other. Measured on eess's own source, **seven of nine oversized classes and
all four oversized methods were over on comment lines alone** — every one of
them passes now, and the carve-outs that fact had justified were deleted with it.

The count is now the distinct lines carrying at least one token. Comments are
trivia and so are never tokens: they drop out structurally rather than by
matching comment syntax in text, which was the original docstring's stated
reason for preferring the span. Blank lines carry no token either. A line
holding only `}` still counts — this stays a physical-source-lines metric, not
a statement count.

**Migration:** re-tune your thresholds downward. As a rough guide, on a densely
commented codebase the new number lands near a third of the old one — eess's own
`TerminalBuilder` measures 372 where it used to measure 1218. If you want the
previous behaviour for one rule, `node.getEndLineNumber() - node.getStartLineNumber() + 1`
in a custom condition reproduces it exactly.
