# Bug 0635: `applyFixes` cannot preview a fix in a text corpus

## Status

- **State:** Draft — read from the source 2026-11-06 by the architect review of
  [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md); no red test yet.
- **Severity:** Low — fails loudly: a fix for a text corpus's document throws `ENOENT`.
- **Origin:** self-found · the architect review of [plan 0632](../plans/0632-a-text-corpus-honours-its-waivers.md), 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

`applyFixes` reads each fixed file from disk (`packages/core/src/apply-fixes.ts:73`) before it
applies the edits, and writes it back when `write` is set. A text corpus's files are not on disk, so
a fix for one throws. A dry run (`write: false`) would be a real use there: it previews the fix a
rule proposes over text, without a fixture on disk.

## Root cause

The fixer reads only the disk.
[ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) makes the
waiver scan the registry's only reader; a second reader amends that ADR.

## Fix

Not designed. Reading a claimed file's registered text for a dry run, and refusing a write under a
claimed root, is the likely shape; it amends [ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md).

## Verification

- [ ] Red first: a dry run over a text corpus's document previews its fix.
- [ ] A write under a claimed root is refused with a reason.

Deferred: none
