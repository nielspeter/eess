---
'@nielspeter/eess-md': patch
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

A link's autofix rewrites its URL, and is applied once however many rules propose it (bugs 0563 and 0564).

- eess-md: an inline link's fix span starts where its destination does, after the `](` that closes its text. It used to be the last match of the decoded URL in the link, so a title holding the same text (`[x](./old.md "./old.md")`) got the fix and the URL stayed broken. A destination the source does not write as the parser reads it (an escape, an entity) now gets no fix rather than a guess, and an autolink (`<https://…>`) carries no URL span (`MdLink.urlStart`/`urlEnd` undefined), since no fix rewrites one.
- eess (kernel): `applyFixes` treats identical fixes (one file, one span, one replacement) as one edit, applied once. Two rules that find one broken link, such as `resolve()` and `beLinkedBack()`, used to cancel each other's fix, so `--fix --apply` skipped both. Fixes that overlap and differ are still all skipped. `ApplyResult.applied` counts distinct edits.
- eess-ts: `eess-ts check --fix --apply` applies such a fix, and reports it once.
