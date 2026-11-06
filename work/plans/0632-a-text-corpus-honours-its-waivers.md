# Plan 0632: a text corpus honours its waivers

## Status

- **State:** Ready — frozen 2026-11-06 against `main` 2e071307 (eess-md 0.16.0, kernel 0.10.1), after the D1 check passed it. written 2026-11-06 at the maintainer's direction, for
  [bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) and
  [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s ask 2.
  Revised the same day after an architect review and an enforcement review of the first design. Both
  found its `WeakRef` lifetime unsound (measured: a text corpus is collected while its documents are
  still in use). The enforcement review also found its longest-prefix lookup a false green on
  overlapping roots. Revised again the same day after both re-checked the revision: a
  registered reader function cannot be compared, so the kernel now takes the texts. Both re-checks
  said the edit needs no further full round; the architect asked that D1 alone be checked once more.
  Each revision is recorded under _Corrections_. The D1 check passed it for the freeze once its one Important finding, segment collapsing in the normalisation, was written in; it is.
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

**Measured 2026-11-06,** under Node 24.22 against `packages/md/dist` at v0.19.0. The set is the
592 `.md` files `git ls-files 'work/**/*.md'` lists; that glob skips the four files at the top of
`work/`, all tracked, one of which also holds a waiver.

- **Refused:** 2 of the 592 hold a waiver directive and are refused, though the reader is not a rule
  and applies no waiver. One corpus over all of them is refused for the same reason.
- **Cost:** one corpus over the 590 others builds in 579–638 ms. Reading every record's field with
  `resolveFieldValue`, `{ label: 'State', forms: ['bold', 'plain'], region: { section: 'Status' } }`,
  takes 150–171 ms. A corpus per record costs about the same per record, 0.9–1.6 ms.

So once the refusal goes, ask 2 needs no new parser and no new API: `corpusFromText` plus
`resolveFieldValue`. Of the proposal review's three answers (a private parse, a public parser, or
[bug 0520](../bugs/0520-waivers-in-a-text-corpus-are-refused.md) plus documentation), that is the
third.

## Design

### D1. The kernel holds a claimed root's texts, and reads a claimed path only from them

A new kernel function, on `@nielspeter/eess/internal` (family plumbing,
[ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md)):

```ts
/** Claim `root`: each file under it is these texts, keyed by path relative to `root`, and nothing else. */
registerSourceText(root: string, files: Readonly<Record<string, string>>): void
```

**The kernel takes the texts, not a reader.** The first revision passed a function. Both re-checks
found that a function cannot be compared, so the kernel could not decide whether a second
registration of a root held the same text. Comparing identity refuses equal maps; accepting any
re-registration lets one corpus's waivers read another's text. With the texts, the kernel:

- **copies the map into a `Map` when it registers,** checking that every value is a string (a `'__proto__'` key assigned into `{}` sets the prototype, measured), so a caller who changes the map afterwards cannot change the
  text a waiver is read from. The first revision's reader read the caller's live map, measured by the
  enforcement re-check;
- **owns the read,** so no dialect code runs inside the `try` that swallows a read failure (`packages/core/src/execute-rule.ts:149`, its `catch` at `:171-177`). The kernel's own lookup outcomes (a miss, a claimed root now on disk, an unknown shape version, a path under two roots) are decided outside that `try`, so none of them can be silenced;
- **decides a re-registration by content.**

**Registering a root:**

- **The root is normalised, and so is every violating path, by one function:** separators become POSIX, then `posix.normalize` collapses `//`, `.` and `..`, then a trailing slash is dropped. eess-md builds `file` with `join(root, rel)` (`packages/md/src/corpus.ts:160`), which collapses them too. Normalising only separators would let `/v//x` and `/v/x` both register, and a violation under one be read from the other's text: a false green the D1 check measured. A relative root is an `ArchConfigError`.
- **A root that exists on disk is refused,** so the texts can never shadow a real file. Without that,
  any importer of `/internal` could waive a real repository's findings with no directive in it. The
  kernel owns this check; today it lives only in eess-md (`packages/md/src/corpus.ts:238`).
- **A root that overlaps another is refused:** one equal to, containing, or contained by a registered
  root, compared by whole path segments (`/t/1` does not contain `/t/10`).
- **The one exception is the same root with an exactly equal map:** the same keys, each with the same
  text. A subset or a superset is different. A content-addressed root (D2) makes that the common
  case.
- **Each refusal names the root it collided with**, as a fact: a root names one text per path for the process. The remedy wording is the dialect's, passed with the registration, as [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s `emptinessAdvice()` lets the dialect word its advice. eess-md's says to leave `root` unset or name a root used for one map only.

