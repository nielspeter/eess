---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
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

Both now print a stderr diagnostic naming the file and line. Neither is a
finding: the violation is already firing, so the build is red and the author is
looking at it.

The two are **not** symmetric, and the difference matters. The out-of-reach case
knows the directive is this rule's — it matches on id — so it can name the
region primitive as the fix. The no-id case cannot: a directive in the file may
belong to another, working rule, and from inside one rule's run there is no way
to tell. So it states the fact and leaves the id to you, rather than prescribing
one that might already be claimed.

**No behaviour changes for a directive that works.** Nothing new is suppressed or
un-suppressed, and no exit code moves. The one visible change beyond the
diagnostics is that a rule with no id now parses exclusion comments in files that
already failed — bounded the same way it always was, and the reason it can report
this at all.

A directive in a file with no violations is still never read, so a defensive
region over clean code costs nothing and is not reported.

**`@nielspeter/eess-ts` gets the same change, and that is not incidental.**
It carries its own copy of `applyFilters` (`packages/ts/src/core/execute-rule.ts`
— an independent fork, tracked by plan 0188), so a fix landing only in the kernel
would have reached `eess-md`, `eess-mermaid` and `eess-gherkin` while leaving the
dialect most people install exactly as silent as before. Review caught the first
version doing precisely that, with a changeset that said "eess now prints…" —
and found an `eess-ts` test still certifying the old behaviour. Both diagnostics
now exist in both copies, with the ts side's own test.

`orphanExclusions`'s docstring is corrected alongside: it documented this gap as
one it could not close and priced it at "a parse per file per rule". The fix came
in under that estimate, leaving the docstring claiming a gap that no longer
exists. It now says what that module still uniquely covers — a directive in a
file that produced no violation, which the enforcement path never reads.
