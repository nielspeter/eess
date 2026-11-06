# Plan 0632: a text corpus honours its waivers

## Status

- **State:** Done — built 2026-11-06 on `plan/0632-text-corpus-waivers`: Phase 0 accepted [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md), Phases 1–3 in 25f46e74, 6766b8b0 and 819fbaf5, then the build review's fixes (architect, enforcement, testing, method) in 3cd461f8. Every box below is ticked with its evidence. Frozen 2026-11-06 against `main` 2e071307 (eess-md 0.16.0, kernel 0.10.1), after the D1 check passed it. Written 2026-11-06 at the maintainer's direction, for
  [bug 0520](../../bugs/fixed/0520-waivers-in-a-text-corpus-are-refused.md) and
  [proposal 028](../../proposals/promoted/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s ask 2.
  Revised the same day after an architect review and an enforcement review of the first design. Both
  found its `WeakRef` lifetime unsound (measured: a text corpus is collected while its documents are
  still in use). The enforcement review also found its longest-prefix lookup a false green on
  overlapping roots. Revised again the same day after both re-checked the revision: a
  registered reader function cannot be compared, so the kernel now takes the texts. Both re-checks
  said the edit needs no further full round; the architect asked that D1 alone be checked once more.
  Each revision is recorded under _Corrections_. The D1 check passed it for the freeze once its one Important finding, segment collapsing in the normalisation, was written in; it is.
- **Implements:** [proposal 028](../../proposals/promoted/028-md-one-documents-field-read-as-the-gate-reads-it.md)
  (ask 2; ask 1 is [plan 0624](./0624-md-one-documents-field-value-public.md)'s)
- **Fixes:** [bug 0520](../../bugs/fixed/0520-waivers-in-a-text-corpus-are-refused.md)
- **Priority:** Medium. Nothing passes that should fail today: the refusal is loud. But a named
  consumer waits on it: a consuming project's plan 125 reads one record's field from text, and a
  valid record that holds a waiver directive throws.
- **Effort:** Medium to Large, about a day. The ADR, the kernel registry and its tests are most of
  it. eess-md and the docs are small.
- **Created:** 2026-11-06
- **Decided, each overrulable:**
  - **One plan and one PR, a commit per phase.** The architect review proposed three PRs: the ADR,
    the kernel, then eess-md. They share one root cause and each step needs the one before it, and
    each extra PR is a full CI run ([spike 0631](../../spikes/0631-where-ci-time-goes.md)).
  - The binding decision is a new ADR, written in Phase 0 before any code. It extends
    [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) and records its departure
    from [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md).

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
- **Cost** (repeat reads; see the build review's correction below for the first read): one corpus over the 590 others builds in 579–638 ms. Reading every record's field with
  `resolveFieldValue`, `{ label: 'State', forms: ['bold', 'plain'], region: { section: 'Status' } }`,
  takes 150–171 ms. A corpus per record costs about the same per record, 0.9–1.6 ms. Method: the files are read before timing, and each figure is two warm runs here; the method review re-measured six warm runs (591–623 ms, 146–171 ms, 1.21–1.27 ms a record).

So once the refusal goes, ask 2 needs no new parser and no new API: `corpusFromText` plus
`resolveFieldValue`. Of the proposal review's three answers (a private parse, a public parser, or
[bug 0520](../../bugs/fixed/0520-waivers-in-a-text-corpus-are-refused.md) plus documentation), that is the
third.

## Design

### D1. The kernel holds a claimed root's texts, and reads a claimed path only from them

A new kernel function, on `@nielspeter/eess/internal` (family plumbing,
[ADR-011](../../../adr/011-the-kernels-public-api-is-explicit.md)):

```ts
/** Claim `root`: each file under it is these texts, keyed by path relative to `root`, and nothing else. */
registerSourceText(root: string, files: Readonly<Record<string, string>>): void
```

**The kernel takes the texts, not a reader.** The first revision passed a function. Both re-checks
found that a function cannot be compared, so the kernel could not decide whether a second
registration of a root held the same text. Comparing identity refuses equal maps; accepting any
re-registration lets one corpus's waivers read another's text. With the texts, the kernel:

- **copies the map into a `Map` when it registers,** checking that every value is a string (a `'__proto__'` key assigned into `{}` sets the prototype; measured by the D1 check's probe script against `packages/md/dist`, 2026-11-06), so a caller who changes the map afterwards cannot change the
  text a waiver is read from. The first revision's reader read the caller's live map, measured by the
  enforcement re-check;
- **owns the read,** so no dialect code runs inside the `try` that swallows a read failure (`packages/core/src/execute-rule.ts:149`, its `catch` at `:171-177`). The kernel's own lookup outcomes (an unknown shape, a path under two roots, a claimed root now on disk, a reported path on disk, a miss) are decided outside that `try`, so none of them can be silenced;
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
- **Each refusal is the kernel's `ArchConfigError` in its own words,** naming the root and the root it collides with: a root names one text per path for the realm. eess-md catches it in `corpusFromText` and adds its remedy (leave `root` unset, or name a root used for one map only), so the registration carries no wording and the shared shape stays plain data. _Revised by [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)'s decision review, which found the signature could not carry the wording this bullet first said it passed._

**The lifetime is strong, for the realm.**

- **Why not the first design's `WeakRef`:** both reviews measured that a text corpus can be collected
  while its documents still reach a rule. The kernel's `correspondence()` builds violations from bare
  path strings (`packages/core/src/correspondence.ts:67-76`). `ParsedCodeBlocks` keeps documents, not
  the corpus (`packages/md/src/model/code-block-parse.ts:95-107`).
- **The bound:** one entry per distinct root and map, for the life of the realm (a worker thread or a `vm` context has its own `globalThis`). This repository's whole
  `work/` is 8.6 MB on disk (`du -sb work`, non-`.md` files included; the 592 `.md` files are 8.51 MB), and vitest isolates each test file by default. Under `isolate: false` a worker
  shares the registry across files, so a caller-set root reused with other text in another file is
  refused, as it would be within one file. Nobody has asked whether a board that builds one corpus per
  record version runs long enough for the growth to matter; releasing a root is out of scope below.

**Every kernel copy shares the registry,** through one object on `globalThis` under a `Symbol.for`
key. Two copies of the kernel in one install tree (the module-state split `RELEASING.md:284-290`
records) see the same texts.

- **The shape is versioned,** a `version` field on the shared object. A kernel that finds a shape it
  does not know refuses loudly rather than reading it.
- **It holds plain data,** roots and their copied maps. Each kernel copy reads it as `unknown` through a type guard (also how [ADR-005](../../../adr/005-no-any-no-type-assertions.md) is met); an unknown shape, or a path under two roots in it, is a finding, never a pick.

**The lookup, in `applyFilters`, in [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) clause 5's order,** decided outside the swallowing `try`.

- **The violating file's path is normalised as the root is,** so a Windows `join(root, rel)` finds its
  root. The text is parsed under the violation's own `file` as reported, because a directive applies
  to a violation whose `file` equals its own.
- **If the registry cannot be read, every violating path is a finding,** claimed, unclaimed or relative: read as empty, it would send a claimed path to disk.
- **Otherwise a path under no claimed root, or a relative path, is read from disk,** as today.
- **For a path under a claimed root, the first that holds decides:** the path is under two roots; the root exists on disk; the reported path exists on disk (only a spelling that normalises under the root, a `\` in a directory name or `..` through a symlink, reaches this); each is a finding. Otherwise the texts are read, and a path they do not hold is a finding. Nothing claimed is
  ever read from disk; a real file under a claimed root is a finding, never a disk read. _The decision
  review's revision first said "a real file wins"; its diff check found that reading lets a root
  created on disk after it was claimed waive a finding computed from the registered text, silently,
  and the order above replaced it._
- **Each finding is unsuppressable** (`bypassFilters`, an error even under `.warn()`), carries the
  rule's id when there is one, names the file, the root, its cause and its remedy, and leaves the
  violation unwaived. One finding per rule and file.

**The text is parsed unchanged.** It goes through `parseExclusionComments`, with whatever
[ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) masking applies on disk: parity, not a new guarantee.

- [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown row is `pending`.
- The enforcement review measured a directive inside a `<div>`, a `<pre>`, or a fence in a
  blockquote being read as a waiver, on disk and so here. That is
  [bug 0291](../../bugs/0291-the-markdown-masker-honours-a-directive-inside-code.md)'s class, inherited,
  not introduced.

**The scope is every kernel terminal, not every terminal.**

- eess-ts has its own `applyFilters` (`packages/ts/src/core/execute-rule.ts:282`, behind an
  `existsSync` at `:280`), which no md violation reaches.
- Crossvalidate's `md-mermaid-er.ts:191` and `md-gherkin.ts:154` call no `applyFilters`
  ([bug 0422](../../bugs/0422-a-waiver-does-not-silence-an-md-mermaid-finding.md)).
- That eess-ts's copy skips an in-memory file is the same defect on another path, recorded as its own
  bug, not added here.

**A departure from [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md), stated.** Every seam so far hands the kernel a value:
`PathUniverse`, `DiskSet`, `sourceEmpty`, [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s `mask`. This one is still a value, the
texts, but it is ambient: registered once and looked up by path, not passed with the rule. Keying by
path is right, because a value on the rule context would never be set by a rule built outside
eess-md's builders. The ADR says so.

**The residual: an old kernel copy without the registry.** eess-crossvalidate allows eess-md
`>=0.14.0` as a peer, so an install can hold this release's eess-md with an eess-crossvalidate
still on kernel `^0.10.1`. A correspondence there reads a text corpus's file from disk, finds
nothing, and the waived violation stays red. That is a false red, never a false green, with nothing
explaining it. The ADR states it with its remedy, upgrade eess-crossvalidate. The release raises crossvalidate's kernel range through `changeset version` (`updateInternalDependencies: "patch"`), not through `RELEASING.md` step 3a, which raises its peer floors.

### D2. `corpusFromText` names its default root by its content

The default root becomes `/__eess_text_corpus__/<hash>`.

- **`<hash>` is a hash of a framed encoding,** at least 64 bits: the sorted entries as JSON,
  `[[key, text], …]`. An unframed concatenation collides: the enforcement re-check showed two maps
  `corpusFromText` accepts with one hash.
- **The hash only names a root.** Equality is still decided by content, under D1.
- **It is deterministic,** so `file` no longer depends on test order. `file` reaches stderr lines,
  annotations and the baseline's relative paths.
- **Equal maps share a root;** different maps get sibling roots, which never overlap.
- **Cost:** framing the map (sorted entries as JSON) and hashing it with sha256 takes 38–47 ms over all of `work/`, about 7% of building the corpus (measured by the method review; the 11–13 ms first quoted was the hash of an already-built string).
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
[ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1 is untouched.

## Phases

### Phase 0 — the ADR

- [x] The new ADR, decided from D1 and D2, is [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) (Accepted since), written 2026-11-06 and revised the same day from its decision review (architect, enforcement, method). The review moved points into it that this plan had not decided, and D1 and the Test inventory follow it: the lookup's order (in which, after the diff check, a real file under a claimed root is a finding, never a disk read), the disk bounding a forgery, the kernel wording its own refusals, and the text parsed under the violation's own `file`:
  - it extends [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md) (`**Extends:**`, with the link back);
  - it states its departure from [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md) (the fact is [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s kind; only the ambient lookup is new), and the residual above with its remedy;
  - its `pending` rows name the mutant each must catch (row 9 by the clause 5 row's tests); they cannot cite test files that do not exist yet (`check:corpus` requires a cited path to exist), so the closing box below cites them;
  - its Enforcement table uses Tier 2 rows against deterministic behaviour, with no GC-dependent row;
  - its row goes in `CLAUDE.md`'s ADR index.
- [x] The ADR is reviewed as a decision before any Phase 1 code is written: reviewed by an architect, an enforcement and a method lens, revised, checked on the changed text by each, revised once more on those checks, and accepted with their edits, 2026-11-06. The edits the accepting commit added were the ones the last checks asked for: the unreadable registry first, for every path (enforcement's blocking finding); step 3's test built from a `\` in a directory name; three named mutants; the fenced case in row 7. Enforcement and method then confirmed that commit.
- [x] On that pass, its Status became Accepted, in the ADR and in `CLAUDE.md`'s index row.

### Phase 1 — the kernel holds a claimed root's texts

Built 2026-11-06 in 25f46e74: `packages/core/src/source-roots.ts`, the lookup in
`packages/core/src/execute-rule.ts`, and `packages/core/tests/source-text-registry.test.ts` (24 tests).
The core suite passes (423 tests in 44 files, 1.9 s); typecheck, lint and `check:guardrails` are clean,
with no guardrails warning in the new or changed files.

- [x] `registerSourceText` in `packages/core/src/source-roots.ts`, on a versioned object on
      `globalThis` under a `Symbol.for` key, exported from `@nielspeter/eess/internal`.
- [x] The registration rules:
  - the root is normalised, with `posix.normalize`;
  - a root that exists on disk is refused;
  - an overlapping root is refused, segment-wise, after normalising;
  - only an exactly equal map is accepted again;
  - the map is copied, refusing a non-string value and a non-canonical key.
- [x] `applyFilters` normalises the violating path to find a root and key, and parses under the
      reported `file`. An unreadable registry makes every violating path a finding. Otherwise an
      unclaimed or relative path is read from disk, and a claimed path follows [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) clause 5's
      order. All decided outside the swallowing `try`. Each finding carries the rule's id when it has
      one, else the rule's description, else `unnamed`.
- [x] done-otherwise — red first, through the kernel's public terminal, over a virtual file with
      registered texts. The tests were written after the code, not before it. Their red against the
      pre-change behaviour is shown by _the registered read skipped_, the nearest mutant to that behaviour (the pre-change kernel had no `registerSourceText` at all, so every test would fail at import, and none of the lookup's findings): 7 of the 24 go red, among them the `correspondence()` test ("with the directive in the
      registered text, the finding is waived", against its control with `examined > 0`), and the
      undocumented waiver's promoted finding.
- [x] The kernel sabotage matrix, run in a worktree with its own install, one mutant at a time
      against the new test file; the restored tree passed 24 of 24. Every mutant red:

      | mutant | tests red |
      | --- | --- |
      | the registered read skipped, so it falls to disk | 7 |
      | an unreadable store read as empty | 1 (step 1) |
      | a path under two roots resolved by a pick | 1 (step 2) |
      | the root-on-disk check removed, at lookup | 1 (step 3) |
      | the path-on-disk check removed | 1 (step 4) |
      | a real file read before the root-on-disk check | 2 (steps 3, 4) |
      | the miss finding turned into a disk read | 2 (step 6, one per rule and file) |
      | the on-disk refusal removed, at registration | 1 |
      | the overlap refusal removed | 1 |
      | the segment comparison made a string prefix | 1 (`/t/1` beside `/t/10`) |
      | the root normalised without collapsing segments | 3 |
      | a re-registration accepted without comparing | 3 |
      | the map not copied (the caller's object read at lookup) | 1 |
      | the registry kept as module state | 4 (the second kernel copy among them) |
      | an unknown shape overwritten at registration | 1 |
      | parsed under the normalised path | 2 |

      _The first "map not copied" mutant built a new `Map` from the caller's object at registration,
      which is still a copy, and survived; the mutant was wrong, not the test. Rerun as the caller's
      object read at lookup, it went red._

### Phase 2 — `corpusFromText` registers and stops refusing

Built 2026-11-06 in 6766b8b0 and the commit after it: `packages/md/src/corpus.ts`,
`packages/md/tests/text-corpus-waivers.test.ts` (13 tests),
`packages/crossvalidate/tests/md-mermaid-text-corpus-waiver.test.ts` (2), the fixture row
`source-text/registered-waiver-read` (`scripts/nonvacuity/bad-text-corpus-waiver.mjs`, claimed under
`check:corpus`), and three changesets. The md suite (1,238 tests) and the crossvalidate suite (146)
pass; typecheck, `check:arch`, `check:family`, `check:guardrails`, `check:release` and `check:corpus`
are clean.

- [x] The content-hashed default root, and the reserved prefix refused.
- [x] `corpusFromText` registers its map, and `refuseWaivers` is removed. The kernel now owns the
      root-on-disk check; eess-md rewords the kernel's refusals with its remedy.
- [x] Its JSDoc and `docs/markdown.md`'s `corpusFromText` section are updated (the three
      correspondence recipes that identify a document by `relPath`, `docs/markdown.md:1347`, `:1981`,
      `:1993`, are named in [bug 0633](../../bugs/0633-a-correspondence-reports-a-document-by-its-relative-path.md), not changed here). The two refusal tests are removed, and the new
      file asserts the opposite, with parity.
- [x] done-otherwise — over a text corpus, each with parity against `corpus()` over the same files on
      disk under a different root, compared by `relPath`: a waiver applies against its control; an
      undocumented one is the promoted finding; an unused one warns (stderr captured, equal on both
      sides with the roots stripped); a malformed one reaches stderr only on a document with a
      violation; a directive in a fenced block applies on neither side. Written after the code, so
      "red first" is shown by the matrix below.
- [x] A crossvalidate binding that goes through `correspondence()` and reports the document's
      absolute file (`embeddedDiagramsMatchCode`) honours a waiver in a text corpus's document,
      against its control, with `examined > 0`. Not `adrCitationsResolve`, which reports a relative
      path ([bug 0633](../../bugs/0633-a-correspondence-reports-a-document-by-its-relative-path.md)).
- [x] The eess-ts copy's in-memory-file gap is recorded as its own bug: [bug 0634](../../bugs/0634-eess-ts-reads-no-waiver-in-an-in-memory-file.md), filed with
      [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)'s decision review so its clause 8 names a record that exists.
- [x] `apply-fixes`' dry run over a text corpus is recorded as its own bug: [bug 0635](../../bugs/0635-apply-fixes-cannot-preview-a-fix-in-a-text-corpus.md), likewise. A
      relative violating path, found by the same review, is [bug 0633](../../bugs/0633-a-correspondence-reports-a-document-by-its-relative-path.md).
- [x] The Phase 2 sabotage matrix, run in worktrees with their own install, rebuilding after each
      mutant, against `packages/md/tests/text-corpus-waivers.test.ts` and `packages/md/tests/corpus-from-text.test.ts` (38 tests together then), the crossvalidate test (2) and the fixture; the restored tree passed 38, 2, and the fixture exit 1. Every mutant red. A fixture cell of — means the fixture was run and kept its exit 1; it was sabotaged by registration skipped (exit 0) here, and by _the registered read skipped_ in the build review's matrix below:

      | mutant | md and crossvalidate tests red | fixture |
      | --- | --- | --- |
      | the refusal in `corpusFromText` kept | 12 | — |
      | registration skipped | 9 | exit 0 (vacuous) |
      | the default root made constant | 28 | — |
      | the hash over keys only | 10 | — |
      | the hash over texts only | 2 | — |
      | registered text parsed without the markdown mask | 1 (the fenced directive) | — |

      _The mask mutant first survived, twice. The fenced-directive test put a single-line directive
      inside the fence, where it covers only the fence's closing line, so it passed masked or not.
      Rewritten as a region opened inside the fence and closed after the pointer, it still survived,
      because the region's end was written `<!-- eess-exclude-end <rule> -->` and the kernel reads
      only `<!-- eess-exclude-end -->`: the region never closed. With the end fixed, the two parses
      differ (masked: no exclusion; unmasked: lines 4–7 excluded) and the mutant goes red. Both were
      the test's faults, not the code's._

- [x] The matrix run after the build review, on its fixes (3cd461f8), in worktrees with their own install, rebuilding after each mutant, against the core,
      md and crossvalidate test files and the fixture. Every mutant red; the restored tree red 0 and
      the fixture exit 1:

      | mutant | tests red | fixture |
      | --- | --- | --- |
      | the found shape not named | 3 | exit 1 |
      | the malformed case not told apart | 1 | exit 1 |
      | the per-entry shape checks removed | 1 | exit 1 |
      | a failed `globalThis` write ignored | 1 | exit 1 |
      | the root-exists check, the as-written half removed | 1 | exit 1 |
      | the root-exists check, the normalised half removed | 1 | exit 1 |
      | `bypassFilters` dropped from the source finding | 9 | exit 1 |
      | the registered read skipped | 14 | exit 0 (vacuous) |
      | the reserved-prefix refusal removed | 1 | exit 1 |
      | eess-md's root remedy never added | 1 | exit 1 |
      | eess-md's root remedy always added | 1 | exit 1 |

      _The two remedy mutants first failed to build: the literal `false` and `true` left a parameter
      unused, which TypeScript refuses. Rerun as `(rootSet && Date.now() < 0)` and
      `(rootSet || Date.now() > 0)`, each went red. The mutant's fault, not the code's._

      The review's fixes: the unreadable registry names both shapes and tells a malformed one apart;
      the registry is read once per rule run; a failed write to `globalThis` is refused; the test-only
      reset left `/internal` (a test drops the key itself, so no export releases a root); eess-md adds
      its root remedy only to a root the caller set; the md stderr parity strips the roots it knows,
      so it holds whatever the temp directory is; vitest isolation is pinned in eess-md; the fixture
      row moved to the end of the list, so no other fixture changes shard; two old tests that could
      no longer fail were removed. The core suite is 427 tests, md 1,237, crossvalidate 146.

- [x] The fix check (2026-11-06, enforcement and method) closed every finding above and found two
      more, both fixed here. A value no kernel writes (`null`, a string, an object with no numeric
      version) was blamed on two kernel copies, with a remedy that cannot clear it; it is now named
      as written past `registerSourceText`, with that remedy. The lookup test tried only `//` and
      `\` spellings of a reported path, while row 3 claimed `/./` and `/../` too; both are now in it.
      Each fix's mutant went red, one test each (`malformed: false` restored for the three values;
      the lookup reduced to separators and `//`, without `.` and `..`). The core suite is 428.

- [x] The Phase 1 kernel matrix re-run on the code that ships (2026-11-06, the fix check's N3):
      3cd461f8 restructured the lookup after that matrix ran, so its 16 mutants were applied again
      to HEAD plus the fixes above, in a worktree with its own install, one at a time against
      `packages/core/tests/source-text-registry.test.ts` (13 s in all). The restored tree red 0
      before and after; every mutant red: the registered read skipped 7; an unreadable store read
      as empty 4; a pick between two roots 1; the root-on-disk check at lookup 1; the path-on-disk
      check 1; a real file read before the root check 2; the miss turned into a disk read 3; the
      on-disk refusal at registration 2; the overlap refusal 1; a string-prefix comparison 1; a root
      not collapsing segments 4; a re-registration not compared 3; the map not copied 2; module
      state 8; an unknown shape overwritten 1; parsed under the normalised path 2.

- [x] At close: [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)'s `pending` rows cite their test files by path and become `gated`, each with the mutants that red it; rows 8 and the residuals stay `manual`, the [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md) relation `n/a`.

### Phase 3 — ask 2, documented

- [x] `docs/markdown.md`, "Reading one record's field from text": `corpusFromText` +
      `resolveFieldValue`, the measured cost and its source, and "leave `root` unset". The section
      heading "A corpus from text, for tests" is kept, so `docs/migrating-to-0.15.md`'s anchor holds.
- [x] A test of [proposal 028](../../proposals/promoted/028-md-one-documents-field-read-as-the-gate-reads-it.md)'s waiver break class: a record holding a waiver directive reads its field
      through `corpusFromText` + `resolveFieldValue`
      (`packages/md/tests/text-corpus-waivers.test.ts`).

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
  - an unknown shape version on the shared object is refused at registration, and is a finding at lookup;
  - a `'__proto__'` key and a non-string value are handled (kept as a key; refused).
- **Kernel, lookup,** one test per step of clause 5's order, each with the violation still reported:
  - an unclaimed path is read from disk;
  - an unreadable store makes a claimed, an unclaimed and a relative path each a finding, naming both shapes; one shape in the install clears it;
  - a store written directly with one path under two roots gives the finding;
  - a root created on disk after registering, holding a file whose waiver differs from the registered text, gives the finding, and no waiver from either source applies; removing the created
    directory clears it, and the registered waiver applies;
  - a real file in a directory whose name holds a `\`, reported by a spelling that normalises under a
    root whose parent is not on disk, gives the path-on-disk finding, asserted by its own cause, and registering the texts under another root clears it;
  - the texts are used for a claimed path, and the text is parsed under the reported `file`: a
    backslash- or `//`-spelled violating path finds its root and its waiver applies, and an
    undocumented waiver's finding lands on the reported `file`;
  - a miss gives the finding, an error under `.warn()`, and its remedy clears it;
  - each test asserts its own step's cause and remedy, and there is one finding per rule and file;
  - a second kernel copy sees the registry: `vi.resetModules()` gives a second module-state
    instance from `src` (measured by the D1 check in vitest 4.1, 2026-11-06), which registers while
    the first reads. A plain re-import under another URL would share its imports and could not fail.
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
  - parity with `corpus()` over the same files on disk under a different root, compared by `relPath`, so the text corpus's root is never on disk, for a valid, an undocumented, an unused, a malformed and a fenced directive;
  - a malformed directive reaches stderr only on a document with a violation.
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
  - the on-disk refusal removed, at registration and at lookup (the root-on-disk step);
  - a re-registration accepted without comparing;
  - the map not copied;
  - the registry kept as module state;
  - the hash over keys only, and over texts only;
  - the refusal in `corpusFromText` kept;
  - parsed under the normalised path;
  - a real file read before the root-on-disk check;
  - an unreadable store read as empty;
  - a path under two roots resolved by a pick;
  - the path-on-disk check removed;
  - registered text parsed without the markdown mask;
  - the default root made constant.

## Out of scope

- **A public document parser, or a reader that takes text directly:** ask 2's other two answers. The
  measurement says neither is needed; a later asker who cannot build a corpus reopens it.
- **Releasing a registered root in a long-running process:** not needed today. If it is, a released
  root leaves a marker, so a later violation under it is a finding, never a disk read.
- **`apply-fixes` over a text corpus.** A dry run (`write: false`) would preview a fix there, which is
  a real use. It is not built here; it is [bug 0635](../../bugs/0635-apply-fixes-cannot-preview-a-fix-in-a-text-corpus.md).

## Release

- **`@nielspeter/eess` minor:** a new internal export, on the precedent of 0.8.0's new `/internal` exports. A patch would satisfy every published `^0.10.1`, letting npm dedupe to one kernel and mostly removing the residual; the minor is chosen for the precedent, and the residual is its stated cost. The kernel minor leaves every dialect's
  `^0.10.1`, so `changeset version` patch-bumps eess-ts, eess-mermaid and eess-gherkin too.
- **`@nielspeter/eess-md` minor, marked `**Breaking**`:**
  - `corpusFromText` accepts the waivers it refused;
  - its default root changes, which the docs already told callers not to rely on;
  - it newly refuses a caller-set root reused with other text, an overlapping root (including two spellings of one), a relative root (documented as absolute, never checked, `packages/md/src/corpus.ts:213`), and the reserved prefix.

  The changeset names eess-crossvalidate, which depends on it ([bug 0185](../../bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)).

- **`@nielspeter/eess-crossvalidate`:** its kernel range rises through `changeset version`, and its dialect peer floors through `RELEASING.md` step 3a. Its changeset says why, and names the residual's
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

- that [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s masking guarantee holds, but [ADR-012](../../../adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md)'s markdown row is `pending`;
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

**At the freeze, and from [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md)'s decision review (2026-11-06).** The freeze commit changed the
design without an entry here:

- the two-kernel test moved from a physical copy of `dist` to `vi.resetModules()`;
- the try/catch pointer was corrected;
- the remedy wording moved to the dialect, and the review then moved it again: the kernel words its
  own refusals and eess-md adds its remedy;
- the lookup reads neither source for a root now on disk;
- the `__proto__` check and the patch-or-minor argument were added.

A Draft's field-read figure, "150–388 ms, depending on the reader's options", became 150–171 ms for
the one stated option set. The hash cost of 11–13 ms leaves out the framing, which brings it to
38–47 ms. The ROADMAP row kept the first design's words until the decision review found it.

**The decision review's diff checks and the acceptance (2026-11-06).** The diff checks found "a real
file wins" (the revision's lookup) unsafe: a root created on disk after it was claimed could waive a
finding computed from the registered text. The lookup became fail-closed in 573c54df. The next checks
found the unreadable registry checked after the claimed/unclaimed split, a step-4 test that could not
reach step 4, a mutant that described correct code, and list items merged by an edit helper that let
an item's leading spaces swallow the newline before it. 4ccda21f fixed them and accepted [ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md); both
checks of that commit confirmed it, and found step 3's remedy unable to clear its own `\` case, now
reworded.

**The build review (2026-11-06).** The docs' cost figures, and this plan's, were repeat reads: eess-md
memoises parsed texts per process, and the texts measured were already in that memo. A board reading
another branch reads texts the process has not seen. The build review measured the first read: one
corpus over 597 files builds in 4.5–4.8 s, not about 0.6 s, and a corpus per record costs about
8.5 ms, not 0.9–1.6 ms. The first design's 9.7 ms, listed above as an overclaim from a cold run, was
the honest first-read cost; the "correction" replaced it with a repeat-read figure. The docs now give
both, with the example's own options (`Status`, the header region, over 597 files with boards and
indexes; the repeat figures above used `State` in a `Status` section over 590 records, so the two
per-record repeat figures, 0.9–1.6 ms and about 1.7 ms, differ by setup). Method for the docs'
figures: the files read into memory before timing, one process, three runs, a new map and root per
run, eess-md's `dist` at 819fbaf5. Reading every document's field took 0.41–0.48 s on the first
read, and 412–500 ms on repeat in the fix check's own run: the memo holds parses, not field reads. The review also found the unreadable registry naming only its
own shape ([ADR-024](../../../adr/024-a-claimed-files-waivers-are-read-from-its-registered-text.md) clause 6 requires both), eess-md's root remedy added where the root was already
unset, a parity test that failed under any temp directory but `/tmp`, an `/internal` reset that
released every root against the ADR's lifetime, and this plan's Release section claiming the md
changeset named eess-crossvalidate before it did. Each is fixed above.

Deferred: none. Found along the way and recorded, not built: [bug 0633](../../bugs/0633-a-correspondence-reports-a-document-by-its-relative-path.md), [bug 0634](../../bugs/0634-eess-ts-reads-no-waiver-in-an-in-memory-file.md), [bug 0635](../../bugs/0635-apply-fixes-cannot-preview-a-fix-in-a-text-corpus.md).
