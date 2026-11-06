---
'@nielspeter/eess-md': minor
---

**Breaking:** `corpusFromText` no longer refuses a waiver directive. It registers its texts with the kernel (ADR-024), so a `<!-- eess-exclude … -->` in a text corpus applies, warns and is promoted exactly as it would on disk (bug 0520). A record that holds a directive it never meant to apply can now be read from text; read one record's field with `corpusFromText` + `resolveFieldValue` (proposal 028, ask 2).

Its default `root` changes from `/__eess_text_corpus__` to `/__eess_text_corpus__/<hash>`, named by the map's content: equal maps share a root, different maps never collide. The docs have always said not to assert on `file` for a text corpus; a test that did must set `root`.

These now throw an `ArchConfigError` where they passed before: a caller-set `root` reused with other texts, a `root` that overlaps another text corpus's root (two spellings of one root included), a relative `root`, and a `root` under or above `/__eess_text_corpus__`. Leave `root` unset unless a test asserts on `file`.

`@nielspeter/eess-crossvalidate` takes eess-md as a peer and runs correspondences over its documents through the kernel; it needs the kernel that reads registered text, which its own release in this train brings (its changeset names the remedy for an older one).
