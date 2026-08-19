---
'@nielspeter/eess-ts': minor
'@nielspeter/eess': minor
---

The baseline records what a measurement COUNTS, and refuses to compare across a change of unit — bug 0171.

**Read this if you hold a baseline with metric findings.** An accepted ceiling is
a number in a unit, and until now the baseline compared across a change of unit
without noticing. `linesOfCode` changing from span lines to code lines (same
release) moved every baselined size ceiling by roughly 3x while the identity hash
stayed put — so entries kept matching, kept suppressing, and a class could grow
to about three times its accepted size with the build green the whole way.

Violations now carry `measuredUnit`, baseline entries persist it, and a stored
measurement is compared only when the units demonstrably agree. When they do
not, the finding is **reported** rather than silently re-accepted, alongside a
configuration finding naming the affected elements with both numbers and telling
you to regenerate.

**What you will see on upgrade:** if you have baselined `maxClassLines`,
`maxMethodLines` or `maxFunctionLines` findings, they will be reported once,
with an explanation. That is the point — your ceilings were recorded in span
lines and this version measures code lines, so the old numbers cannot be
compared. Check each element is genuinely acceptable at its new number, then
regenerate. Baselines for `complexity`, `methods`, `parameters`, `properties`
and `named-exports` are unaffected: those metrics count what they always
counted, so old entries stay valid.

Re-accepting without reading re-baselines whatever drift the old unit was hiding.
