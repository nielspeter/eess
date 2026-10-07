# Plan 0404: md — one link resolver, and it names each case

## Status

- **State:** Ready — frozen 2026-10-07, at the maintainer's request (plan-ready). written 2026-10-07 from proposal 013's decision 7, after the maintainer asked
  for plans to implement the proposal ("then lets make plans to implement the proposal 013"). A
  first freeze the same day was withdrawn after architect, enforcement, method and testing review
  found undecided mechanisms; this version decides them. Re-frozen
  after a second architect, enforcement and testing review settled every remaining mechanism; each
  decision the build depends on is restated here, and proposal 013 is linked as provenance only.
- **Priority:** Medium — no false green today. A custom link rule has to re-implement resolution
  and gets it wrong (proposal 013's survey), and plan 0406 cannot give one finding per cause
  without it.
- **Effort:** Small — one function extracted from code that exists, two cached indexes, one export,
  one caller moved, one structural rule.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../proposals/013-md-a-declared-relation-is-reciprocated.md)'s Ask C; its
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

- [ ] Phase 1 — `resolveLink` extracted, cached, exported, documented; `linkResolves` calls it
- [ ] the spelling table
- [ ] the four sabotage rows go red, the structural one through `check:arch`
- [ ] `npm run validate` green
