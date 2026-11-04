# Bug 0614: four heading shapes the VitePress rule reads differently from VitePress

## Status

- **State:** Draft — measured 2026-11-03 with VitePress 1.6.4's `createMarkdownRenderer`, while
  building [bug 0136](./fixed/0136-link-fragments-are-never-checked.md); pinned, no fix.
- **Severity:** Low — a false red or a false green on a fragment to one of four rare heading shapes
  on the `docs/` site, none of which `docs/` holds today.
- **Origin:** self-found · [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md)
  section 1, pinned by [bug 0136](./fixed/0136-link-fragments-are-never-checked.md)'s build.
- **Reported:** 2026-11-03

## Symptom

`check:corpus` judges a `docs/` link's fragment with `scripts/lib/vitepress-anchors.mjs`, which
slugs eess-md's reading of a heading's text. VitePress slugs markdown-it's tokens, and four shapes
differ:

| Heading                                    | VitePress's id    | the rule's            |
| ------------------------------------------ | ----------------- | --------------------- |
| `## :tada: Release`                        | `release`         | from `:tada: Release` |
| `## Foo &amp; Bar`                         | `foo-amp-bar`     | from `Foo & Bar`      |
| `## Copy&copy;right`                       | `copy-copy-right` | from `Copy©right`     |
| `## Notes[^1]`, with a footnote definition | `notes-1`         | from `Notes`          |

`scripts/lib/vitepress-anchors.test.mjs` pins that the rule does not reach VitePress's id for each
(`test('four heading shapes the VitePress rule reads differently from VitePress (bug 0614)')`), so a
change either way is seen.

## Root cause

The rule takes heading text ([spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 1: headings' texts in, ids out). An emoji
shortcode is a token VitePress drops, an entity is kept as written, and VitePress has no footnote
plugin, so each needs the source, which the text does not carry.

## Fix

Not designed. The rule could be given each heading's source text beside its text, or this repository
could keep these shapes out of `docs/` headings with a rule of its own.

## Verification

- [ ] Each of the four shapes is reached by VitePress's id, or refused by a rule over `docs/`.
- [ ] The pinning test is updated to the new verdict.
- [ ] `npm run validate` green.

Deferred: none
