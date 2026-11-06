# ADR-024: A claimed file's waivers are read from its registered text, never the disk

- **Status:** Proposed (2026-11-06) — written as Phase 0 of
  [plan 0632](../work/plans/0632-a-text-corpus-honours-its-waivers.md). Its design was reviewed five
  times: an architect and an enforcement review, a re-check by each, and a check of the decision
  alone. This text was then reviewed as a decision (architect, enforcement, method) and revised from
  that review. It becomes Accepted when that revision passes, before any code is written.
- **Extends:** [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)
- **Context:** [bug 0520](../work/bugs/0520-waivers-in-a-text-corpus-are-refused.md),
  [proposal 028](../work/proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md) ask 2
- **Supersedes nothing.**

## The question

A waiver directive (`eess-exclude`) is read from the violating file. The kernel reads that file from
disk: `fs.readFileSync(filePath)` in `applyFilters` (`packages/core/src/execute-rule.ts:150`).
[ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md) decided how the text is masked, not
where it comes from. A dialect whose files are not on disk, such as eess-md's `corpusFromText`,
cannot hand the kernel its text. So today it refuses any document holding a directive
(`packages/md/src/corpus.ts:330`). Otherwise the waiver would silently not apply: the disk read
fails, and the `catch` at `packages/core/src/execute-rule.ts:171-177` returns no directives.

Where does the kernel read a violating file's waivers when the file is not on disk?

## Decision

1. **A dialect registers the texts of a root it claims.** The kernel takes
   `registerSourceText(root, files)` on `@nielspeter/eess/internal`, where `files` maps a path
   relative to `root` to its text. It is a value, as every seam the kernel takes is; what is new is
   that it is ambient (point 6).
