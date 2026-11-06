# ADR-024: The kernel reads a claimed file's text from its registration, never the disk

- **Status:** Proposed (2026-11-06) — written as Phase 0 of
  [plan 0632](../work/plans/0632-a-text-corpus-honours-its-waivers.md), from its design reviewed
  four times (architect and enforcement, twice each, then a check of the decision alone). It is
  reviewed as a decision before any code is written, and becomes Accepted then.
- **Extends:** [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)
- **Context:** [bug 0520](../work/bugs/0520-waivers-in-a-text-corpus-are-refused.md),
  [proposal 028](../work/proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md) ask 2
- **Supersedes nothing.**

## The question

A waiver directive (`eess-exclude`) is read from the violating file. The kernel reads that file from
disk: `fs.readFileSync(filePath)` in `applyFilters` (`packages/core/src/execute-rule.ts:150`), and
[ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md) decided how the text is masked, not
where it comes from. A dialect whose files are not on disk, such as eess-md's `corpusFromText`,
cannot hand the kernel its text. So today it refuses any document holding a directive
(`packages/md/src/corpus.ts:330`). Otherwise the waiver would silently not apply: the disk read
fails, and the `catch` at `packages/core/src/execute-rule.ts:171-177` returns no directives.

Where does the kernel read a violating file's text when the file is not on disk?

## Decision

1. **A dialect registers the texts of a root it claims.** The kernel takes
   `registerSourceText(root, files)` on `@nielspeter/eess/internal`, where `files` maps a path
   relative to `root` to its text. It is a value, as every seam the kernel takes is; what is new is
   that it is ambient (point 6).
2. **The kernel copies the texts and owns the read.** It copies `files` into a `Map` when it
   registers, refusing a value that is not a string. A caller who changes its map afterwards cannot
   change the text a waiver is read from. No dialect code runs inside the `try` that swallows a read
   failure.
3. **One normalisation, for every root and every violating path:** separators become POSIX, then
   `posix.normalize` collapses `//`, `.` and `..`, then a trailing slash is dropped. A relative root
   is refused.
4. **Registering refuses what would make a path ambiguous or forged,** each with an
   `ArchConfigError` that names the facts and carries the dialect's remedy wording:
   - a root that exists on disk, so registered text never shadows a real file;
   - a root equal to, containing, or contained by a registered root, compared by whole path
     segments (`/t/1` does not contain `/t/10`);
   - the only exception: the same root with an exactly equal map, the same keys each with the same
     text. A subset or a superset is different.

   A root names one text per path for the process.

5. **The lookup, decided outside the swallowing `try`:**
   - a violating path under a claimed root is read only from that root's texts;
   - a claimed path the texts do not hold is an unsuppressable configuration finding naming the file
     and the root. The violation itself stays, unwaived;
   - a claimed root that now exists on disk is the same kind of finding, and neither source is read;
   - a path under no claimed root is read from disk, as before.
6. **The registry is process-wide, strong, and shared by every kernel copy.**
   - It lives on one versioned object on `globalThis` under a `Symbol.for` key, so two copies of the
     kernel in one install tree read the same texts.
   - Each copy reads that object as `unknown`, through a type guard. An unknown version, or a path
     under two roots in it, is a finding, never a pick.
   - Entries are never released. The bound is one entry per distinct map for the life of the process.
