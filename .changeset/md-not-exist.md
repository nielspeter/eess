---
'@nielspeter/eess-md': minor
---

**Breaking:** a corpus that loaded no document is now an empty source (plan 0456). A rule over it reports "this rule's source loaded zero units", which `.expectEmpty()` cannot declare away, and an absence rule over it no longer passes. `honestyAtClose` over such a corpus reports it once, even with `expectEmptyHeaders`. To migrate: if a rule over a corpus that loads nothing relied on `.expectEmpty()`, fix the corpus's `roots`. A `honestyAtClose` lane whose roots match no file now fails; create the folder with its board file, or remove the lane.

New: `.should().notExist()` on `docs()`, `links()`, `pointers()`, `rows()`, `terms()`, `taskItems()` and `codeBlocks()`. Each selected element is a finding at its own line. On `docs()` and `terms()`, an absence rule whose folder or file glob is broken is reported, naming the call (on `codeBlocks()`, for the glob's text only; on the other builders, only for a predicate that declares its glob): a glob that can never match a path relative to the corpus's `cwd` (a leading `/`, a `../`, a `./` after the first segment), a glob naming Markdown the corpus did not load (outside its `roots`, or `ignore`d), or a `\` written as a path separator. A glob naming nothing in the repository stays green, since that is also what a holding ratchet looks like.

New on the root: `resideInFolder`, `resideInFile` and `haveNameMatching` as predicates for `satisfy()`, `and` and `or` beside `not`, `globNode`, and the `GlobNode` and `GlobSite` types. eess-md's `resideInFolder('guides/**')` is relative to the corpus's `cwd`; eess-ts's predicates of the same names match absolute paths.

Plan 0454 ships a second eess-md break (undeclared box marks). If both land in one release, read both.
