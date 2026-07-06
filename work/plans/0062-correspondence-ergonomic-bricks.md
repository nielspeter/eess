# 0062 — Two correspondence bricks: split keys + `files()`

**Status:** IMPLEMENTED (2026-07-06)
**Priority:** Medium
**Effort:** ~2 small phases + a dogfood refactor (1 session)

## Problem

Plan 0061 shipped the first spec↔code bindings (`spec.rules.ts`) and proved the
thesis. Writing those two bindings surfaced two recurring frictions that every
future table↔code binding would pay — and that a later declarative schema layer
would inherit if left unfixed. This plan removes exactly those two, and nothing
more. It is deliberately **not** the schema layer: that abstraction must be
extracted from 3–5 real bindings, not from the two we have (N=2 is too few — the
`.excluding()` three-draft saga is the standing warning). These two bricks are
justified because **both** existing bindings use **both** of them today.

### Friction 1 — `keyBy` forces union-narrowing

`correspondence()`'s `keyBy` is a single `(L | R) => string`
(`packages/core/src/correspondence.ts:35`), so a row↔entity join hand-discriminates
the two element types:

```ts
// spec.rules.ts today
function packageKey(element: MdRow | WorkspacePackage): string {
  return 'get' in element ? bare(element.get('pkg')) : element.name // ← the dance
}
```

The `'get' in element` narrowing is boilerplate the compiler shouldn't need —
each side has one known type. Crucially, the kernel matcher **already** takes
separate `leftKey`/`rightKey` (`packages/core/src/matching.ts:29-31`); the unified
`keyBy` is collapsed onto them in `matchOptsFor` (`correspondence.ts:110-116`).
So the split is a pure API-surface change with **zero engine change** — we are
exposing a capability the engine already has.

### Friction 2 — "the code side is a set of files" is hand-rolled fs

```ts
// spec.rules.ts today — ~14 lines to turn a directory into a Selection
function readAdrFiles(): AdrFile[] {
  /* readdirSync + regex loop */
}
const adrFilesSelection: Selection<AdrFile> = {
  elements: readAdrFiles(),
  label: 'ADR file',
  identify: (a) => ({ name: a.num, file: a.file, line: 1 }),
}
```

Any doc-index↔files binding repeats this. A `files()` factory (glob → `Selection`)
removes it. picomatch is already a dependency in the packages that would host it
(`packages/{md,ts,crossvalidate}/package.json`).

## Non-goals (hold the line — these are N=1 or premature)

- **A content-parsing brick** ("entities parsed from JSON/TS files", e.g. the
  workspace-packages side reads `name`/`version` out of each `package.json`).
  Only one binding needs it → **N=1, out of scope.** `files()` deliberately
  solves only the path/name case; naming that boundary is the point.
- **The declarative table-binding / schema primitive.** Extract it from 3–5 real
  bindings (an external repo + others), not from two. Its own future plan.
- **external-repo migration**, diff mode, MCP, the ratchet — all downstream.

## Phase 1 — split key extractors on `correspondence()`

Widen `keyBy` to accept the existing unified function **or** a per-side pair.
Backward compatible: the two shipped presets pass no `keyBy` or a function.

```ts
// packages/core/src/correspondence.ts
/**
 * Join-key extraction for a correspondence. A single function keys both sides
 * (each element is `L | R`); a `{ left, right }` pair keys each side with its
 * own type — no union-narrowing, and the join key can differ from the display
 * name (show "ADR 001", join on "001"). Omit entirely to key by
 * `identify().name` on each side.
 */
export type KeyBy<L, R> =
  | ((element: L | R) => string)
  | { readonly left: (l: L) => string; readonly right: (r: R) => string }

export interface CorrespondenceOptions<L, R> {
  readonly left: Selection<L>
  readonly right: Selection<R>
  readonly keyBy?: KeyBy<L, R>
  // matchBy?, suggest? unchanged
}
```

