# Bug 0650: a text corpus reads a code file from the caller's live map

## Status

- **State:** Draft — found 2026-11-10 by the architect lens at the build review of
  [plan 0648](../plans/completed/0648-md-a-code-reference-still-appears-in-its-file.md); no change yet.
- **Severity:** Low — no false green measured. A rule over a corpus built by `corpusFromText` can
  read a code file as the caller changed it after the corpus was built, while every document it
  judges is as it was built.
- **Origin:** self-found · [plan 0648](../plans/completed/0648-md-a-code-reference-still-appears-in-its-file.md)'s
  build review, 2026-11-10.
- **Reported:** 2026-11-10

## Symptom

`corpusFromText(files)` parses each document when it is built, and registers a copy of `files` with
the kernel for waivers ([ADR-024](../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)),
but reads every other file through `files[rel]` on the caller's own object
(`packages/md/src/corpus.ts:252`). A caller that changes the map after building the corpus changes
what a rule reads from a code file, and nothing else.

[Plan 0648](../plans/completed/0648-md-a-code-reference-still-appears-in-its-file.md)'s `citedPaths` caches each file's text per corpus, so within one corpus the first read now
wins; before it, each `pointers().resolve()` rule re-read the map. The cache narrows the gap and
does not close it: a read before the change and one after can still disagree across modes.

## Fix

Not designed. Reading from a copy taken when the corpus is built, as the kernel's registry does,
would make every read agree with the documents.

## Verification

- [ ] Red first: a corpus built from a map, the map's code file changed afterwards, a pointer rule
      still reads the code file as it was when the corpus was built.
