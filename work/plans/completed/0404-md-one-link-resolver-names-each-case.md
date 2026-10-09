# Plan 0404: md — one link resolver, and it names each case

## Status

- **State:** Done — built 2026-10-07 in the PR that closes it; every ledger box below is done.
  Deferred: none. Previously Ready (frozen 2026-10-07 from proposal 013's decision 7).
- **Priority:** Medium — no false green today. A custom link rule has to re-implement resolution
  and gets it wrong (proposal 013's survey), and plan 0406 cannot give one finding per cause
  without it.
- **Effort:** Small — one function extracted from code that exists, two cached indexes, one export,
  one caller moved, one structural rule.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../../proposals/promoted/013-md-a-declared-relation-is-reciprocated.md)'s Ask C; its
  disposition row names this plan. This plan does not declare `**Implements:**`; plan 0406, which
  ships the last ask, does.
- **First of three:** this plan, then [plan 0405](./0405-md-select-the-links-a-block-declares.md),
  then [plan 0406](./0406-md-a-declared-link-is-answered.md).

## Problem

eess-md resolves a link's target in one private function, `resolveTargets`
(`packages/md/src/conditions/resolve.ts`), used only by `linkResolves`. A rule over links has to
resolve targets again, and the measured re-implementation missed fragments, decoding,
repo-rooted links and spellings of one path. `resolveTargets` also answers too little: it returns
candidate paths and leaves each caller to decide whether one exists, is a directory, or sits
outside the corpus.

## Design

```ts
/** The parts of a link resolution reads. Narrower than MdLink, so a caller can build one. */
export interface LinkToResolve {
  readonly url: string
  readonly external: boolean
  readonly doc: { readonly relPath: string }
}

export type LinkTarget =
  | { readonly kind: 'external' }
  | { readonly kind: 'self' }
  | { readonly kind: 'document'; readonly path: string; readonly doc: MdDocument }
  | {
      readonly kind: 'not-in-corpus'
      readonly path: string
      readonly reasons: readonly NotInCorpusReason[]
    }
  | { readonly kind: 'directory'; readonly path: string }
  | { readonly kind: 'missing'; readonly tried: readonly string[] }

export type NotInCorpusReason = 'not-markdown' | 'ignored' | 'outside-roots'

export function resolveLink(
  link: LinkToResolve,
  corpus: Corpus,
  options: LinkResolveOptions = {},
): LinkTarget
```

- **Total, never throwing.** An external link is `external`; malformed percent-encoding is
  `missing` with the raw URL in `tried`.
- **`self`** is a pure `#anchor`, **or** a target that resolves to the linking document's own path.
- **`not-in-corpus`** lists every reason that applies, never just one, so a finding names every
  remedy needed and fixing one cannot uncover another: `not-markdown` (the corpus reads only `.md`),
  `ignored` (it matches the corpus `ignore` option), `outside-roots` (add the folder to the corpus
  `roots`). The reasons need the corpus's `roots` and `ignore` matchers, which `corpus()` builds and
  discards today; it now registers them in a module-private `WeakMap<Corpus, …>`, beside the two
  indexes below. A `Corpus` built some other way, without registered matchers, reports
  `outside-roots`. The built-in ignores (`node_modules`, `dist`, …) are never walked, so a link into
  one is `missing`, not `ignored`; the documentation says so.
- **Candidate order is today's.** For each target from `resolveTargets` (repo-root first, then
  content-root when `rootDir` is set) the candidates from `tryExtensions` and `tryIndex` are tried in
  order. The first existing **file** wins. Only when no candidate is a file is a directory
  reported, the repo-root one first. When nothing exists, `missing.tried` is every candidate tried,
  in order. This is the rule `linkResolves` applies today, made explicit.
- **Two indexes, built once per corpus** and cached in a `WeakMap<Corpus, …>`: the directory index
  (today rebuilt per condition) and a map from path to loaded document (`Corpus` has none).
- **`linkResolves` calls `resolveLink`** and keeps its verdicts exactly: `document` and
  `not-in-corpus` resolve; `directory` resolves only when `resolveDirectories` is on, and otherwise
  keeps bug 0137's hint; `missing` is the broken-link finding with its move fix; `self` and
  `external` are skipped.