Resolution — the only logic change, in `matchOptsFor`:

```ts
function keyExtractors<L, R>(k: KeyBy<L, R> | undefined, left: Selection<L>, right: Selection<R>) {
  if (k === undefined) {
    return { leftKey: (l: L) => left.identify(l).name, rightKey: (r: R) => right.identify(r).name }
  }
  if (typeof k === 'function') return { leftKey: k, rightKey: k }
  return { leftKey: k.left, rightKey: k.right }
}
// matchOptsFor returns { ...keyExtractors(o.keyBy, o.left, o.right) } when matchBy is absent
```

No change to `matching.ts` (the engine already consumes `leftKey`/`rightKey`).

**Files changed:**

- `packages/core/src/correspondence.ts` (`KeyBy` type, export it; `matchOptsFor`)
- `packages/core/src/index.ts` (export `KeyBy`)

**Tests** (`packages/core/tests/correspondence.test.ts` or a new file):

- unified `keyBy` fn still joins (regression).
- omitted `keyBy` joins by `identify().name` (regression).
- `{ left, right }` joins two different element types with no union code.
- display-name ≠ join-key: `identify().name` differs from the key, join still
  works on the key.
- `matchBy` path unaffected when `keyBy` absent.

## Phase 2 — `files()` selection factory

A glob → `Selection<FileEntry>` factory. The element is a path pair; the caller
supplies `identify`. Path-selection only — content parsing stays the caller's job.

```ts
// packages/crossvalidate/src/files.ts  → exported as @nielspeter/eess-crossvalidate/files
import type { Selection, ElementInfo } from '@nielspeter/eess'

/** A file matched by `files()`. Its content is not read — this is a path brick. */
export interface FileEntry {
  /** Repo-relative path, POSIX separators, e.g. "adr/001-toolchain.md". */
  readonly path: string
  /** Absolute path (for callers that read content in `identify`). */
  readonly absPath: string
}

export interface FilesOptions {
  /** Glob(s) selecting files, relative to `cwd`. */
  readonly glob: string | readonly string[]
  /** Root the globs resolve against. Default `process.cwd()`. */
  readonly cwd?: string
  /** Globs never walked (deps, build output, VCS). */
  readonly ignore?: readonly string[]
  /** Display label for this side of the correspondence. */
  readonly label: string
  /** Map a file to its correspondence identity (name/file/line). */
  readonly identify: (f: FileEntry) => ElementInfo
}

/** Turn a set of files into a `Selection` — the "code side is a set of files". */
export function files(opts: FilesOptions): Selection<FileEntry>
```

Implementation: walk `cwd` (or use the same picomatch approach as
`packages/md/src/corpus.ts:53-84`), match `glob`, skip `ignore`, build
`FileEntry[]`, return `{ elements, label, identify }`. Reuse the corpus walk
pattern; do not add a new glob dependency.

**After** (the ADR side of `spec.rules.ts`):

```ts
const adrFilesSelection = files({
  glob: 'adr/*.md',
  label: 'ADR file',
  identify: (f) => ({ name: numberOf(f.path), file: f.path, line: 1 }),
})
```

**Home rationale:** not the kernel (it is deliberately fs-free — ADR-002 /
engine boundary). `eess-md` is markdown-specific; a generic `files()` there is a
layering smell. `eess-crossvalidate` is where file-based right-hand sides are
authored and already depends on the kernel + picomatch, so it hosts `files()` as
a new `./files` subpath export.

**Files changed:**

- `packages/crossvalidate/src/files.ts` (new)
- `packages/crossvalidate/package.json` (`./files` export)
- `packages/crossvalidate/tsconfig*.json` if the entry list is explicit

**Tests** (`packages/crossvalidate/tests/files.test.ts`, fixture dir):

- globs the expected set; `identify` maps to name/file/line.
- `ignore` excludes; multiple globs union; brace/`*` patterns work.
- no match → empty selection (not an error).
- `path` is repo-relative POSIX; `absPath` is absolute.
- integration: a `files()` selection feeds `correspondence()` two-sided.

