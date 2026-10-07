# Plan 0404: md — one link resolver, and it names each case

## Status

- **State:** Ready — frozen 2026-10-07. Written the same day from proposal 013's decision 7, at the
  maintainer's instruction to plan the proposal's implementation, and frozen at the maintainer's
  request. Every decision the build depends on is restated in this plan; the proposal is linked
  as provenance only.
- **Priority:** Medium — no false green today. A custom link rule has to re-implement resolution
  and gets it wrong (proposal 013's survey: a consumer's rule missed `#fragment`, decoding,
  repo-rooted links and spellings of one path), and proposal 013's B cannot give one finding per
  cause without it.
- **Effort:** Small — one function extracted from code that exists, one export, one caller moved.
- **Created:** 2026-10-07
- **Builds:** [proposal 013](../proposals/013-md-a-declared-relation-is-reciprocated.md)'s Ask C; its
  disposition row names this plan. No `**Implements:**` line: 013's ruling is
  `Split and sequence`, and a declaration would claim this plan builds the whole proposal (the
  precedent is plan 0235's note on proposal 009).
- **First of three:** this plan, then [plan 0405](./0405-md-select-the-links-a-block-declares.md)
  (Ask A), then [plan 0406](./0406-md-a-declared-link-is-answered.md) (Ask B).

## Problem

eess-md resolves a link's target in one private function, `resolveTargets`
(`packages/md/src/conditions/resolve.ts`), used only by `linkResolves`. Anyone writing a rule over
links has to resolve targets again, and the measured re-implementation missed fragments, decoding,
repo-rooted links and different spellings of the same path.

`resolveTargets` also answers too little for a second caller. It returns candidate paths, or `[]`
for a pure anchor, and leaves each caller to decide whether a candidate exists, is a directory, or
sits outside the corpus roots. `linkResolves` decides that inline. Proposal 013's B needs each of
those answers as a distinct case, because each gets a different finding and remedy.

## Design (decided in proposal 013, decision 7)

One exported function that returns a result naming its case:

```ts
export type LinkTarget =
  | { readonly kind: 'document'; readonly path: string; readonly doc: MdDocument }
  | { readonly kind: 'outside-corpus'; readonly path: string }
  | { readonly kind: 'missing'; readonly tried: readonly string[] }
  | { readonly kind: 'directory'; readonly path: string }
  | { readonly kind: 'self'; readonly fragment: string }

export function resolveLink(
  link: MdLink,
  corpus: Corpus,
  options: LinkResolveOptions = {},
): LinkTarget
```

- `document`: the target exists and is a loaded corpus document, so its links are parsed.
- `outside-corpus`: the target exists in `corpus.fileIndex` but is not a loaded document (outside
  `roots`, or not Markdown).
- `missing`: no candidate exists; `tried` lists the candidates, so a finding can name them.
- `directory`: the target names a directory, recognised whether or not `resolveDirectories` is on.
  Whether a directory counts as resolved stays the caller's decision.
- `self`: a pure `#anchor`, a link to the document itself.

External links are not passed in: `resolveLink` is defined on internal links, and calling it on an
external one throws an `ArchConfigError`, so a rule that forgets `areInternal()` fails loudly.

`linkResolves` calls `resolveLink` and keeps its current verdicts exactly: `document` and
`outside-corpus` resolve; `directory` resolves only when `resolveDirectories` is on, and otherwise
keeps bug 0137's hint; `missing` is the broken-link finding with its move fix; `self` is skipped.

## Phases

### Phase 1 — extract and export, behaviour unchanged

`packages/md/src/model/resolve-link.ts` holds `resolveLink`, built from `resolveTargets`,
`candidates` and `directoryIndex`. `linkResolves` calls it. `resolveLink` and `LinkTarget` are
exported from `@nielspeter/eess-md`'s root (ADR-011 concerns the kernel; eess-md's root is its
public API, and custom rules are the reason this exists).

**Files:** `packages/md/src/model/resolve-link.ts` (new), `packages/md/src/conditions/resolve.ts`,
`packages/md/src/index.ts`, `docs/markdown.md` (a section on writing a custom link rule with
`resolveLink`), `.changeset/` (eess-md minor, additive).

## Test inventory

- **The spelling table**, one row per form, each asserting its `kind` and `path`: `./a.md`,
  `a.md`, `../dir/a.md`, `a.md#x`, `#x` (`self`), `a%20b.md`, `/docs/a.md` with and without
  `rootDir`, `./guide` with `tryExtensions: ['.md']`, `./guide/` with `tryIndex`, a directory with
  and without `resolveDirectories`, a file outside `roots`, a missing file.
- **`linkResolves` is unchanged:** its existing tests in `packages/md/tests/links.test.ts` pass
  untouched.
- **External link:** `resolveLink` on an external link throws `ArchConfigError`.

**Break classes and sabotage rows** (ADR-009 rule 5; published API, so rule 6's deepest level):

- an emptied or identity resolver (returns `missing` for everything, or the URL unchanged) turns
  the spelling table red;
- `linkResolves` no longer calling `resolveLink` (a second resolver reintroduced) is caught by a
  test that stubs nothing and compares `linkResolves`' verdicts with `resolveLink`'s cases over the
  same table;
- swapping two cases (`outside-corpus` reported as `document`) turns a named row red.

`check:vacuity` does not reach this: `resolveLink` is a function, not a check-constructor.

## Out of scope

- Reference-style links (`[text][ref]`): `collectLinks` does not produce them, so they never reach
  the resolver. Proposal 013 lists them out of scope.
- Any change to what `linkResolves` accepts.

## Success

- A custom rule resolves a link with `resolveLink` and gets the same answer `linkResolves` gets.
- Each of the five cases is distinguishable by its `kind`.
- `npm run validate` green.

## Progress ledger

- [ ] Phase 1 — `resolveLink` extracted, exported, documented; `linkResolves` calls it
- [ ] the spelling table, one row per form
- [ ] the three sabotage rows go red
- [ ] proposal 013's disposition row for Ask C names this plan
- [ ] `npm run validate` green