2. **The kernel copies the texts and owns the read.**
   - It copies `files` into a `Map` when it registers.
   - It refuses a value that is not a string, and a key that is not a canonical relative POSIX path
     (empty, absolute, with `..`, `./` or `\`, or not normalised).
   - A caller who changes its map afterwards cannot change the text a waiver is read from. That
     protects against the caller. It does not protect against code that writes the shared object
     (point 9).
   - No dialect code runs inside the `try` that swallows a read failure.
3. **One normalisation selects a root and a key; the text is parsed under the violation's own
   `file`.**
   - Roots and violating paths are normalised one way: separators become POSIX, then
     `posix.normalize` collapses `//`, `.` and `..`, then a trailing slash is dropped.
   - A root must be absolute before conversion, by `path.win32.isAbsolute` or
     `path.posix.isAbsolute`; a relative root is refused.
   - The normalised form only finds the root and the key. The text is parsed under the violation's
     own `file` as reported, because a directive applies to a violation whose `file` equals its own
     (`packages/core/src/exclusion-comments.ts:497`).
4. **Registering refuses what would make a path ambiguous,** each with an `ArchConfigError` in the
   kernel's own words, naming the root and the root it collides with. A dialect may catch it and add
   its remedy; eess-md does.
   - It refuses a root that exists on disk.
   - It refuses a root equal to, containing, or contained by a registered root, compared by whole
     path segments (`/t/1` does not contain `/t/10`).
   - The one exception is the same root with an exactly equal map: the same keys, each with the same
     text. A subset or a superset is different.

   A root names one text per path for the realm, as long as it lives. These refusals guard against an
   accident. They do not guard against a forgery (point 9).

5. **The lookup is decided outside the swallowing `try`.** A violating file is matched against the
   registry by its normalised path.
   - **A real file wins.** A violating path that exists on disk as reported is read from disk, whatever
     the registry says.
   - **A claimed path that is not on disk is read only from its root's texts.**
   - **A claimed path the texts do not hold is a finding.** It is unsuppressable (`bypassFilters`, so
     an error even under `.warn()`), and it carries the rule's id when the rule has one. It names the
     file and the root, and gives the cause: the rule reported a path its corpus does not hold, or
     spelled one differently. The remedy is to report the document's `file`, or add the file to the
     map. The violation itself stays, unwaived. There is one finding per rule and file.
   - **A claimed root that now exists on disk is the same kind of finding,** naming the root as
     created after it was claimed. Neither source is read for it.
   - **A path under no claimed root is read from disk,** as before.
   - **A relative violating path is under no claimed root.** It is read from disk relative to the
     working directory, as before (the residual below).
6. **The registry is shared, strong, and per realm.**
   - It lives on one versioned object on `globalThis` under a `Symbol.for` key. Every kernel copy
     from this decision on, in one realm, reads the same texts. A worker thread or a `vm` context has
     its own `globalThis`, and so its own registry.
   - Each copy reads that object as `unknown`, through a type guard. A shape it does not know refuses
     a registration. At lookup it makes every violating path a finding, because the kernel can no
     longer tell a claimed path from an unclaimed one. A path under two roots in it is a finding,
     never a pick.
   - A change to the shape is a break: every install that mixes a kernel on the old shape with one on
     the new then refuses or reports.
   - Entries are never released. The bound is one entry per distinct root and map for the life of the
     realm.
7. **The registered text is parsed as text from disk is.** It goes through `parseExclusionComments`
   with the same masking, so a waiver behaves as on disk, whether it is valid, undocumented, unused
   or malformed. Parity, not a new guarantee: where
   [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown masking reads a directive
   inside a `<div>`, a `<pre>` or a fenced block in a blockquote
   ([bug 0291](../work/bugs/0291-the-markdown-masker-honours-a-directive-inside-code.md)), it does
   so here too.
8. **The registry's one reader is the waiver scan in the kernel's `applyFilters`.**
   - Any other reader amends this ADR: `applyFixes` (`packages/core/src/apply-fixes.ts:73`), which
     still reads and writes the disk
     ([bug 0635](../work/bugs/0635-apply-fixes-cannot-preview-a-fix-in-a-text-corpus.md)), and eess-ts's
     own `applyFilters` (`packages/ts/src/core/execute-rule.ts:280`), which reads no in-memory file
     ([bug 0634](../work/bugs/0634-eess-ts-reads-no-waiver-in-an-in-memory-file.md)).
   - Two crossvalidate bindings likely call no `applyFilters`
     ([bug 0422](../work/bugs/0422-a-waiver-does-not-silence-an-md-mermaid-finding.md)).
   - No md violation reaches either of these readers today.
9. **The trust boundary is the disk, not the registry.** The registry is on `globalThis` so that kernel
   copies can share it, which also means any code in the realm can write it, past every refusal in
   point 4. What keeps a forged entry from waiving a real finding is point 5: registered text stands
   in only for a file that does not exist on disk as reported. A forged root that is on disk is a
   finding, and so is a root that is created after it is claimed.

## Why this, and not the alternatives

- **A reader on the rule's context, set by the dialect's builders.** Rejected because a rule built
  outside eess-md's builders never sets it. A crossvalidate correspondence, or the kernel's
  `correspondence()` over md elements, reaches `applyFilters` through the kernel's terminal with a
  bare path string (`packages/core/src/correspondence.ts:67-76`), and its waivers would silently not
  apply. Keying by path covers every kernel terminal that reports an absolute path.
- **The text carried on the element or the violation.** Rejected for the same reason: a binding that
  builds its violation from a path string has no element to carry it. It would also put every
  document's text into each JSON report.
- **`corpusFromText` writing its texts to a real temporary directory.** It would need no kernel change
  and would cover every reader, eess-ts and `applyFixes` included. Rejected because:
  - a read API would write to disk, and fail on a read-only host;
  - `file` would depend on the temporary path;
  - the directory needs cleaning up, and can be edited between writing and reading;
  - it is the fixture-on-disk pattern
    [plan 0455](../work/plans/completed/0455-a-corpus-built-from-text.md) replaced.
- **A registered reader function.** Rejected after review: a function cannot be listed or compared.
  So the kernel could not tell whether a second registration of a root holds the same text. It would
  either refuse equal maps (by identity) or read one corpus's waivers from another's text (accepting
  any re-registration). A function also runs dialect code inside the swallowing `try`.
- **A `WeakRef` to the registering corpus.** Rejected after review, which measured a text corpus
  being collected while its documents still reached a rule: `ParsedCodeBlocks` keeps documents, not
  the corpus (`packages/md/src/model/code-block-parse.ts:95-107`). Whether a waiver applied would
  then depend on garbage collection.
- **The longest matching root prefix, falling back to the disk.** Rejected after review:
  - two overlapping roots name one file twice, so a waiver is read from the other corpus's text, a
    false green;
  - a string prefix crosses segment boundaries;
  - the fallback reads nothing from a root that is not on disk, and says nothing.
- **A second waiver reader inside eess-md.** Rejected by
  [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md): one parser, in the kernel.

## Its relation to [ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md)

[ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md) has the kernel take the fact a dialect
materialises, never a project. A path-keyed map of texts is that kind of fact. What departs from every
seam so far (`PathUniverse`, `DiskSet`, `sourceEmpty`,
[ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s `mask`) is that the fact is
**ambient**: registered once and looked up by path, not passed with the rule. That is the price of
covering terminals the dialect does not build. The other way to avoid ambient state is the temporary
directory above, and it was rejected for the reasons listed there.

## Consequences

- `corpusFromText` registers its map and stops refusing waivers. Its default root is named by a hash
  of its content, so equal maps share a root and different maps get sibling roots.
- These now throw where they passed before, a break in eess-md: a caller-set root reused with other
  text, an overlapping root (including two spellings of one), a relative root, and a root under the
  reserved `/__eess_text_corpus__` prefix.
- **The residual: a violation reported by a relative path.** It is under no claimed root, so its
  waivers are read relative to the working directory. A text corpus's directive does not apply to
  it, which is a false red. A real file of that name in the working directory can waive it, which is
  a false green, and exists today
  ([bug 0633](../work/bugs/0633-a-correspondence-reports-a-document-by-its-relative-path.md)). The
  remedy is to identify a document by its `file`.
- **The residual: a kernel copy older than this decision.** It has no registry. eess-crossvalidate
  allows eess-md `>=0.14.0` as a peer, and an adopter may depend on the kernel directly. So an install
  can hold an eess-md that registers beside a kernel copy that reads only the disk. A correspondence
  run on that copy reads a text corpus's file from disk and finds nothing. The waived violation stays
  red with nothing explaining it: a false red, never a false green. The remedy is to upgrade the
  package that brings the older kernel.
- A long-running realm that builds many distinct text corpora keeps every map. Under `--watch`,
  which re-imports rule files in the same process, a changed map under a caller-set root is refused
  until restart, and a default root grows the registry with every edit. Releasing a root is not
  decided here. If it is, a released root leaves a marker, so a later violation under it is a
  finding, never a disk read.

## Enforcement

Each `pending` row names the deliberately broken variant (mutant) its tests must catch, from [plan 0632](../work/plans/0632-a-text-corpus-honours-its-waivers.md)'s sabotage list. The row cites its test files by path once they exist. Core and md test titles
are not resolved by `check:crossval`
([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)),
so citations here are by file.

| Clause                                                                                                | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Status  |
| ----------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1, 2 — the kernel takes a copy of the texts, checks its keys and values, and owns the read            | 2    | Kernel tests: a waived violation over registered text is gone while its control reports it, `examined > 0`. A map changed after registering does not change the text read. A non-string value and a non-canonical key are refused. Catches the mutants _the registered read skipped_ and _the map not copied_.                                                                                                                                                                                                                                                          | pending |
| 3 — one normalisation finds the root and key; the text is parsed under the reported `file`            | 2    | Kernel tests, as strings (CI runs Linux only): a trailing slash, a backslash, `//`, `/./` and `/../` find their root, and the waiver applies; two spellings of one root are refused as one; a relative root is refused. Catches _the root normalised without collapsing segments_ and _parsed under the normalised path_.                                                                                                                                                                                                                                               | pending |
| 4 — registration refuses a root on disk, an overlap, a different map under one root                   | 2    | Kernel tests: each refusal names both roots; `/t/1` beside `/t/10` is accepted; an exactly equal map is accepted; a subset and a superset are refused. eess-md tests: its refusal carries eess-md's remedy. Catches _the overlap refusal removed_, _the segment comparison made a string prefix_ and _a re-registration accepted without comparing_.                                                                                                                                                                                                                    | pending |
| 5 — a real file wins; a claimed path reads only its texts; a miss and a root now on disk are findings | 2    | Kernel tests: a miss gives the finding, under `.warn()` as an error, with the violation still reported, and its remedy (report `file`, or add the file) clears it; a root created after registering gives the finding; an unclaimed path reads the disk; a file on disk under a forged root is read from disk. A `scripts/check-nonvacuity.mjs` fixture row asserts the promoted undocumented-waiver finding over a text corpus, which only reading the registered text produces. Catches _the miss finding turned into a disk read_ and _the on-disk refusal removed_. | pending |
| 6 — one versioned registry per realm, shared by kernel copies                                         | 2    | Kernel tests: a second module-state instance (`vi.resetModules()` over `src`) registers while the first reads; an unknown shape refuses a registration and makes a lookup a finding; a store written directly with one path under two roots gives the finding. Catches _the registry kept as module state_.                                                                                                                                                                                                                                                             | pending |
| 7 — registered text is parsed as text from disk                                                       | 2    | eess-md tests: a valid, an undocumented, an unused (stderr captured) and a malformed directive each behave the same over `corpusFromText` and over `corpus()` with the same files on disk. Catches _the refusal in `corpusFromText` kept_.                                                                                                                                                                                                                                                                                                                              | pending |
| 1, 5 — a kernel correspondence over a text corpus honours a waiver                                    | 2    | A crossvalidate test through `correspondence()` on a binding that reports the document's absolute file (`packages/crossvalidate/src/md-mermaid.ts:128`), with its control and `examined > 0`. `engine/applyfilters-parity` (`scripts/nonvacuity/bad-applyfilters-parity.mjs`) compares the kernel's and eess-ts's copies on disk only, so it does not see this deliberate difference.                                                                                                                                                                                   | pending |
| 8 — the registry's one reader is the kernel's waiver scan                                             | 5    | Review: a second reader amends this ADR. The readers left out are recorded as [bug 0634](../work/bugs/0634-eess-ts-reads-no-waiver-in-an-in-memory-file.md) and [bug 0635](../work/bugs/0635-apply-fixes-cannot-preview-a-fix-in-a-text-corpus.md), and [bug 0422](../work/bugs/0422-a-waiver-does-not-silence-an-md-mermaid-finding.md) names the bindings that call none.                                                                                                                                                                                             | manual  |
| 9 — the trust boundary is the disk                                                                    | 2    | The clause 5 row's forged-root test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | pending |
| The residuals (consequences): a relative violating path; a kernel copy older than this decision       | 5    | Review. The relative path is [bug 0633](../work/bugs/0633-a-correspondence-reports-a-document-by-its-relative-path.md)'s. The old kernel copy is a release matter, in [plan 0632](../work/plans/0632-a-text-corpus-honours-its-waivers.md)'s Release section.                                                                                                                                                                                                                                                                                                           | manual  |
| Relation to [ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md) — the fact is ambient       | 5    | Context; nothing to enforce.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | n/a     |
