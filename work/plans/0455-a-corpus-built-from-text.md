# Plan 0455: a corpus built from text

## Status

- **State:** Draft — written 2026-10-17 from proposal 017's maintainer acceptance (block 7).
- **Implements:** proposal 017
- **Priority:** Medium — two of the three adopters asked for it (017, "Consumer feedback"), and the
  third wants it in tests only; this repository's own md tests build their corpora in temporary
  directories or fixture trees today.
- **Effort:** Small — one constructor, one internal seam that `pointers()` already needs, a parity
  test over the existing fixture trees.
- **Created:** 2026-10-17
- **Builds after:** plan 0458 (the examples gate, which this plan's example needs).

## Problem

A caller who writes an eess-md rule tests it against a corpus, and the only constructor is
`corpus()` (`packages/md/src/corpus.ts:61`), which walks a directory on disk. So every test either
keeps a fixture tree in the repository or writes one to a temporary directory. Measured 2026-10-17:

- `packages/md/tests`: 61 `corpus(` calls in 22 of 23 test files. 8 files create temporary
  directories (18 `mkdtemp` calls); 17 point `cwd` at a fixture tree under
  `packages/md/tests/fixtures` (186 files).
- `packages/crossvalidate/tests`: 9 `corpus(` calls in 7 files; 3 test files create temporary
  directories (5 `mkdtemp` calls).
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
unchanged. The name follows mermaid's `diagram(input)`, which takes text; there is no in-memory
constructor elsewhere in the family to copy.

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

So `roots`, `frozen` (the same `DEFAULT_FROZEN`, `corpus.ts:53`, until 017's second-Review decision
2 changes it for both), `ignore`, the `fileIndex`, `buildDocument` and `registerCorpusMatchers` are
one code path. The one difference is `roots`: optional here, defaulting to every `.md` key given.
That default names no folder or document shape, only "what you handed me" (017's principle).

**Pointers read through the corpus, never the disk.** `assembleCorpus` registers its reader on the
corpus in a `WeakMap`, the pattern `registerCorpusMatchers` already uses (plan 0404), and
`pointerResolves`'s line count calls `readCorpusFile(corpus, rel)` instead of `readFileSync`. A
`Corpus` built by hand has no registered reader and keeps today's disk read, so the public `Corpus`
interface does not change and nothing breaks. `externalRoots` stay on disk for both constructors:
they name checkouts outside the repository by definition.

**Where a pointer's target lives, settled from the code:** in a text corpus it is in the map, or it
is not there. There is no mixing of an in-memory Markdown side with a code side on disk. That would
make one corpus resolve against two sources, and `corpus()` already answers "resolve against disk".
A caller who wants their real code uses `corpus()`.

**What cannot behave as on disk is refused, never silently different** (ADR-009, ADR-010):

| input                                                                                                    | why                                                                                                                               | result                                                                                             |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| a loaded document containing an `eess-exclude` directive, found by the kernel's `parseExclusionComments` | the kernel reads waivers from disk by path and finds nothing at a virtual one, so the waiver would silently not apply             | `ArchConfigError` naming the document and line, with "test waivers with `corpus()` over a fixture" |
| a path that is absolute, contains `..` or `\`, starts with `./`, or is not normalised                    | it has no single repo-relative meaning                                                                                            | `ArchConfigError` naming the path                                                                  |
| a path under a directory `corpus()` never walks (`BUILTIN_IGNORE`, `corpus.ts:54`)                       | the disk walk would never index it, so a test over it would pass on a file CI cannot see                                          | `ArchConfigError` naming the path and the directory                                                |
| a `root` option naming a directory that exists                                                           | the kernel's waiver scan and `apply-fixes` read `file` from disk, so a real directory would let a real file stand in for the text | `ArchConfigError`                                                                                  |

`root` defaults to `join(sep, '__eess_text_corpus__')`, which documents carry in `file` as on disk.
The caller may set it so messages read like their repository, as long as it does not exist.

**Empty is not refused.** `corpusFromText({})` yields no documents, as `corpus()` does over an empty
tree; the builders' own zero-examined findings (ADR-010) apply unchanged.

**Tier.** This is test infrastructure, not a check: it adds no way to fail a build. Its own claim,
"resolves as on disk", is held by the parity test below, which is Tier 2.

**The examples gate (017 decision 3)** is plan 0458's, built before any block plan. This plan adds
one example under it: `examples/md/corpus-from-text.test.ts`, one rule built from public blocks,
with its documents kept as files under `examples/md/fixtures/corpus-from-text/clean/` and
`…/violating/` and read through `corpusFromText`, registered as plan 0458 specifies.

## Phases

All in one pull request.

### Phase 1 — one assembly path, one reader (no behaviour change)

```ts
// packages/md/src/corpus.ts
type ReadFile = (relPath: string) => string
const readerOf = new WeakMap<Corpus, ReadFile>()

/** The text of a file in the corpus's index: through the corpus that built it, else from disk. */
export function readCorpusFile(corpus: Corpus, relPath: string): string {
  return (readerOf.get(corpus) ?? ((rel) => readFileSync(join(corpus.root, rel), 'utf8')))(relPath)
}

function assembleCorpus(
  root: string,
  paths: readonly string[],
  read: ReadFile,
  options: AssembleOptions,
): Corpus {
  // today's corpus.ts:62-98, with readFileSync(abs) replaced by read(rel)
  // …
  registerCorpusMatchers(loaded, { inRoots: matchesRoot, ignored: matchesIgnore })
  readerOf.set(loaded, read)
  return loaded
}

export function corpus(options: CorpusOptions): Corpus {
  const root = options.cwd ?? process.cwd()
  const paths = walkFiles(root, root, new Set(BUILTIN_IGNORE))
  return assembleCorpus(root, paths, (rel) => readFileSync(join(root, rel), 'utf8'), options)
}
```

`pointer-resolve.ts:89` becomes `readCorpusFile(corpus, rel).split('\n').length`. `readCorpusFile`
is not exported from the package root; `/internal` gets it only if eess-crossvalidate needs it, and
today nothing in `packages/crossvalidate/src` reads `corpus.root` (measured).

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
  const paths = Object.keys(files)
  for (const p of paths) refuseUnlessCanonical(p) // the path rows of the table above
  const roots = options.roots ?? paths.filter((p) => p.endsWith('.md'))
  const read = (rel: string): string => files[rel] ?? '' // only ever called with an indexed path
  const c = assembleCorpus(root, paths, read, { ...options, roots })
  for (const doc of c.documents()) refuseWaivers(doc) // parseExclusionComments(doc.text, doc.file)
  return c
}
```

The `?? ''` is unreachable: `read` is only called for paths taken from the map's own keys. Under
`noUncheckedIndexedAccess` it is the typed way to say so (ADR-005: no `as`).

### Phase 3 — tests, docs, release

- The parity test, the refusals, docs and the changeset (below).
- `docs/markdown.md` gains a "A corpus from text, for tests" section after the `corpus()` options
  (`docs/markdown.md:55`), so `check:surface` counts the export as documented and
  `check:docs-code` compiles its fence.
- The example under the examples gate, as described in Design.

## Files changed

- `packages/md/src/corpus.ts`: `assembleCorpus`, `readCorpusFile`, `corpusFromText`,
  `TextCorpusOptions`
- `packages/md/src/conditions/pointer-resolve.ts`: the line count reads through the corpus
- `packages/md/src/index.ts`: export `corpusFromText`, `TextCorpusOptions`
- `packages/md/tests/corpus-from-text.test.ts`: new
- `docs/markdown.md`, `packages/md/README.md` (one line)
- `examples/md/corpus-from-text.test.ts` and its `fixtures/` folder: new (see Design)
- `.changeset/md-corpus-from-text.md`: `'@nielspeter/eess-md': minor`, additive. Nothing else
  moves: no kernel change, and eess-crossvalidate's sources are untouched.

## Test inventory

- **Parity, the claim itself.** For each of seven fixture trees under `packages/md/tests/fixtures`
  (`corpus`, `resolve-link`, `linked-back`, `ledger`, `declared-block`, `frontmatter`,
  `external-root`: 140 `.md` and 17 other files, measured), the tree is read into a map and loaded
  both ways with the same options. They must agree on:
  - documents (`relPath`, `frozen`, `text`) and `fileIndex`;
  - the findings, with `root` stripped from `file`, of
    `links(c).should().resolve()`, `pointers(c).that().areLive().should().resolve()`,
    `pointers(c).that().areFrozen()` counts, `taskItems(c)` and `honestyAtClose` with
    `report: 'return'`.

  Each tree is asserted to produce at least one finding, so a parity of two empty results cannot
  pass. `corpus/docs/sanctioned-pointer.md` holds a waiver, so the `corpus` tree passes
  `ignore: ['docs/sanctioned-pointer.md']` on both sides: the file stays in the index and out of the
  documents.

- **Refusals**, one row each: a waiver in a loaded document (and the same text in a file outside
  `roots`, which is accepted); `/abs.md`, `../x.md`, `./x.md`, `a\\b.md`, `a//b.md`; a key under
  `node_modules/`; a `root` that is `tmpdir()`.
- **Pointers in memory:** a pointer to a line past a target that exists only in the map is `stale`,
  one within it is clean. This row reds if Phase 1's reader is bypassed (`ENOENT` at a root that
  does not exist).
- **`roots` default:** a map with `a.md` and `src/b.ts` loads one document; `roots: ['docs/**']`
  over a map without `docs/` loads none, and `links(c).should().resolve()` reports zero examined as
  it does on disk.
- **The existing suite unchanged** (Phase 1 is a refactor): `npm test --workspace packages/md` and
  `packages/crossvalidate`.
- **Sabotage matrix**, run once in a worktree, each red on a named row:
  1. `pointerResolves` reads the disk again → the pointers-in-memory row;
  2. `corpusFromText` drops `frozen` (passes `[]`) → parity on `corpus` and `ledger` (`frozen`);
  3. `assembleCorpus` skips `registerCorpusMatchers` → parity on `resolve-link` (the
     `not-in-corpus` reasons);
  4. `fileIndex` built from `.md` keys only → parity on `corpus` (a pointer to `src/app.ts`);
  5. the waiver refusal removed → its refusal row;
  6. the `BUILTIN_IGNORE` refusal removed → its refusal row;
  7. the `root` existence check removed → its refusal row.
- **Non-vacuity:** block 7 adds no gate, so it adds no `check:nonvacuity` row. Its non-vacuity is the
  parity test's "at least one finding per tree" assertion and the sabotage matrix. The example adds
  its row under the examples gate, as that gate's plan specifies.

## Out of scope

- A text corpus that reads part of its files from disk (Design: one source).
- Reading waivers from memory. That is a kernel change to `execute-rule.ts`'s disk read (ADR-012's
  owner), and is refused here instead. If a caller needs it, it is a record of its own.
- Git tracking (bug 0446). A text corpus has no untracked files; whatever bug 0446 decides for
  `corpus()` either passes through `assembleCorpus` or is disk-only, and that bug says which.
- `DEFAULT_FROZEN` (017's second Review, decision 2): this plan shares it, it does not change it.
- Any gherkin or mermaid equivalent.

## Progress ledger

- [ ] Phase 1: `assembleCorpus` and `readCorpusFile`; the existing md and crossvalidate suites green
- [ ] Phase 2: `corpusFromText` with its refusals
- [ ] Phase 3: parity test, refusal rows, pointers-in-memory row, `roots` default rows
- [ ] Sabotage matrix run, each of the seven rows red on its named test
- [ ] Docs, README line, changeset; `check:surface`, `check:docs-code` green
- [ ] Example added under plan 0458's examples gate
- [ ] Proposal 017's block 7 disposition row set to `Accepted` with this plan named (in the pull
      request that files this plan)
- [ ] Close: this plan → `completed/`, ROADMAP row

Deferred: none