**The lifetime is strong, for the process.**

- **Why not the first design's `WeakRef`:** both reviews measured that a text corpus can be collected
  while its documents still reach a rule. The kernel's `correspondence()` builds violations from bare
  path strings (`packages/core/src/correspondence.ts:67-76`). `ParsedCodeBlocks` keeps documents, not
  the corpus (`packages/md/src/model/code-block-parse.ts:95-107`).
- **The bound:** one entry per distinct map, for the life of the process. This repository's whole
  `work/` is 8.6 MB, and vitest isolates each test file by default. Under `isolate: false` a worker
  shares the registry across files, so a caller-set root reused with other text in another file is
  refused, as it would be within one file. Nobody has asked whether a board that builds one corpus per
  record version runs long enough for the growth to matter; releasing a root is out of scope below.

**Every kernel copy shares the registry,** through one object on `globalThis` under a `Symbol.for`
key. Two copies of the kernel in one install tree (the module-state split `RELEASING.md:284-290`
records) see the same texts.

- **The shape is versioned,** a `version` field on the shared object. A kernel that finds a shape it
  does not know refuses loudly rather than reading it.
- **It holds plain data,** roots and their copied maps. Each kernel copy reads it as `unknown` through a type guard (also how [ADR-005](../../adr/005-no-any-no-type-assertions.md) is met); an unknown shape, or a path under two roots in it, is a finding, never a pick.

**The lookup, in `applyFilters`.**

- **The violating file's path is normalised as the root is,** so a Windows `join(root, rel)` finds its
  root.
- **A path under a claimed root is read only from that root's texts.**
- **A claimed path the texts do not hold is an unsuppressable configuration finding**
  (`bypassFilters`) naming the file, the root and the cause: a rule reported a path the map does not
  hold, or spelled it differently. The violation itself stays, unwaived. One finding per file and
  root, keyed on the rule id when there is one.
- **A claimed root that now exists on disk is a configuration finding too:** a file created after registration would otherwise be shadowed silently. The lookup then reads neither source; the violation stays unwaived, and the finding is de-duplicated as the miss is.
- **A path under no claimed root is read from disk,** as today.

**The text is parsed unchanged.** It goes through `parseExclusionComments`, with whatever
[ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) masking applies on disk: parity, not a new guarantee.

