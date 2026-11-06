# Bug 0633: a correspondence reports a document by its relative path, so its waivers are read from the working directory

## Status

- **State:** Draft — measured 2026-11-06 by the enforcement review of
  [ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) against
  `packages/*/dist` (v0.19.0); no red test yet.
- **Severity:** Medium — a false green is possible today: a real file in the working directory can
  waive a finding about a document that is not that file.
- **Origin:** self-found · the enforcement review of [ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md), 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

eess-crossvalidate's `adrCitationsResolve` identifies an ADR's citation with `file: c.adr`, the
document's `relPath` (`packages/crossvalidate/src/md-ts.ts:182`), and so does this repository's own
`spec.rules.ts`. The kernel reads a violating file's waivers by that path
(`packages/core/src/execute-rule.ts:150`). A relative path resolves against the process's working
directory, not the corpus's root.

Measured: a document in a text corpus with no directive, a `correspondence()` that identifies it by
`relPath`, and a real `doc.md` holding a waiver in the working directory. The violation is waived by
the real file. The same check identifying by `doc.file` keeps the violation.

`docs/markdown.md` teaches the same identity in three correspondence recipes (`docs/markdown.md:1347`, `:1981`, `:1993`), so adopters copy it.

Over a disk corpus run from its own root, the relative path happens to name the right file; run from
anywhere else, it names another file or none.

## Root cause

A binding reports a document's repo-relative path where the kernel needs the path it reads.

## Fix

Not designed. Report `doc.file` (the absolute path every md document carries) and keep `relPath`
for the name a reader sees, as `md-mermaid.ts:128` does. Whether the kernel should refuse a relative
violating path outright is part of the design.

## Verification

- [ ] Red first: the measured case, through `adrCitationsResolve`, waives nothing.
- [ ] The three `docs/markdown.md` recipes identify by `doc.file`.
- [ ] A changeset naming `@nielspeter/eess-crossvalidate`.

Deferred: none
