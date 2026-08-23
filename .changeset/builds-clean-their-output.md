---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
'@nielspeter/eess-md': patch
'@nielspeter/eess-mermaid': patch
'@nielspeter/eess-gherkin': patch
'@nielspeter/eess-crossvalidate': patch
---

Every package removes `dist/` before it builds.

`tsc -p` overwrites; it never deletes. A source file that is deleted or moved left
its `.js` and `.d.ts` behind forever, and `dist/` is gitignored, so nothing showed
it. Measured before the fix: **36 orphaned `.d.ts`** across the workspace — 34 in
`eess-ts` — the oldest from plan 0165's engine copy, whose `src/` counterparts no
longer exist.

That is shipped output, not a local artifact: `dist/` is what a consumer installs.
It also silently corrupts any measurement that reads the emitted types — a survey
of the dialects' public type surface was run against `dist/` during this work and
answered from files whose source had been deleted.

`check:integrity` now requires every package that builds to clean first. It checks
the mechanism rather than scanning for stale files: after this change there are
never any, and a check that cannot fail is worth less than no check (ADR-009). What
can still regress is a package added later with no `prebuild`, and that is what it
catches.
