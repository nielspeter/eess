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

**Message text changed.** A line finding now reads `Big has 120 code lines
(max: 100)` rather than `Big has 120 lines (max: 100)` — the old wording named a
number you could not find by looking at the file. This does not move any
baseline: metric findings carry an explicit `identity`, and the hash is taken
over that, not over the message. If you grep build logs for the old phrasing,
update the pattern.

**Cost:** the metric reads the AST rather than doing arithmetic on two line
numbers, so it is not free — measured at roughly 0.3ms per class or method, and
no measurable change to a full gate run on a ~680-file repo. If you call
`linesOfCode` yourself in a tight loop over a very large corpus, it is now worth
hoisting out of the loop.

**Migration:** re-tune your thresholds downward. As a rough guide, on a densely
commented codebase the new number lands near a third of the old one — eess's own
`TerminalBuilder` measures 372 where it used to measure 1218. If you want the
previous behaviour for one rule, `node.getEndLineNumber() - node.getStartLineNumber() + 1`
in a custom condition reproduces it exactly.