## Phase 3 — dogfood both bricks in `spec.rules.ts`

Prove the bricks on the real case (and keep `check:spec` green):

- Replace `packageKey` / `adrKey` union functions with `keyBy: { left, right }`.
- Replace `readAdrFiles()` + the hand-built `adrFilesSelection` with `files()`.
- The workspace-packages side **stays hand-built** — it parses `package.json`
  content, the deliberately-out-of-scope N=1 case. This is the honest
  demonstration of `files()`'s boundary, not a gap.
- `spec.rules.ts` shrinks; `check:spec` stays green; the non-vacuity spec
  fixture still fails on drift.

**Files changed:** `spec.rules.ts`; possibly `scripts/nonvacuity/bad-spec.rules.ts`
(if it adopts the split `keyBy` too).

## Test inventory (aggregate)

| Area                           | Tests                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `correspondence` split `keyBy` | unified fn (regression), default identify (regression), `{left,right}`, name≠key, matchBy path     |
| `files()`                      | glob set, identify mapping, ignore, multi-glob, empty→empty, POSIX/abs paths, feeds correspondence |
| dogfood                        | `check:spec` green after refactor; spec non-vacuity fixture still red on drift                     |

## Out of scope

- The content-parsing brick (entities from JSON/TS) — N=1, revisit when a second
  case appears.
- The declarative table-binding / document-type schema — extract from 3–5 real
  bindings, its own plan.
- external-repo migration, diff mode, MCP surface, ratchet.
- Publishing / cutover — unchanged, user-gated.

## Success definition

Both bricks land with tests, `spec.rules.ts` adopts both and shrinks, and
`npm run validate` stays green (including `check:spec` and its non-vacuity
fixture). The next binding written — on this repo or an external repo — pays neither the
union-narrowing tax nor the fs-boilerplate tax. No new capability; two frictions
removed, justified by N=2, with the third (content-parsing) brick explicitly
deferred.

## As-built record (2026-07-06)

All three phases delivered; `npm run validate` green (exit 0).

| Phase | Delivered                                                                                                                                             | Commit    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1     | `KeyBy<L,R>` (unified fn or `{left,right}` pair) on `correspondence()`; `matchOptsFor` resolves the three shapes; zero engine change; +3 kernel tests | `ccdc8ce` |
| 2     | `files()` selection factory → `@nielspeter/eess-crossvalidate/files`; path-only, sorted; +7 tests                                                     | `784f654` |
| 3     | `spec.rules.ts` adopts both (194→175 lines); non-vacuity fixture adopts split `keyBy`                                                                 | `4062915` |

Notes:

- **Phase 1 was pure API surfacing, as predicted** — the matcher already
  consumed `leftKey`/`rightKey`; only `matchOptsFor` changed. Backward
  compatible (existing presets pass a fn or nothing).
- **`files()` home = `eess-crossvalidate/files`** (kernel is fs-free; eess-md is
  markdown-specific). New subpath export.
- **The dogfooding caught its own new entry point:** `check:arch`'s
  `no-unused-exports` flagged `files.ts` as an undeclared subpath export and
  required it in the `ENTRY_POINTS` map (`arch.internal.rules.ts`) — a-priori
  entry-point declaration, not a sanction. The exclusion list _is_ the exports
  map by design (plan 0060), so a new export must be declared there.
- **The workspace-packages side stayed hand-built**, exactly as scoped: it needs
  each package's `version` for the Status rule, so its identity is content, not
  path — the N=1 content-parsing case `files()` deliberately does not cover.
  Honest boundary demonstrated, not a gap.
- Net: two frictions removed, no new capability, N=2 discipline held. The
  declarative schema layer remains correctly deferred to its own plan, to be
  extracted from 3–5 real bindings (an external repo next).
