---
'@nielspeter/eess-md': minor
---

New: `corpusFromText(files, options?)` and its `TextCorpusOptions` (plan 0455). A test can build a corpus from a map of repo-relative path → text instead of a directory on disk. It is `corpus()` with the walk swapped out, so links and pointers resolve as they would over the same files: a pointer's line count reads the map, and why an existing file was not loaded is answered as `corpus()` answers it. `roots` defaults to every `.md` key; `frozen` keeps `corpus()`'s default.

What cannot behave as on disk is refused with an `ArchConfigError`: a waiver directive in a loaded document (the kernel reads waivers from disk, so it would not apply), a key that is not one canonical repo-relative POSIX path, a key that is also the directory of another, a key under a directory `corpus()` never walks, and a `root` that exists on disk.

Additive: `corpus()` and the `Corpus` interface are unchanged.
