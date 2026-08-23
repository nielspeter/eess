# Plan 0212: `eess-mermaid`'s own surface never mentions fences

## Status

- **State:** Draft — a docs gap, sized narrowly after review measured it. The
  capability exists and ships; nothing here is new API.
- **Implements:** proposal 006
- **Priority:** Low — it closes a
  discoverability gap that made a consuming project file an ask for a feature that
  already existed, which is the fourth time this lane has seen that.
- **Effort:** Small — two paragraphs and a cross-link. One package's README plus a
  docs page; no source change.
- **Created:** 2026-08-22

## Problem

Reading diagrams out of Markdown fences works today. `eess-md` exposes every fence as
`MdCodeBlock { lang, value, line }`, and `eess-crossvalidate`'s `md-mermaid` and
`md-mermaid-er` bindings both consume it.

None of that is findable from the dialect a reader would start at:

- `packages/mermaid/README.md` never uses the word "fence". Its only example is
  `diagram('docs/architecture.mmd')` — a standalone file — so the front door reads as a
  single-diagram-file API.
- Neither the root `README.md` nor anything under `docs/` mentions `md-mermaid` at all.
- `packages/mermaid/src/cli/watch.ts:12` watches `/\.(mmd|[cm]?tsx?|[cm]?jsx?)$/` — no
  `.md`. For a corpus whose diagrams are all fenced, mermaid's watch mode never re-runs.

Proposal 006 was filed by a project whose entire diagram corpus is fenced, asking for a
capability that ships. The survey found it; the reader could not.

## Approach

Say it where a reader looks, and only there. This plan does **not** re-export or move
anything — placement is proposal 006's open question 1 and is not settled here.

- `packages/mermaid/README.md` — a short section: fenced diagrams are read via
  `@nielspeter/eess-crossvalidate/md-mermaid`, with the one-liner and a pointer.
- `docs/` — the crossvalidate page gains a Markdown ↔ Mermaid section (it currently
  documents four bindings and not this one, and closes with a stale "both presets" count).
- `watch.ts` — **state in the README that watch mode is `.mmd`-only.** Not a code change.
  Adding `.md` to the pattern would teach the `eess-mermaid` CLI that Markdown is a diagram
  container, which is a _container_ fact — the exact line
  [0214](./0214-extract-the-diagram-kind-predicate.md) draws, and the branch of proposal 006's
  OQ1 that `arch.rules.ts`'s `eess/mermaid-isolated` gates shut. A docs plan must not settle
  a placement question by implication. (It would not trip the arch rule — there is no import
  edge — which is why it has to be caught here.)

## Files Changed

- `packages/mermaid/README.md`
- `docs/crossvalidate.md`
- `docs/mermaid.md` — the dialect's own docs page; verified to contain no occurrence of
  "fence", "markdown" or ".md"
- a changeset naming `@nielspeter/eess-mermaid` — README edits under `packages/<name>/`
  count as a change, so this needs a bump or an explicit `none`

## Verification

- [ ] A reader starting at `packages/mermaid/README.md` can find fenced-diagram support
      without already knowing `md-mermaid` exists.
- [ ] `docs/crossvalidate.md` documents the Markdown ↔ Mermaid binding, and its "both
      presets" count matches the seven subpaths the package actually exports.
- [ ] The watch-mode limitation is stated where a user meets it.
- [ ] **Link, don't restate.** The canonical prose already lives at
      `packages/crossvalidate/README.md` — this plan must not create a fifth place
      documenting one preset, which is the drift shape CLAUDE.md already records a lesson
      about. Reviewable as: no new paragraph duplicates that README's semantics.

## Out of Scope

- **Re-exporting the fence loop from `eess-mermaid`.** That is proposal 006's OQ1, and
  the "corpus dialect" branch is gated shut by `arch.rules.ts`'s `eess/mermaid-isolated`.
  Reversing a gated invariant is an ADR decision, not a docs plan.
- `diagram()`'s provenance — [0213](./0213-diagram-provenance-for-fence-callers.md).
- Extracting `declaredKind()` — [0214](./0214-extract-the-diagram-kind-predicate.md).