- **Exported from `@nielspeter/eess-md`'s root,** with `LinkToResolve` and `LinkTarget`. Additive.

## Phases

### Phase 1 — extract, cache, export; behaviour unchanged

**Files:** `packages/md/src/model/resolve-link.ts` (new; it also takes `movedLinkFix`, the one other
use of `node:path` in `conditions/resolve.ts`), `packages/md/src/corpus.ts` (registers its matchers),
`packages/md/src/conditions/resolve.ts`,
`packages/md/src/index.ts`, `arch.rules.ts` (the structural rule below), `docs/markdown.md` (a
section on a custom link rule with `resolveLink`), `.changeset/` (eess-md minor, additive).

## Test inventory

Tests import from the package root and live in `packages/md/tests/resolve-link.test.ts`, over a new
fixture `packages/md/tests/fixtures/resolve-link/` (the shared `fixtures/corpus` stays untouched, so
`links.test.ts` keeps its expectations). The source document sits in a subdirectory, so an identity
resolver cannot pass by accident.

- **The spelling table,** each row asserting `kind`, and `path` or `tried` exactly: `./a.md`, `a.md`,
  `../dir/a.md`, `a.md#x`, `#x` (`self`), `./self.md` and `self.md#x` from `self.md` (`self`),
  `a%20b.md`, `%E0` (`missing`), `/docs/a.md` with and without `rootDir` (both candidates in
  `tried` when missing), `./guide` with `tryExtensions: ['.md']`, `./guide/` with `tryIndex`, a
  directory with and without `resolveDirectories`, a file and a same-named directory (the file wins),
  a file outside `roots`, a `.png` inside `roots`, an ignored file, an ignored `.md` outside `roots`
  (`reasons` lists both), a link into `node_modules` (`missing`), an external URL, a missing file.
  `document` rows also assert `doc.relPath === path`.
- **`linkResolves` is unchanged:** `packages/md/tests/links.test.ts` passes untouched, and a test
  drives `links(c).that().areInternal().should().resolve().check()` over the new fixture.

