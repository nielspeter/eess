---
'@nielspeter/eess': minor
---

Report an exclusion comment that cannot apply, instead of leaving it silently inert

`.excluding()` patterns have warned about matching zero violations since bug 0044. Comment directives never did, so the two ways one goes inert were both
silent — the author saw the violation their sanction was supposed to cover, and
nothing else:

- **The chain declares no rule id.** A comment matches a violation by rule id, so
  `pointers(c).that().areLive().should().resolve().check()` — no `.rule()` — can
  never match one. Worse, the whole exclusion scan was gated on having an id, so
  the file was not even parsed. Found by an adopter review whose own docs had
  just recommended this exact sanction.
- **The directive is out of reach.** A single-line directive covers the _next_
  line. Inside a markdown table every cell is one physical line, so an in-cell
  directive covers the next row, never the finding beside it.

Both now print a stderr diagnostic naming the file, the line, and what to do —
the `.rule({ id: '...' })` call to add, or `eess-exclude-start`/`-end` for a
region. Neither is a finding: the violation is already firing, so the build is
red and the author is looking at it.

**No behaviour changes for a directive that works.** Nothing new is suppressed or
un-suppressed, and no exit code moves. The one visible change beyond the
diagnostics is that a rule with no id now parses exclusion comments in files that
already failed — bounded the same way it always was, and the reason it can report
this at all.

A directive in a file with no violations is still never read, so a defensive
region over clean code costs nothing and is not reported.
