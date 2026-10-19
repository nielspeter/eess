# Plan 0455: a corpus built from text

## Status

- **State:** Done — built 2026-10-19. Written 2026-10-17 from proposal 017's maintainer acceptance
  (block 7); revised 2026-10-18 after PR #235's review (architect · product · enforcement · method ·
  testing).
- **Implements:** proposal 017
- **Priority:** Medium — two of the three adopters asked for it (017, "Consumer feedback"), and the
  third wants it in tests only; this repository's own md tests build their corpora in temporary
  directories or fixture trees today.
- **Effort:** Small — one constructor, one internal registry that `pointers()` already needs, a
  parity test over the existing fixture trees.
- **Created:** 2026-10-17
- **Builds after:** plan 0457, in the order the maintainer set on 2026-10-18 (0458 → 0456 → 0454 →
  0457 → 0455 → 0459). It needs nothing from 0456, 0454 or 0457: its example uses only
  `links().should().resolve()`, which the eess-md root exports today. It needs plan 0458's examples
  gate.

## Problem

A caller who writes an eess-md rule tests it against a corpus, and the only constructor is
`corpus()` (`packages/md/src/corpus.ts:61`), which walks a directory on disk. So every test either
keeps a fixture tree in the repository or writes one to a temporary directory. Measured 2026-10-18
(`grep -hoE` over the test files, counting call sites, not imports):

- `packages/md/tests`: 61 `corpus(` calls in all 22 test files (a 23rd `.test.ts`, `tests/fixtures/corpus/src/example.test.ts`, is a fixture). 8 files create temporary
  directories (11 `mkdtemp`/`mkdtempSync` calls); 17 point `cwd` at a fixture tree under
  `packages/md/tests/fixtures` (186 files).
- `packages/crossvalidate/tests`: 8 `corpus(` calls in 6 test files; 3 test files create temporary
  directories (3 calls; a fourth `mkdtempSync` is in a fixture script,
  `tests/fixtures/mermaid-parser/hook/settle.mjs:32`, not a test).
- One test builds a `Corpus` by hand (`packages/md/tests/resolve-link.test.ts:169`), which works only
  because `Corpus` is an interface whose three members happen to be enough for link resolution.

Adopters do the same, by hand-written document literals or temporary directories (017, block 7).

A hand-built `Corpus` is not enough, because resolution reads the disk behind the interface's back:

- `pointerResolves` counts a target file's lines with `readFileSync(join(corpus.root, rel))`
  (`packages/md/src/conditions/pointer-resolve.ts:89`).
- The kernel reads each violating file from disk to find waiver comments
  (`packages/core/src/execute-rule.ts:150`), and discards the read silently when the path does not
  exist (`:171`, "violation paths may be virtual").
- Why a file was not loaded (`not-in-corpus` reasons) needs the matchers `corpus()` registers
  (`packages/md/src/model/resolve-link.ts:100`); a hand-built `Corpus` has none, so an unloaded
  `.md` file is always reported as `outside-roots` (`:186`).

So "a corpus in memory" is not a literal: it has to resolve links and pointers as `corpus()` does,
or a caller's test passes on a corpus that behaves differently from the one in CI.

## Design

**One constructor, `corpusFromText(files, options?)`, exported from the eess-md root.** `files` maps
repo-relative POSIX paths to text: the Markdown documents and any other file a link or pointer may
name (`src/app.ts`). It returns an ordinary `Corpus`, so every builder, condition and preset takes it
unchanged. The name follows mermaid's `diagram(input)`, which takes text. eess-gherkin's
`parseFeature(text, file, relPath)` (`packages/gherkin/src/load.ts:49`) also reads from text, but
yields one feature rather than a set, so it is not a corpus to copy.

```ts
import { corpusFromText, pointers } from '@nielspeter/eess-md'

const c = corpusFromText({
  'docs/guide.md': '# Guide\n\nSee `src/app.ts:2`.\n',
  'src/app.ts': 'export const a = 1\n',
})
pointers(c).that().areLive().should().resolve().check()
```