**Sabotage rows** (ADR-009 rule 5; published API, rule 6's deepest level), run in an isolated
`git worktree` with its own `node_modules`, from a green baseline, each verdict read from the exit
code:

- an emptied resolver (every link `missing`): the `document` rows go red;
- an identity resolver (returns the URL as the path): the subdirectory rows go red;
- `outside-roots` and `document` swapped: their rows go red;
- **a second resolver reintroduced:** caught structurally, not by behaviour (a copy gives the same
  answers). `arch.rules.ts` gains a rule over the files that resolve links:
  `modules(p).that().resideInFile(<conditions/resolve.ts, and plan 0406's linked-back.ts and
live-target.ts once they exist>).and().importFrom('**/model/resolve-link.ts').should().notImportFrom('node:path')`.
  `importFrom` is a predicate only, so a file that stops importing `resolveLink` drops out of the
  selection, and a selection emptied that way fails with the zero-examined finding. The row deletes
  the import and inlines the old code, and `check:arch` goes red. `notImportFrom` matches a builtin
  specifier such as `node:path`. **Named residual:** a copy written with string operations instead
  of `node:path` passes; that is accepted.

`check:vacuity` does not reach this: `resolveLink` is a function, not a check-constructor.

## Out of scope

- Reference-style links (`[text][ref]`): `collectLinks` does not produce them.
- Any change to what `linkResolves` accepts.

## Success

- A custom rule resolves a link with `resolveLink` and gets the answer `linkResolves` acts on.
- Each case is distinguishable by `kind`, and `not-in-corpus` by `reason`.
- `npm run validate` green.

## Progress ledger

- [x] Phase 1 — `resolveLink` extracted, cached, exported, documented; `linkResolves` calls it
      (`packages/md/src/model/resolve-link.ts`; `docs/markdown.md` "Resolving a link yourself")
- [x] the spelling table (`packages/md/tests/resolve-link.test.ts`, 25 tests, plus an agreement
      test: `linkResolves` flags exactly the links `resolveLink` calls `missing` or `directory`)
- [x] the four sabotage rows go red, the structural one through `check:arch` (measured in an
      isolated worktree; see Build notes)
- [x] `npm run validate` green (480 s on the first build commit; the review fixes after it are
      covered by the targeted runs below and by CI)

## Build notes (2026-10-07)

- **Sabotage, measured** (each patched, checked, restored from the index): emptied resolver, 24 of
  25 tests red; identity resolver, 19 red; `document` reported as `not-in-corpus`, 10 red; path
  arithmetic added to `conditions/resolve.ts`, `check:arch` red on `eess/md-one-link-resolver`.
- **The structural rule's empty-selection half needed a correction to this plan's wording.** The
  plan said deleting the import empties the selection. Measured: `conditions/resolve.ts` also
  re-exports the `LinkResolveOptions` type from `model/resolve-link.ts`, and the import graph counts
  that re-export, so the file stays selected. With both the import and the re-export removed, the
  rule fails with the zero-examined finding, and does so without `.expectNonEmpty()` (measured with
  and without it). The rule's comment names both residuals: a file that keeps a type re-export but
  stops calling `resolveLink` is guarded only by the `node:path` ban, and a copy written with string
  operations passes.
- **`movedLinkFix` moved into `model/resolve-link.ts`** with the resolver, so `conditions/resolve.ts`
  has no `node:path` import; `LinkResolveOptions` is defined there too and re-exported from the
  condition module, so existing imports keep working.
- **One behaviour change, in the changeset:** a link with malformed percent-encoding is now reported
  as broken; before, `decodeURIComponent` threw and aborted the run.

## Review fixes (2026-10-07, after enforcement, testing and architect review of the build)

- **The structural rule was narrower than its comment.** It selected only `conditions/resolve.ts`
  and banned only the `'node:path'` spelling; review measured `'path'`, `'node:path/posix'` and
  `'path/posix'` getting past it, and a new condition importing both `resolveLink` and `node:path`
  going unselected. It now selects every module in `packages/md/src/conditions/` that imports from
  `model/resolve-link.ts` and bans all four spellings (each measured: exactly one finding on the
  patched file). Its comment and `because` say it is a Tier-1 check on the conditions' imports,
  and name what it cannot see: a module that re-implements resolution without importing
  `resolve-link.ts` is never selected, the case proposal 013's survey found.
- **A non-vacuity row for it** (`arch/md-one-link-resolver` in `scripts/check-nonvacuity.mjs`): a
  bare `'path'` import is prepended to `conditions/resolve.ts` and the rule must fire on that file.
  The plan did not ask for one; review found the import ban rested on one manual measurement.
- **Tests that could not fail, or were missing, now exist and were each sabotaged red:** an
  existing file in `node_modules` (written at test time, since `node_modules` is gitignored; red
  when `node_modules` leaves the built-in ignores); the content-root directory hint (red when the
  label is forced to repo-root); repo-root reported before content-root (red when the order is
  reversed); a malformed link through `linkResolves` (three tests red when the resolver throws
  again); a hand-built corpus reporting `outside-roots`; an empty link as `self`; `doc` asserted on
  every `document` row; an existing repo-root file winning over the content root.
- **Docs** state that an empty link is `self` and that a hand-built or copied `Corpus` has no
  `ignored` reason.
- **Not done, recorded:** the architect's suggestion that the `directory` case carry which root it
  came from, so `linkTargets` need not be exported for the hint's label. It is a cleaner shape but
  changes a published type this plan just introduced; left as it is, with the label tested.
- **Second review, minors:** the non-vacuity row now probes both `'node:path'` and bare `'path'`;
  the "repo-root file wins" test gained a real competing file (`docs/docs/b.md`), since without
  one it could not fail on a reversed file loop (now measured red); `resolveLink`'s doc states that
  the cached indexes are not re-read for a hand-built `Corpus` whose `documents()` changes
  (architect M3).
- **Dropped on purpose:** the architect's suggestion that the `directory` case carry its root, so
  `linkTargets` need not be exported for the hint's label (M1). `linkTargets` is exported from the
  model module only, not from the package root, so no adopter can depend on it; carrying the root
  would widen a public type for an internal label.
