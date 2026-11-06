# Bug 0634: eess-ts reads no waiver in an in-memory file

## Status

- **State:** Draft — read from the source 2026-11-06 by the architect review of
  [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md); no red test yet.
- **Severity:** Low — fails closed: the waived finding stays red. But nothing says why, so the author
  of a test over an in-memory ts-morph project cannot waive a finding.
- **Origin:** self-found · the architect review of [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md), 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

eess-ts has its own copy of the waiver scan in `applyFilters`
(`packages/ts/src/core/execute-rule.ts:280`). It returns no directives for a path that is not on
disk, deliberately, so an in-memory project raises no warning per file. A waiver directive written in
an in-memory file therefore never applies.

## Root cause

The text of an in-memory file is in the ts-morph project, not on disk, and the scan reads only the
disk. It is the same defect as [bug 0520](./0520-waivers-in-a-text-corpus-are-refused.md)'s, on
eess-ts's path, which
[ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) leaves out
of its scope.

## Fix

Not designed. eess-ts holds the text in its project; whether it reads it there, or registers it as
[ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)'s kernel registry does for eess-md, is the design.

## Verification

- [ ] Red first: a waiver in an in-memory file waives its finding.
- [ ] A changeset naming `@nielspeter/eess-ts`.

Deferred: none