**It resolves as `corpus()` does, because it is `corpus()` with the walk swapped out.** The body of
`corpus()` after the walk (`packages/md/src/corpus.ts:62-98`) becomes one internal function,
`assembleCorpus(root, paths, read, options)`, which both constructors call:

- `corpus()` passes the walked file list and a disk reader;
- `corpusFromText()` passes `Object.keys(files)` and a reader over the map.

So `roots`, `frozen`, `ignore`, the `fileIndex`, `buildDocument` and the corpus's registered internals
are one code path. The one difference is `roots`: optional here, defaulting to every `.md` key given.
That default names no folder or document shape, only "what you handed me" (017's principle).

**`frozen` is `corpus()`'s, default included.** `corpusFromText` shares `DEFAULT_FROZEN`
(`corpus.ts:53`) through `assembleCorpus`, so a test behaves as CI does. 017's second-Review decision 2
calls that default a document-shape default on the root primitive and owes a flagged break to remove
it; that break now moves both constructors, and its changeset names both.

Note 2026-10-19: [ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md) clause 1 says
eess-md's root fixes no document shape, with `corpus()`'s `DEFAULT_FROZEN` the one known exception,
and allows `corpusFromText` to share that default only because it ships before
[bug 0497](../../bugs/0497-corpus-freezes-two-folder-names-by-default.md)'s fix, which removes the
default from both constructors as one flagged break.

**One registry for what a corpus knows about itself.** Today `registerCorpusMatchers`
(`resolve-link.ts:100`) keeps a `WeakMap<Corpus, CorpusMatchers>`. A second `WeakMap` for the reader,
set at the same moment, could drift from it: one constructor registers one table and forgets the
other. So the matchers registry widens to `{ inRoots, ignored, read }`, set once in `assembleCorpus`,
and `readCorpusFile(corpus, rel)` reads through it. A `Corpus` built by hand has no entry, so it keeps
today's two behaviours, `outside-roots` and a disk read, and the public `Corpus` interface does not
change. `externalRoots` stay on disk for both constructors: they name checkouts outside the
repository by definition.

**Where a pointer's target lives, settled from the code:** in a text corpus it is in the map, or it
is not there. There is no mixing of an in-memory Markdown side with a code side on disk. That would
make one corpus resolve against two sources, and `corpus()` already answers "resolve against disk".
A caller who wants their real code uses `corpus()`.

**What cannot behave as on disk is refused, never silently different** (ADR-009, ADR-010):

| input                                                                                   | why                                                                                                                               | result                                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| a loaded document in which the kernel's waiver parser reports any directive (see below) | the kernel reads waivers from disk by path and finds nothing at a virtual one, so the waiver would silently not apply             | `ArchConfigError` naming the document and line, with "test waivers with `corpus()` over a fixture" |
| a path that is absolute, contains `..` or `\`, starts with `./`, or is not normalised   | it has no single repo-relative meaning                                                                                            | `ArchConfigError` naming the path                                                                  |
| a path that is also a directory prefix of another key (`a` and `a/b.md`)                | a file and a directory cannot share a path on disk, so the map would index a tree `corpus()` never could                          | `ArchConfigError` naming both paths                                                                |
| a path under a directory `corpus()` never walks (`BUILTIN_IGNORE`, `corpus.ts:54`)      | the disk walk would never index it, so a test over it would pass on a file CI cannot see                                          | `ArchConfigError` naming the path and the directory                                                |
| a `root` option naming a directory that exists                                          | the kernel's waiver scan and `apply-fixes` read `file` from disk, so a real directory would let a real file stand in for the text | `ArchConfigError`                                                                                  |

**The waiver refusal reads exactly what the kernel would.** `refuseWaivers` calls
`parseExclusionComments(doc.text, doc.file)` with no options, the same call `core/src/execute-rule.ts:151`
makes on a violating file, so the lexer is the same by construction (ADR-012). It refuses when that
call returns any exclusion or any warning: an exclusion would apply on disk, and a malformed or
undocumented directive is reported on disk, so in memory either would differ. A fenced example that
merely documents `eess-exclude`, which the kernel's parse does not read as a directive, is accepted.
The long-term owner of waivers in memory is a source-text capability the kernel takes from its
caller, the same shape as ADR-012's borrowed lexer; it is not an md workaround, and it is out of scope.

`root` defaults to `join(sep, '__eess_text_corpus__')`, which documents carry in `file` as on disk.
The caller may set it so messages read like their repository, as long as it does not exist.

**Empty is not refused; it is an empty source.** `corpusFromText({})` yields no documents, as
`corpus()` does over an empty tree. Plan 0456, built before this one, makes an empty corpus an empty
source on every md builder (`sourceEmpty()`), so a rule over it gets the kernel's empty-source
configuration finding (`zeroLoadedSourceViolation`, `packages/core/src/vacuity-findings.ts:100`),
which outranks `.expectEmpty()` (ADR-010 §3), exactly as `corpus()` over an empty tree does. The
docs section says so for test authors: a rule meant to pass on "no matching documents" needs at
least one document in the map, so the source is not empty and the selection is.

**Tier.** This is test infrastructure, not a check: it adds no way to fail a build. Its own claim,
"resolves as on disk", is held by the parity test below, which is Tier 2.

**The examples gate (017 decision 3)** is plan 0458's, built first. This plan adds one example under
it: `examples/md/corpus-from-text.test.ts`, "every link resolves", stated as
`links(c).should().resolve()` from the eess-md root only, with its documents kept as files under
`examples/md/fixtures/corpus-from-text/clean/` and `…/violating-broken-link/` (a link to a missing
file; one `violating-<judgement>/` folder per judgement, plan 0458's naming, and the example states
one judgement) and read into `corpusFromText`. The test file has one test titled `clean: …` and one titled
`violating-broken-link: …`: each title starts with its fixture folder's name and a colon, as plan
0458's pairing check requires. It adds fixture folders, not a non-vacuity row: plan 0458's one row discovers every
example under `examples/md/` and swaps each `violating-<judgement>/` folder.

## Phases

All in one pull request.

### Phase 1 — one assembly path, one registry (no behaviour change)

```ts
// packages/md/src/model/resolve-link.ts — the existing registry, widened
export interface CorpusInternals {
  readonly inRoots: (relPath: string) => boolean
  readonly ignored: (relPath: string) => boolean
  readonly read: (relPath: string) => string
}
const internalsOf = new WeakMap<Corpus, CorpusInternals>()
export function registerCorpusInternals(corpus: Corpus, internals: CorpusInternals): void {
  internalsOf.set(corpus, internals)
}

/** The text of a file in the corpus's index: through the corpus that built it, else from disk. */
export function readCorpusFile(corpus: Corpus, relPath: string): string {
  const read = internalsOf.get(corpus)?.read
  return read !== undefined ? read(relPath) : readFileSync(join(corpus.root, relPath), 'utf8')
}
```

```ts
// packages/md/src/corpus.ts
function assembleCorpus(
  root: string,
  paths: readonly string[],
  read: (relPath: string) => string,
  options: AssembleOptions,
): Corpus {
  // today's corpus.ts:62-98, with readFileSync(abs) replaced by read(rel)
  // …
  registerCorpusInternals(loaded, { inRoots: matchesRoot, ignored: matchesIgnore, read })
  return loaded
}

export function corpus(options: CorpusOptions): Corpus {
  const root = options.cwd ?? process.cwd()
  const paths = walkFiles(root, root, new Set(BUILTIN_IGNORE))
  return assembleCorpus(root, paths, (rel) => readFileSync(join(root, rel), 'utf8'), options)
}
```

`registerCorpusMatchers`' one caller moves to `registerCorpusInternals`; the matcher lookup at
`resolve-link.ts:182` reads the same entry. `pointer-resolve.ts:89` becomes
`readCorpusFile(corpus, rel).split('\n').length`. `readCorpusFile` is not exported from the package
root; `/internal` gets it only if eess-crossvalidate needs it, and today nothing in
`packages/crossvalidate/src` reads `corpus.root` (measured).

### Phase 2 — `corpusFromText`

```ts
export interface TextCorpusOptions {
  /** Globs selecting the documents. Defaults to every `.md` path in `files`. */
  readonly roots?: readonly string[]
  readonly frozen?: readonly string[]
  readonly ignore?: readonly string[]
  /** The absolute root documents report in `file`. Must not exist on disk. */
  readonly root?: string
}

export function corpusFromText(
  files: Readonly<Record<string, string>>,
  options: TextCorpusOptions = {},
): Corpus {
  const root = options.root ?? join(sep, '__eess_text_corpus__')
  if (existsSync(root)) throw new ArchConfigError(/* … */)
  const paths = Object.keys(files).sort()
  for (const p of paths) refuseUnlessCanonical(p, paths) // the path rows of the table above
  const roots = options.roots ?? paths.filter((p) => p.endsWith('.md'))
  const read = (rel: string): string => files[rel] ?? '' // only ever called with an indexed path
  const c = assembleCorpus(root, paths, read, { ...options, roots })
  for (const doc of c.documents()) refuseWaivers(doc) // parseExclusionComments(doc.text, doc.file)
  return c
}
```

The `?? ''` is unreachable: `read` is only called for paths taken from the map's own keys. Under
`noUncheckedIndexedAccess` it is the typed way to say so (ADR-005: no `as`). It is also fail-closed
if that ever stops holding: an empty text gives a pointer into it a `stale` finding, never a pass. The keys are sorted so
the document order does not depend on how the caller built the map; `corpus()`'s order is the
filesystem's (`walkFiles` does not sort, `packages/core/src/file-walk.ts:28`), which is why the
parity test compares sets, not arrays.

### Phase 3 — tests, docs, release

- The parity test, the refusals, docs and the changeset (below).
- `docs/markdown.md` gains a "A corpus from text, for tests" section after the `corpus()` options
  (`docs/markdown.md:55`), so `check:surface` counts the export as documented and
  `check:docs-code` compiles its fence.
- The example under plan 0458's gate, as described in Design.

## Files changed

- `packages/md/src/corpus.ts`: `assembleCorpus`, `corpusFromText`, `TextCorpusOptions`
- `packages/md/src/model/resolve-link.ts`: the registry widened to `CorpusInternals`,
  `readCorpusFile`
- `packages/md/src/conditions/pointer-resolve.ts`: the line count reads through the corpus
- `packages/md/src/index.ts`: export `corpusFromText`, `TextCorpusOptions`
- `packages/md/tests/corpus-from-text.test.ts`: new
- `docs/markdown.md`, `packages/md/README.md` (one line)
- `examples/md/corpus-from-text.test.ts` and `examples/md/fixtures/corpus-from-text/`: new
- `.changeset/md-corpus-from-text.md`: `'@nielspeter/eess-md': minor`, additive. Nothing else
  moves: no kernel change, and eess-crossvalidate's sources are untouched.

## Test inventory

- **Parity, the claim itself.** Seven fixture trees under `packages/md/tests/fixtures` (`corpus`,
  `resolve-link`, `linked-back`, `ledger`, `declared-block`, `frontmatter`, `external-root`: 140 `.md`
  and 17 other files, measured) are each read into a map and loaded both ways with the same options.
  Each tree is loaded at the root and with the options its own tests use: `external-root` is loaded
  from `external-root/repo` with `roots: ['docs/**']` and `externalRoots` naming the absolute
  `external-root/legacy` on both sides, as `packages/md/tests/builders/external-root-pointers.test.ts:6`
  does; the `corpus` tree passes `ignore: ['docs/sanctioned-pointer.md']` on both sides, because that
  document holds a waiver.

  The rules compared, per tree:
  - `links(c).should().resolve()`;
  - `pointers(c).that().areLive().should().resolve()`;
  - `pointers(c).that().areFrozen().select(…)` and `taskItems(c).select(…)`, compared as element
    sets (`relPath`, `line`, and for boxes `checked`, `text`, and plan 0454's `mark` and `state`,
    since 0454's reading of an escaped mark reads raw source through the very `read` this plan
    swaps), not as a rule receipt. Each `.select()` comparison has its own guard: a non-empty element
    set on at least one tree, on both sides;
  - `honestyAtClose` with `report: 'return'`.

  Both sides must agree, compared as sorted sets so file-system order cannot matter:
  - documents (`relPath`, `frozen`, `text`) and `fileIndex`;
  - for each rule receipt, `examined`, and the findings with `root` stripped from `file`.

  **The guard against an empty parity is per rule, not per tree.** For each rule above, at least one
  tree must give `examined > 0` and at least one finding without `bypassFilters`, asserted on both
  sides. A configuration finding (an assertion-less rule, a zero-examined rule) is identical on both
  sides by construction, so it does not count. Measured per tree on 2026-10-17 (PR #235's testing
  review): pointers exist only in `corpus` and `external-root`; boxes only in `ledger`,
  `declared-block` and `frontmatter`; frozen documents only in `corpus`, `linked-back` and `ledger`.
  If a rule has no tree with a real finding when built, the build adds one fixture document to a tree,
  not a weaker assertion.

- **Refusals**, one row each, each asserting `ArchConfigError` and the path or document named in its
  message: a waiver in a loaded document (and the same text in a file outside `roots`, which is
  accepted); `/abs.md`, `../x.md`, `./x.md`, `a\\b.md`, `a//b.md`; `a` beside `a/b.md`; a key under
  `node_modules/`; a `root` that is `tmpdir()`.
- **The waiver refusal matches the kernel:** a document whose only `eess-exclude` sits inside a fenced
  code block is accepted exactly when `parseExclusionComments` on the same text returns no exclusion
  and no warning, asserted by calling it beside the constructor.
- **Pointers in memory:** a pointer to a line past a target that exists only in the map is reported
  `stale` at the pointer's own `file` and `line`; one within it is clean. With Phase 1's reader
  bypassed, the read throws `ENOENT` at a root that does not exist, and the row reds.
- **`roots` default:** a map with `a.md` and `src/b.ts` loads one document. `roots: ['docs/**']` over
  a map without `docs/` loads none, and `links(c).should().resolve()`'s receipt equals the receipt of
  the same rule over `corpus({ cwd, roots: ['docs/**'] })` on an empty temporary directory, compared
  in the same test. Both are empty sources after plan 0456, and the row asserts that finding by name
  (`zeroLoadedSourceViolation`'s rule id), so it pins the empty source and not only the agreement.
- **The existing suite unchanged** (Phase 1 is a refactor): `npm test --workspace packages/md` and
  `packages/crossvalidate`.
- **Sabotage matrix**, run once in a worktree, each row a patch at a named place that reds a named
  test:
  1. `pointer-resolve.ts` reads the disk again → the pointers-in-memory row;
  2. `corpusFromText` passes `frozen: []` to `assembleCorpus` → parity on `corpus` and `ledger`
     (documents' `frozen`);
  3. `corpusFromText` drops `options.ignore` before calling `assembleCorpus` (the text side only;
     the registry is set inside `assembleCorpus`, so there is no text-side registration to remove) →
     parity on `resolve-link`, whose own tests pass `ignore` (`packages/md/tests/resolve-link.test.ts:22`),
     and on `corpus` (`ignore: ['docs/sanctioned-pointer.md']`);
  4. `corpusFromText` filters its `paths` to `.md` keys before `assembleCorpus` → parity on `corpus`
     (`fileIndex`, and the pointer to a non-Markdown file);
  5. the waiver refusal removed → its refusal row;
  6. the `BUILTIN_IGNORE` refusal removed → its refusal row;
  7. the `root` existence check removed → its refusal row;
  8. the per-rule guard deleted, and one rule changed to `taskItems(c)` with no condition → the guard's
     own test reds when restored (it is the assertion that would have caught the vacuous rule).
- **Non-vacuity:** block 7 adds no gate, so it adds no `check:nonvacuity` row. Its non-vacuity is the
  per-rule guard and the sabotage matrix. Its example adds a fixture pair under plan 0458's gate,
  whose one discovering row covers it.

## Out of scope

- A text corpus that reads part of its files from disk (Design: one source).
- Reading waivers from memory. That is a kernel capability (ADR-012's shape: source text the kernel
  takes from its caller), refused here instead. If a caller needs it, it is a record of its own.
- Git tracking (bug 0446). A text corpus has no untracked files; whatever bug 0446 decides for
  `corpus()` either passes through `assembleCorpus` or is disk-only, and that bug says which.
- `DEFAULT_FROZEN` (017's second Review, decision 2): this plan shares it and does not change it.
- Any gherkin or mermaid equivalent.

## Open questions

None that block Ready. One consequence is stated rather than decided here: when 017's decision 2
removes `DEFAULT_FROZEN`, both constructors change in that one release.

## Review response — 2026-10-18

- **Testing C1 (the parity guard is weaker than claimed):** the guard is now per rule, counts only
  findings without `bypassFilters`, compares `examined`, and boxes and frozen pointers are compared
  as element sets rather than through an assertion-less rule.
- **Testing I1 (sabotage row 3 cannot red parity):** rows 3 and 4 now patch the text side only, with
  the place named.
- **Testing I2 (order-dependent comparison):** keys are sorted, and parity compares sorted sets.
- **Testing I3 (`external-root` loaded at the wrong root):** loaded from `repo/` with its own `roots`
  and `externalRoots`, as its own test does.
- **Method X2 (three build orders):** the order is the maintainer's 2026-10-18 order, stated once.
- **Method X3 (non-vacuity contract):** the example adds a fixture pair under plan 0458's one
  discovering row.
- **Minors, grouped:** counts re-measured as call sites (method); the already-done "disposition row"
  box removed (method); one registry instead of two `WeakMap`s, the `a`/`a/b.md` refusal and ADR-012
  as the owner of in-memory waivers (architect); the `DEFAULT_FROZEN` consequence, the waiver refusal
  pinned to the kernel's own parse, `parseFeature` cited accurately and an Open questions section
  (product); `stale` asserted by identity, the `roots` default compared against `corpus()` on an empty
  directory, refusals asserting the named path, and a sabotage row for the guard itself (testing).
- **Narrowed, not fixed:** none.

### Round two

- **The empty corpus (architect, product 1, enforcement m16):** stated as an empty source after plan
  0456, with the finding named, the docs note for test authors, and the `roots`-default row asserting
  the finding by name.
- **Sabotage row 3 has no patch site (testing M4):** retargeted to `corpusFromText` dropping
  `options.ignore`, which exists and reds `resolve-link` and `corpus`.
- **Example fixtures (coordinator decision 5):** `clean/` and `violating-broken-link/`, one `clean:` and one `violating-broken-link:` test.
- **Minors:** the `.select()` comparisons get their own non-empty guard (testing M5); boxes compare
  `mark` and `state` (testing M6); `?? ''` is described as fail-closed (enforcement m17); 22 of 22
  test files (method m14).
- **Narrowed, not fixed:** product's note that 0455 could build any time after 0458 is a ROADMAP line,
  outside this plan's file; the plan's `Builds after` already says it needs only 0458.

### Round three

- **Test titles (enforcement m-b, testing m2; coordinator decision 1):** the violating test is titled
  `violating-broken-link: …`, its folder's name and a colon, as plan 0458's contract spells it.
- **Narrowed, not fixed:** none. The other round-three rows about 0455 are marked resolved.

## Build notes — 2026-10-19

Built on the coordinator's instruction while the plan still read `State: Draft`, in the maintainer's
order: 0458, 0456 and 0454 are done; 0457 is not, and this plan needs nothing from it (its example
uses only `links().should().resolve()`). Where the build departed from the text above, each
overrulable:

- **The registry is its own module, `packages/md/src/model/corpus-internals.ts`,** not
  `resolve-link.ts`. Importing `readCorpusFile` from `resolve-link.ts` put `pointer-resolve.ts` under
  plan 0404's rule that a module importing the link resolver must not import `node:path`, and
  `pointer-resolve.ts` needs `node:path` for its external roots. The registry is about the corpus,
  not about links, so it moved; `resolve-link.ts` reads the matchers through `corpusInternals()`.
  The design is unchanged: one `WeakMap`, set once in `assembleCorpus`, holding `inRoots`, `ignored`
  and `read`. `CorpusInternals` is not exported (`check:arch`'s unused-exports rule).
- **`parseExclusionComments` is re-exported from the eess-md root:** `corpus.ts` now imports it from
  the kernel, and `check:family` requires every kernel symbol a dialect's sources import to be
  re-exported (plan 0089).
- **`expectEmptyRoots` (bug 0475) passes through:** it landed after this plan was written, and
  `assembleCorpus` holds the dead-root and declared-empty checks it feeds, so `TextCorpusOptions`
  carries it with `corpus()`'s meaning. The dead-root refusal applies to both constructors.
- **The path refusals are one notion, "not one canonical repo-relative POSIX path":** beyond the
  table, an empty key, `a/./b.md`, a trailing `/` and a Windows drive letter are refused too. The
  waiver refusal names the earliest directive line among the kernel's exclusions and warnings.
- **The example reads its fixture through a new helper function,** `fixtureFiles(name, kind)` in
  `examples/md/fixture.ts`, which returns the folder (after any swap) as the map
  `corpusFromText` takes. `eess/examples-md-public-blocks-only` lets only the helper import Node's
  modules, so the example cannot read the folder itself. The helper's doc said it "hands an example a
  path, never the documents' text"; it now says the text goes out only as `corpusFromText`'s input.
  The example's row is in `examples/README.md`.
- **The parity loads each tree inside its own test, memoised.** Loaded at collection time, a tree
  that throws took the whole file down: sabotage row 3 showed it, because without `ignore` the
  `corpus` tree loads its waiver document and is refused. Each tree's row now reds alone.
- **The parity's options:** `corpus` at its root with `roots: ['**/*.md']` and the waiver document
  ignored; `resolve-link` as `resolve-link.test.ts` loads it (`roots: ['docs/**']`, two ignores);
  `external-root` from `repo/` with its legacy root; the other four at their roots with
  `roots: ['**/*.md']`. Measured per rule, as examined / real findings on the text side (equal on
  disk): links 64/8 on `linked-back`, 72/67 on `declared-block`; live pointers 5/3 on `corpus`, 3/2
  on `external-root`; `honestyAtClose` 23/15 on `ledger`, 20/9 on `frontmatter`. Frozen pointers
  exist only on `corpus` (1), boxes on `ledger` (21), `declared-block` (1) and `frontmatter` (4),
  frozen documents on `corpus`, `linked-back` and `ledger`. No fixture document had to be added.
- **`honestyAtClose` is typed `ArchViolation[]`,** so the test reads its `examined` with an `in`
  check rather than a cast (ADR-005).
- **The docs section sits after "What did the corpus actually load?"** (`docs/markdown.md:55` moved
  since the plan was written), and names `TextCorpusOptions` so `check:surface` counts it.
- **Red first:** the new test file run against the base commit (9675402, a throwaway worktree)
  failed to load, `TypeError: corpusFromText is not a function`, with no test passing.
- **Gates while building:** md suite 511 tests and crossvalidate 128 green (Phase 1 alone: 492 and
  128, unchanged); `check:arch`, `check:family`, `check:surface`, `check:docs-code`,
  `check:examples`, `check:corpus`, `check:release`, `check:spec`, `check:integrity` green.
  `QA_ONLY=examples/md-fixtures-are-load-bearing` proves 9 of 9 judgements across 6 examples both
  ways (13 s), this example's one among them.

**Sabotage matrix, measured 2026-10-19 at c5df06e:** each named test green on the untouched tree and
red with its row applied, files restored by `git checkout`, tree clean, 14 s in all.

| row | sabotage                                                            | named test (`packages/md/tests/corpus-from-text.test.ts`)                               | baseline | sabotaged | time |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- | --------- | ---- |
| 1   | `pointer-resolve.ts` reads the disk again                           | a pointer past the end of a file that exists only in the map is stale at its own line   | green    | red       | 1.8s |
| 2   | `corpusFromText` passes `frozen: []`                                | parity on the corpus tree                                                               | green    | red       | 1.7s |
| 2   | `corpusFromText` passes `frozen: []`                                | parity on the ledger tree                                                               | green    | red       | 1.7s |
| 3   | `corpusFromText` drops `options.ignore`                             | parity on the resolve-link tree                                                         | green    | red       | 1.7s |
| 3   | `corpusFromText` drops `options.ignore`                             | parity on the corpus tree                                                               | green    | red       | 1.7s |
| 4   | `corpusFromText` passes only the `.md` paths                        | parity on the corpus tree                                                               | green    | red       | 1.7s |
| 5   | the waiver refusal removed                                          | refuses a waiver in a loaded document, naming the document and line                     | green    | red       | 1.6s |
| 6   | the `BUILTIN_IGNORE` refusal removed                                | refuses a key under a directory corpus() never walks, naming the path and the directory | green    | red       | 1.6s |
| 7   | the `root` existence check removed                                  | refuses a root that exists on disk                                                      | green    | red       | 1.7s |
| 8   | `honestyAtClose`'s receipt replaced by `taskItems(c)`, no condition | the parity is not empty: every rule examines and finds something real on some tree      | green    | red       | 1.6s |

Row 8's other half: with the same vacuous rule and the guard test skipped, the file passes (18
passed, 0 failed), so the guard is what catches it. The "parity on the … tree" titles end in
"documents, index, receipts and element sets". The matrix's edits live in the session's
`scratchpad/matrix0455.py`, not in the repository; the table is the record of what each row broke.

## Progress ledger

- [x] Phase 1: `assembleCorpus`, the widened registry and `readCorpusFile`; the existing md and
      crossvalidate suites green (492 and 128 tests, unchanged; the registry in its own module,
      build notes)
- [x] Phase 2: `corpusFromText` with its refusals
- [x] Phase 3: parity test with its per-rule guard, refusal rows, waiver-parse row, pointers-in-memory
      row, `roots` default rows
- [x] Sabotage matrix run, each of the eight rows red on its named test (table above, 14 s)
- [x] Docs, README line, changeset; `check:surface`, `check:docs-code` green
- [x] Example and its fixture pair under plan 0458's gate (9 of 9 judgements load-bearing, 13 s)
- [x] `npm run validate`: red at the close commit 1135be2 (exit 1 after 47 s, `check:vacuity`:
      `corpusFromText` neither probed nor listed as a non-constructor; fixed by listing it as an input
      loader beside `corpus()`); after the rebase onto main, exit 0 in 18 min 21 s at 9def163. This
      commit touches only this plan
- [x] Close: this plan → `completed/`, ROADMAP row

Deferred: none
