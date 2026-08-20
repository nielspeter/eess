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

**Message and rule text changed.** A line finding now reads `Big has 120 code
lines (max: 100)` rather than `Big has 120 lines (max: 100)` — the old wording
named a number you could not find by looking at the file — and the three
conditions' `description` follows it (`have no more than 150 code lines`). If you
grep build logs for the old phrasing, update the pattern.

**Your line-metric baseline entries stop suppressing, by design.** Two mechanisms
land together here. `hashViolation` keys on `rule::subject`, and `rule` is the
condition's description, so renaming it moves the hash. Independently — and this
is the one that matters — `maxClassLines`, `maxMethodLines` and
`maxFunctionLines` now stamp `unit: 'code-lines'`, and the baseline refuses to
compare a stored measurement against a current one under a different unit
(bug 0171). An entry accepted under the old span count would otherwise have gone
on suppressing a ceiling that now means something else.

So these entries were already dead in this release before the rename; the rename
does not add a migration, it rides an existing one. Re-run your baseline. The
message is a red build, not a silent pass — the refusal fails closed.

**Cost:** the metric reads the AST rather than doing arithmetic on two line
numbers, so it is not free — but it is indexed **per source file**, so the walk
is paid once per file rather than once per call. Measured on this repo's own
source (42 classes across six packages, `node scripts/measure-class-sizes.mjs`):
a cold pass over every class costs ~170ms in total, the same pass warm costs
~0.1ms, and re-measuring an already-indexed class costs ~0.05ms.

Two consequences. Hoisting `linesOfCode` out of a loop is no longer worth
doing — the index already does it. And the first measurement of a file is the
expensive one, so a rule that measures one class in a large file pays for that
file's whole index.

**Migration:** re-tune your thresholds downward. As a rough guide, on a densely
commented codebase the new number lands near a third of the old one — eess's own
`TerminalBuilder` measures 372 where it used to measure 1218. If you want the
previous behaviour for one rule, `node.getEndLineNumber() - node.getStartLineNumber() + 1`
in a custom condition reproduces it exactly.