7. **The registered text is parsed as text from disk is.** It goes through `parseExclusionComments`
   with the same masking, so an undocumented waiver, an unused one and a malformed one behave as on
   disk. Parity, not a new guarantee: where [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown masking reads a directive
   inside a `<div>`, a `<pre>` or a fenced block in a blockquote
   ([bug 0291](../work/bugs/0291-the-markdown-masker-honours-a-directive-inside-code.md)), it does so
   here too.
8. **The scope is the kernel's terminals.** eess-ts has its own `applyFilters`
   (`packages/ts/src/core/execute-rule.ts:282`), and two crossvalidate bindings call none
   ([bug 0422](../work/bugs/0422-a-waiver-does-not-silence-an-md-mermaid-finding.md)). No md
   violation reaches either today; each is its own record.

## Why this, and not the alternatives

- **A reader on the rule's context, set by the dialect's builders.** Rejected: a rule built outside
  eess-md's builders never sets it. A crossvalidate correspondence, or the kernel's `correspondence()`
  over md elements, reaches `applyFilters` through the kernel's terminal with a bare path string
  (`packages/core/src/correspondence.ts:67-76`), and its waivers would silently not apply. Keying by
  path covers every kernel terminal.
- **A registered reader function.** Rejected after review: a function cannot be listed or compared.
  So the kernel could not tell whether a second registration of a root holds the same text. It would
  either refuse equal maps (by identity) or read one corpus's waivers from another's text (accepting
  any re-registration). A function also runs dialect code inside the swallowing `try`.
- **A `WeakRef` to the registering corpus.** Rejected after review, which measured a text corpus
  collected while its documents still reached a rule: `ParsedCodeBlocks` keeps documents, not the
  corpus (`packages/md/src/model/code-block-parse.ts:95-107`). Whether a waiver applied would then
  depend on garbage collection.
- **The longest matching root prefix, with a fall back to the disk.** Rejected after review. Two
  overlapping roots name one file twice, so a waiver is read from the other corpus's text: a false
  green. A string prefix crosses segment boundaries, and the fall back reads nothing from a root that
  is not on disk, silently.
- **A second waiver reader inside eess-md.** Rejected by [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md): one parser, in the kernel.

## Its relation to [ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md)

[ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md) has the kernel take the fact a dialect
materialises, never a project. A path-keyed map of texts is that kind of fact. What departs from
every seam so far (`PathUniverse`, `DiskSet`, `sourceEmpty`, [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s `mask`) is that the fact is
ambient: registered once and looked up by path, not passed with the rule. That is the price of
covering terminals the dialect does not build.

## Consequences

- `corpusFromText` registers its map and stops refusing waivers. Its default root is named by a
  framed content hash, so equal maps share a root and different maps get sibling roots.
- A caller-set root reused with other text, an overlapping root, a relative root and a root under the
  reserved `/__eess_text_corpus__` prefix are refused where they passed before, which is a break in
  eess-md.
- **The residual: an old kernel copy without the registry.** eess-crossvalidate allows eess-md
  `>=0.14.0` as a peer. So an install can hold an eess-md that registers beside an
  eess-crossvalidate whose kernel predates the registry. A correspondence there reads the text
  corpus's file from disk, finds nothing, and the waived violation stays red with nothing explaining
  it: a false red, never a false green. The remedy is to upgrade eess-crossvalidate; the release
  raises its kernel range. A kernel patch rather than a minor would let npm dedupe to one kernel and
  mostly remove this. The minor follows the precedent for new `/internal` exports, and this residual
  is its cost.
- A long-running process that builds many distinct text corpora keeps every map. Releasing a root is
  not decided here. If it is, a released root leaves a marker, so a later violation under it is a
  finding, never a disk read.

## Enforcement

| Clause                                                                                          | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                   | Status  |
| ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1, 2 — the kernel takes a copy of the texts and owns the read                                   | 2    | A kernel test, by [plan 0632](../work/plans/0632-a-text-corpus-honours-its-waivers.md) Phase 1: a waived violation over registered text is gone while its control reports it, `examined > 0`; a map changed after registering does not change the text read; a non-string value is refused.                                                 | pending |
| 3 — one normalisation for roots and paths                                                       | 2    | Kernel tests, as strings (CI runs Linux only): a trailing slash, a backslash, `//`, `/./` and `/../`; two spellings of one root refused as one; a backslash-spelled violating path finds its root.                                                                                                                                          | pending |
| 4 — registration refuses a root on disk, an overlap, a different map under one root             | 2    | Kernel tests: each refusal, `/t/1` beside `/t/10` accepted, an exactly equal map accepted, a subset and a superset refused.                                                                                                                                                                                                                 | pending |
| 5 — a claimed path reads only its texts; a miss and a root now on disk are findings             | 2    | Kernel tests: a miss gives the configuration finding with the violation still reported; a root created after registering gives it too; an unclaimed path reads the disk. A `scripts/check-nonvacuity.mjs` fixture row asserts the promoted undocumented-waiver finding over a text corpus, which only reading the registered text produces. | pending |
| 6 — one versioned registry on `globalThis`, shared by kernel copies                             | 2    | A kernel test with a second module-state instance (`vi.resetModules()` over `src`): one registers, the other reads; an unknown version is refused at registration and at lookup.                                                                                                                                                            | pending |
| 7 — registered text is parsed as text from disk                                                 | 2    | eess-md tests: a waiver, an undocumented one and an unused one (stderr captured) behave the same over `corpusFromText` and over `corpus()` with the same files on disk.                                                                                                                                                                     | pending |
| 8 — the scope is the kernel's terminals                                                         | 5    | Review. A crossvalidate test through `correspondence()` covers the kernel path; the eess-ts copy and the two crossvalidate bindings are their own records.                                                                                                                                                                                  | manual  |
| The residual (consequences) — an old crossvalidate beside a registering eess-md is a false red  | 5    | Release review: the release raises eess-crossvalidate's kernel range (`RELEASING.md` step 3a), and its changeset names the remedy.                                                                                                                                                                                                          | manual  |
| Relation to [ADR-013](./013-the-kernel-takes-the-fact-not-the-project.md) — the fact is ambient | 5    | Context; nothing to enforce.                                                                                                                                                                                                                                                                                                                | n/a     |
