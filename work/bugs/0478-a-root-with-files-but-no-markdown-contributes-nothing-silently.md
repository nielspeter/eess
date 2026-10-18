# Bug 0478: a corpus root with files but no Markdown contributes nothing, and nothing says so

## Status

- **State:** Draft — recorded 2026-10-18 from PR #237's review (method, architect), the residual of
  bugs 0465 and 0475.
- **Severity:** Low — a silent pass on a rare shape: a Markdown root mistyped so that it matches only
  other files. Code-glob roots, the common case, contribute nothing on purpose.
- **Origin:** self-found · PR #237's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`corpus({ roots: ['docs/**', 'adr/*.txt'] })` loads `docs/` and nothing from the second root, and
nothing says so. Bug 0465 refuses a root that matches no file; this one matches files, so it is not
refused. Bug 0475 made it declarable (`expectEmptyRoots`), but nothing prompts its author to declare
it. Refusing it outright broke existing callers, which list code globs as roots beside their
documents.

## Fix

Not designed. One candidate: report a root that matches only non-Markdown files as a warning-free
finding unless declared, with a migration line for callers that list code globs. Measure the three
adopters' root lists first, as bug 0475's spike did.

## Verification

- [ ] A design decided, against the adopters' root lists
- [ ] Red first, then green

Deferred: none
