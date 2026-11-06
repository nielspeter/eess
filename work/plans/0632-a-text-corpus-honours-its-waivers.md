# Plan 0632: a text corpus honours its waivers

## Status

- **State:** Draft — written 2026-11-06 at the maintainer's direction, for
  [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) and
  [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s ask 2.
  Revised the same day after an architect review and an enforcement review of the first design. Both
  found its `WeakRef` lifetime unsound (measured: a text corpus is collected while its documents are
  still in use). The enforcement review also found its longest-prefix lookup a false green on
  overlapping roots. The revision is below; the first design is recorded under _Corrections_.
- **Implements:** [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)
  (ask 2; ask 1 is [plan 0624](./completed/0624-md-one-documents-field-value-public.md)'s)
- **Fixes:** [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md)
- **Priority:** Medium. Nothing passes that should fail today: the refusal is loud. But a named
  consumer waits on it: a consuming project's plan 125 reads one record's field from text, and a
  valid record that holds a waiver directive throws.
- **Effort:** Medium to Large, about a day. The ADR, the kernel registry and its tests are most of
  it. eess-md and the docs are small.
- **Created:** 2026-11-06
- **Decided, each overrulable:**
  - **One plan and one PR, a commit per phase.** The architect review proposed three PRs: the ADR,
    the kernel, then eess-md. They share one root cause and each step needs the one before it, and
    each extra PR is a full CI run ([spike 0631](../spikes/0631-where-ci-time-goes.md)).
  - The binding decision is a new ADR, written in Phase 0 before any code. It extends
    [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) and records its departure
    from [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md).

## Problem

`corpusFromText` (`packages/md/src/corpus.ts:233`) refuses any loaded document that holds a waiver
directive (`refuseWaivers`, `packages/md/src/corpus.ts:330`). It has to: the kernel reads a violating
file's waivers from disk, `fs.readFileSync(filePath)` in `applyFilters`
(`packages/core/src/execute-rule.ts:150`), and a text corpus's files are not on disk. Without the
refusal, a waiver in a text corpus would silently not apply.

**Measured 2026-11-06.** The set is the 592 `.md` files `git ls-files 'work/**/*.md'` lists in this
repository. Each was read with `corpusFromText` and then `resolveFieldValue`, under Node 24.22
against `packages/md/dist`.

- **Refused:** 2 hold a waiver directive and are refused, though the reader is not a rule and applies
  no waiver. One corpus over all 592 is refused for the same reason. The enforcement review counted
  597 files on disk and 3 refused, untracked files included.
- **Cost:** one corpus over the 590 others builds in 579–638 ms. Reading every record's field takes
  150–388 ms, depending on the reader's options. A corpus per record costs about the same per
  record.

So once the refusal goes, ask 2 needs no new parser and no new API: `corpusFromText` plus
`resolveFieldValue`. Of the proposal review's three answers (a private parse, a public parser, or
[bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) plus documentation), that is the
third.

## Design

### D1. The kernel reads a claimed path through its registered source, never the disk

A new kernel function, on `@nielspeter/eess/internal` (family plumbing,
[ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md)):

```ts
/** Claim `root`: every file under it is read with `read`, and nowhere else. */
registerSourceRoot(root: string, read: (file: string) => string | undefined): void
```

**Registering a root:**

- **The root is normalised.** It must be absolute; its separators become POSIX; a trailing slash is
  dropped.
- **A root that exists on disk is refused** with an `ArchConfigError`, so a registered reader can
  never shadow a real file. Without that, any importer of `/internal` could waive a real
  repository's findings with no directive in it. The kernel owns this check; today it lives only in
  eess-md (`packages/md/src/corpus.ts:238`).
- **A root that overlaps another is refused:** one equal to, containing, or contained by a registered
  root, compared by whole path segments (`/t/1` does not contain `/t/10`).
- **The exception:** the same root registered again, with a reader that gives the same text for every
  file, is accepted. A content-addressed root (D2) makes that the common case.

**The lifetime is strong, for the process.**

- **Why not the first design's `WeakRef`:** both reviews measured that a text corpus can be collected
  while its documents still reach a rule. The kernel's `correspondence()` builds violations from bare
  path strings (`packages/core/src/correspondence.ts:67-76`). `ParsedCodeBlocks` keeps documents, not
  the corpus (`packages/md/src/model/code-block-parse.ts:95-107`). So a waiver would apply or not
  depending on GC.
- **Why strong is affordable:** the registry holds only text strings, this repository's whole `work/`
  is 8.6 MB, and vitest isolates each test file.

**Every kernel copy shares the registry.** It is kept on `globalThis` under a `Symbol.for` key, so two
copies of the kernel in one install tree (the split `RELEASING.md:284-290` records for module-level
registries) see one registry.

**The lookup.**

- In `applyFilters`, a violating file under a registered root is read only through that root's
  reader.
- If the reader holds no such file, that is an unsuppressable configuration finding
  (`bypassFilters`) naming the file and the root, never a silent disk read.
- A file under no registered root is read from disk, as today.

**The text is parsed unchanged.** It goes through `parseExclusionComments`, with whatever
[ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) masking applies on disk: parity,
not a new guarantee.

- [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown row is `pending`.
- The enforcement review measured a directive inside a `<div>`, a `<pre>`, or a fence in a blockquote
  being read as a waiver, on disk and so here. That is
  [bug 0291](../bugs/0291-the-markdown-masker-honours-a-directive-inside-code.md)'s class, inherited,
  not introduced.

**The scope is every kernel terminal, not every terminal.**

- eess-ts has its own `applyFilters` (`packages/ts/src/core/execute-rule.ts:282`, behind an
  `existsSync` at `:280`), which no md violation reaches.
- Crossvalidate's `md-mermaid-er.ts:191` and `md-gherkin.ts:154` call no `applyFilters`
  ([bug 0422](../bugs/0422-a-waiver-does-not-silence-an-md-mermaid-finding.md)).
- That eess-ts's copy skips an in-memory file is the same defect on another path, recorded as its own
  bug, not added here.

**A departure from [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md), stated.** Every seam so far hands the kernel a value: `PathUniverse`,
`DiskSet`, `sourceEmpty`, [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s `mask`. This is the first process-wide capability the kernel
looks up by path. Keying by path is still right: a reader on the rule context would never be set by a
rule built outside eess-md's builders. The ADR says so.

### D2. `corpusFromText` names its default root by its content

The default root becomes `/__eess_text_corpus__/<hash>`, where `<hash>` is a short hash of the map's
sorted keys and texts.

- **It is deterministic,** so `file` no longer depends on test order. `file` reaches stderr lines,
  annotations and the baseline's relative paths.
- **Equal maps share a root safely,** under D1's same-content exception.
- **Different maps never overlap:** their roots are siblings.
- **The cost is small:** hashing all of `work/` takes 11–13 ms, about 2% of building the corpus.

A caller-set root follows D1's rules: the same root with different text is refused, deterministically,
when the second corpus registers.

The docs already tell callers to assert on `element` or `relPath`, or to set `root`, never on `file`
(`docs/markdown.md`, the `corpusFromText` section). Two tests in this repository build the old default
path by hand (`packages/md/tests/corpus-from-text.test.ts:341`, `:433`); they move with it.

### D3. `corpusFromText` registers its reader and drops the refusal

- **The reader:** eess-md's existing per-corpus reader (`packages/md/src/model/corpus-internals.ts`)
  is registered, not a second one. Its `?? ''` default for an unknown file becomes `undefined`.
- **The refusal goes:** `refuseWaivers` is removed.
- **Waivers then behave as on disk:**
  - a waiver applies;
  - an undocumented one is the unsuppressable finding;
  - an unused one warns on stderr;
  - a malformed one reaches stderr only when the document has a violation.

### D4. Ask 2 is documentation

`docs/markdown.md` gains "Reading one record's field from text": `corpusFromText` over the texts, then
`resolveFieldValue` per document, with the measured cost and its method. There is no new reader, so
there is no new `MdDocument` constructor to promise; the `frozen` rule of
[ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1 is untouched.

## Phases

### Phase 0 — the ADR

- [ ] The new ADR, decided from D1 and D2:
  - it extends [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) (`**Extends:**`, with the link back);
  - it states its departure from [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md);
  - its Enforcement table uses Tier 2 rows against deterministic behaviour, with no GC-dependent row;
  - its row goes in `CLAUDE.md`'s ADR index.

### Phase 1 — the kernel reads a claimed path through its source

- [ ] `registerSourceRoot` in `packages/core/src/source-roots.ts`, kept on `globalThis` under a
      `Symbol.for` key, exported from `@nielspeter/eess/internal`.
- [ ] The registration rules:
  - the root is normalised;
  - a root that exists on disk is refused;
  - an overlapping root is refused, compared segment-wise;
  - the same root with the same text is accepted.
- [ ] `applyFilters` reads a claimed path only through its reader; a miss is a configuration finding.
- [ ] Red first, through the kernel's public terminal, over a virtual file with a registered reader:
  - the waived violation is gone, while the control text without the directive reports it, with
    `examined > 0`;
  - an undocumented directive gives the promoted finding, which proves the registered text was read.

### Phase 2 — `corpusFromText` registers and stops refusing

- [ ] The content-hashed default root.
- [ ] `corpusFromText` registers its reader, and `refuseWaivers` is removed.
- [ ] Its JSDoc and `docs/markdown.md`'s `corpusFromText` section are updated, and the refusal tests
      (`packages/md/tests/corpus-from-text.test.ts:330-345`, `:428-438`) are inverted.
- [ ] Red first, over a text corpus, each with parity against `corpus()` over the same files on disk:
  - a waiver applies, against its control;
  - an undocumented one is the promoted finding;
  - an unused one warns, with stderr captured.
- [ ] A crossvalidate binding that goes through `correspondence()` (`md-ts.ts:190` or
      `md-mermaid.ts:131`) honours a waiver in a text corpus's document.
- [ ] The eess-ts copy's in-memory-file gap is recorded as its own bug.

### Phase 3 — ask 2, documented

- [ ] `docs/markdown.md`: reading one record's field from text, with the measured cost and its method.
- [ ] A test of [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s
      waiver break class: a record holding a waiver directive reads its field through
      `corpusFromText` + `resolveFieldValue`.

## Test inventory

- **Kernel, registration:**
  - a relative root is refused;
  - a trailing slash and Windows separators are normalised;
  - a root that exists on disk is refused;
  - equal, containing and contained roots are refused;
  - `/t/1` beside `/t/10` is accepted;
  - the same root with the same text is accepted, and with different text refused.
- **Kernel, lookup:**
  - the reader is used for a claimed path;
  - a miss under a claimed root is the configuration finding;
  - an unclaimed path is read from disk;
  - a second kernel instance (a fresh import of the module under another URL) sees the same
    registry.
- **eess-md:**
  - a waiver applies, with its control;
  - an undocumented waiver gives its finding;
  - an unused waiver warns, with stderr captured;
  - a directive in a top-level fence is not one;
  - two text corpora with different maps get different roots, and each one's waiver applies to its
    own finding;
  - equal maps share one root;
  - a caller-set root reused with other text is refused;
  - parity with `corpus()`.
- **Crossvalidate:** a correspondence over a text corpus honours a waiver.
- **Ask 2:** a record holding a waiver reads its field.
- **Non-vacuity:**
  - A fixture-script row, exit 1 meaning OK, as `bad-applyfilters-parity.mjs` does. It runs over a
    text corpus with an undocumented waiver and asserts the promoted finding, which only reading the
    registered text produces.
  - A sabotage matrix in a worktree, one mutant each:
    - the registered read skipped, falling to disk;
    - the miss finding turned into a disk read;
    - the overlap refusal removed;
    - the segment comparison made a string prefix;
    - the on-disk refusal removed;
    - the refusal in `corpusFromText` kept;
    - the default root made constant.

## Out of scope

- **A public document parser, or a reader that takes text directly:** ask 2's other two answers. The
  measurement says neither is needed; a later asker who cannot build a corpus reopens it.
- **Releasing a registered root in a long-running process:** not needed today. If it is, a released
  root leaves a marker, so a later violation under it is a finding, never a disk read.
- **`apply-fixes` over a text corpus.** A dry run (`write: false`) would preview a fix there, which is
  a real use; recorded as a follow-up, not built.
- **Two kernel copies of which only one has the registry:** an adopter's own pre-registry kernel
  running a correspondence over a text corpus. eess-md's kernel range excludes a pre-registry kernel
  for its own use, and the ADR states the residual.

## Release

- **`@nielspeter/eess` minor:** a new internal export.
- **`@nielspeter/eess-md` minor:**
  - `corpusFromText` accepts what it refused;
  - its default root changes, which the docs already told callers not to rely on, and the changeset
    says so;
  - its kernel dependency rises to the release's kernel version.
- **`@nielspeter/eess-crossvalidate`:** a changeset for its new test (none, or patch for the kernel
  range).

## Corrections

**The first design, replaced on review (2026-11-06).** It held readers through a `WeakRef` to the
corpus, on the claim that "a rule holds its corpus until it runs". It looked a file up by the longest
matching root prefix, with a disk fallback, and it used a counter for the per-call default root.

Two reviews measured why that design failed:

- **The `WeakRef` claim is false:** a `correspondence()` and `ParsedCodeBlocks` keep documents, not the
  corpus, so whether a waiver applied would depend on GC.
- **The longest-prefix lookup is a false green:** overlapping roots name one file twice, and a string
  prefix crosses segment boundaries.
- **The disk fallback hid a miss.**
- **The counter made `file` depend on test order.**

It also overclaimed three things:

- that [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s masking guarantee holds, but [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown row is `pending`;
- "every terminal", but eess-ts has its own filters;
- a per-record cost of 9.7 ms, which came from a cold run.