- [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown row is `pending`.
- The enforcement review measured a directive inside a `<div>`, a `<pre>`, or a fence in a
  blockquote being read as a waiver, on disk and so here. That is
  [bug 0291](../bugs/0291-the-markdown-masker-honours-a-directive-inside-code.md)'s class, inherited,
  not introduced.

**The scope is every kernel terminal, not every terminal.**

- eess-ts has its own `applyFilters` (`packages/ts/src/core/execute-rule.ts:282`, behind an
  `existsSync` at `:280`), which no md violation reaches.
- Crossvalidate's `md-mermaid-er.ts:191` and `md-gherkin.ts:154` call no `applyFilters`
  ([bug 0422](../bugs/0422-a-waiver-does-not-silence-an-md-mermaid-finding.md)).
- That eess-ts's copy skips an in-memory file is the same defect on another path, recorded as its own
  bug, not added here.

**A departure from [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md), stated.** Every seam so far hands the kernel a value:
`PathUniverse`, `DiskSet`, `sourceEmpty`, [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s `mask`. This one is still a value, the
texts, but it is ambient: registered once and looked up by path, not passed with the rule. Keying by
path is right, because a value on the rule context would never be set by a rule built outside
eess-md's builders. The ADR says so.

**The residual: an old kernel copy without the registry.** eess-crossvalidate allows eess-md
`>=0.14.0` as a peer, so an install can hold this release's eess-md with an eess-crossvalidate
still on kernel `^0.10.1`. A correspondence there reads a text corpus's file from disk, finds
nothing, and the waived violation stays red. That is a false red, never a false green, with nothing
explaining it. The ADR states it with its remedy, upgrade eess-crossvalidate, and the release raises
crossvalidate's kernel range (`RELEASING.md` step 3a).

### D2. `corpusFromText` names its default root by its content

The default root becomes `/__eess_text_corpus__/<hash>`.

- **`<hash>` is a hash of a framed encoding,** at least 64 bits: the sorted entries as JSON,
  `[[key, text], …]`. An unframed concatenation collides: the enforcement re-check showed two maps
  `corpusFromText` accepts with one hash.
- **The hash only names a root.** Equality is still decided by content, under D1.
- **It is deterministic,** so `file` no longer depends on test order. `file` reaches stderr lines,
  annotations and the baseline's relative paths.
- **Equal maps share a root;** different maps get sibling roots, which never overlap.
- **Cost:** hashing all of `work/` takes 11–13 ms, about 2% of building the corpus.
- **The reserved prefix:** a caller-set root inside or containing `/__eess_text_corpus__` is refused
  with its own message, since an adopter who set the old default spelling would otherwise meet an
  overlap with no explanation.

The docs tell callers to assert on `element` or `relPath`, or to set `root`, never on `file`
(`docs/markdown.md`, the `corpusFromText` section). They will add that a caller who builds one corpus
per record (ask 2) leaves `root` unset. Two tests in this repository build the old default path by
hand (`packages/md/tests/corpus-from-text.test.ts:341`, `:433`); they move with it.

### D3. `corpusFromText` registers its texts and drops the refusal

- **It registers its map,** `registerSourceText(root, files)`. eess-md's internal reader stays as it is.
- **The refusal goes:** `refuseWaivers` is removed.
- **Waivers then behave as on disk:**
  - a waiver applies;
  - an undocumented one is the unsuppressable finding;
  - an unused one warns on stderr;
  - a malformed one reaches stderr only when the document has a violation.

### D4. Ask 2 is documentation

`docs/markdown.md` gains "Reading one record's field from text": `corpusFromText` over the texts,
then `resolveFieldValue` per document, with the measured cost and its method. There is no new
reader, so there is no new `MdDocument` constructor to promise; the `frozen` rule of
[ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1 is untouched.

## Phases

### Phase 0 — the ADR

- [ ] The new ADR, decided from D1 and D2:
  - it extends [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) (`**Extends:**`, with the link back);
  - it states its departure from [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md) (the fact is [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s kind; only the ambient lookup is new), and the residual above with its remedy;
  - its rows cite core and md tests by file, as [ADR-012](../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) does, since `check:crossval` resolves titles only in `packages/ts`;
  - its Enforcement table uses Tier 2 rows against deterministic behaviour, with no GC-dependent row;
  - its row goes in `CLAUDE.md`'s ADR index.
- [ ] The ADR commit is reviewed as a decision before any Phase 1 code is written.

### Phase 1 — the kernel holds a claimed root's texts

- [ ] `registerSourceText` in `packages/core/src/source-roots.ts`, on a versioned object on
      `globalThis` under a `Symbol.for` key, exported from `@nielspeter/eess/internal`.
- [ ] The registration rules:
  - the root is normalised, with `posix.normalize`;
  - a root that exists on disk is refused;
  - an overlapping root is refused, segment-wise, after normalising;
  - only an exactly equal map is accepted again;
  - the map is copied.
- [ ] `applyFilters` normalises the violating path and reads a claimed path only from the texts. A
      miss, and a claimed root that now exists on disk, are configuration findings.
- [ ] Red first, through the kernel's public terminal, over a virtual file with registered texts:
  - the waived violation is gone, while the control text without the directive reports it, with
    `examined > 0`;
  - an undocumented directive gives the promoted finding, which proves the registered text was read.

### Phase 2 — `corpusFromText` registers and stops refusing

- [ ] The content-hashed default root, and the reserved prefix refused.
- [ ] `corpusFromText` registers its map, and `refuseWaivers` is removed.
- [ ] Its JSDoc and `docs/markdown.md`'s `corpusFromText` section are updated, and the refusal tests
      (`packages/md/tests/corpus-from-text.test.ts:330-345`, `:428-438`) are inverted.
- [ ] Red first, over a text corpus, each with parity against `corpus()` over the same files on disk:
  - a waiver applies, against its control;
  - an undocumented one is the promoted finding;
  - an unused one warns, with stderr captured.
- [ ] A crossvalidate binding that goes through `correspondence()` (`md-ts.ts:190` or
      `md-mermaid.ts:131`) honours a waiver in a text corpus's document, against its control, with
      `examined > 0`.
- [ ] The eess-ts copy's in-memory-file gap is recorded as its own bug.
- [ ] `apply-fixes`' dry run over a text corpus is recorded as its own bug.

### Phase 3 — ask 2, documented

- [ ] `docs/markdown.md`: reading one record's field from text, with the measured cost and its
      method, and "leave `root` unset".
- [ ] A test of [proposal 028](../proposals/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s
      waiver break class: a record holding a waiver directive reads its field through
      `corpusFromText` + `resolveFieldValue`.

## Test inventory

- **Kernel, registration:**
  - a relative root is refused;
  - a trailing slash, a backslash, `//`, `/./` and `/../` are normalised (as strings, since CI runs Linux only);
  - two spellings of one root (`/v//x` and `/v/x`) are refused as one;
  - a root that exists on disk is refused;
  - equal, containing and contained roots are refused;
  - `/t/1` beside `/t/10` is accepted;
  - an exactly equal map under the same root is accepted, and a different one refused;
  - a subset and a superset are refused;
  - a caller's map changed after registering does not change the registered text;
  - an unknown shape version on the shared object is refused, at registration and at lookup;
  - a `'__proto__'` key and a non-string value are handled (kept as a key; refused).
- **Kernel, lookup:**
  - the texts are used for a claimed path;
  - a backslash-spelled violating path finds its root;
  - a miss under a claimed root is the configuration finding, with the original violation still
    reported;
  - a claimed root created on disk after registration is the configuration finding;
  - an unclaimed path is read from disk;
  - a second kernel copy sees the registry: `vi.resetModules()` gives a second module-state instance from `src` (measured in vitest 4), which registers while the first reads. A plain re-import under another URL would share its imports and could not fail.
- **eess-md:**
  - a waiver applies, with its control;
  - an undocumented waiver gives its finding;
  - an unused waiver warns, with stderr captured;
  - a directive in a top-level fence is not one;
  - maps that differ only in one key's text, and maps with the same texts under other keys, get
    different roots, and each one's waiver applies to its own finding;
  - equal maps share one root;
  - a caller-set root reused with other text is refused;
  - the reserved prefix is refused;
  - parity with `corpus()`.
- **Crossvalidate:** a correspondence over a text corpus honours a waiver, with its control and
  `examined > 0`.
- **Ask 2:** a record holding a waiver reads its field.
- **Non-vacuity:** no repository gate reads a text corpus, so the row is the harness's own, a fixture
  script that exits 1 to mean OK, as `bad-applyfilters-parity.mjs` does. Over a text corpus with an
  undocumented waiver, it asserts the promoted finding, which only reading the registered text
  produces. A sabotage matrix in a worktree has these mutants:
  - the registered read skipped, so it falls to disk;
  - the miss finding turned into a disk read;
  - the overlap refusal removed;
  - the segment comparison made a string prefix;
    - the root normalised without collapsing segments;
  - the on-disk refusal removed, at registration and at lookup;
  - a re-registration accepted without comparing;
  - the map not copied;
  - the registry kept as module state;
  - the hash over keys only, and over texts only;
  - the refusal in `corpusFromText` kept;
  - the default root made constant.

## Out of scope

- **A public document parser, or a reader that takes text directly:** ask 2's other two answers. The
  measurement says neither is needed; a later asker who cannot build a corpus reopens it.
- **Releasing a registered root in a long-running process:** not needed today. If it is, a released
  root leaves a marker, so a later violation under it is a finding, never a disk read.
- **`apply-fixes` over a text corpus.** A dry run (`write: false`) would preview a fix there, which is
  a real use. It is not built here and not yet recorded; it gets a bug in Phase 2, beside the eess-ts
  one.

## Release

- **`@nielspeter/eess` minor:** a new internal export, on the precedent of 0.8.0's new `/internal` exports. A patch would satisfy every published `^0.10.1`, letting npm dedupe to one kernel and mostly removing the residual; the minor is chosen for the precedent, and the residual is its stated cost. The kernel minor leaves every dialect's
  `^0.10.1`, so `changeset version` patch-bumps eess-ts, eess-mermaid and eess-gherkin too.
- **`@nielspeter/eess-md` minor, marked `**Breaking**`:**
  - `corpusFromText` accepts the waivers it refused;
  - its default root changes, which the docs already told callers not to rely on;
  - it newly refuses a caller-set root reused with other text, an overlapping root (including two spellings of one), a relative root (documented as absolute, never checked, `packages/md/src/corpus.ts:216`), and the reserved prefix.

  The changeset names eess-crossvalidate, which depends on it ([bug 0185](../bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)).

- **`@nielspeter/eess-crossvalidate`:** its kernel range and its dialect peer floors rise to this
  release's versions (`RELEASING.md` step 3a). Its changeset says why, and names the residual's
  remedy.

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

**The first revision, replaced on its re-check (2026-11-06).** It registered a reader function,
`registerSourceRoot(root, read)`, and accepted "the same root with a reader that gives the same text
for every file". Both re-checks found that undecidable: a function cannot be listed or compared. So
the kernel would have refused equal maps (identity), or accepted another corpus's text (any
re-registration). Its reader also read the caller's live map, so text changed after construction
reached waivers. It normalised the root but not the violating path, checked the disk only at
registration, named the wrong two-kernel residual (it is an old eess-crossvalidate with a new
eess-md: a false red), and planned a two-kernel test that could not fail (a re-import shares its
imports). Its measurement note said the uncounted files were untracked; they are tracked, and outside
the glob.
