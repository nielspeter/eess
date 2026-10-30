# Bug 0558: a reference-style link or a raw HTML link is never examined, and `resolve()` says nothing

## Status

- **State:** Draft — measured on the v0.16.0 build (eess-md 0.13.0), Node 24.22.0; no red test yet.
- **Severity:** High — a false green: `links().should().resolve()` passes over a broken link
  written in a form it does not read, and its count gives no sign that it skipped one.
- **Origin:** self-found · the maintainer's question, 2026-10-30, whether GitHub Flavored Markdown
  is supported; measured by probing each GFM construct against the link check.
- **Reported:** 2026-10-30

## Symptom

`links(c).should().resolve()` reads only inline links, `[text](url)`. Two other ways to write a
link are never selected, never resolved and never reported:

1. **A reference-style link**, `[text][label]` or `[label]`, whose target is a definition
   elsewhere in the document, `[label]: ./target.md`. Both forms are CommonMark.
2. **A raw HTML link**, `<a href="./target.md">`, which GFM allows in a document.

The rule's `examined` counts only the inline links, so a document whose broken links are all in
these forms is green with a count that looks complete.

## Reproduction

One document under `docs/**`, every target missing:

```markdown
# Links

A [reference link][gone] and a [shortcut] link.

[gone]: ./gone-reference.md
[shortcut]: ./gone-shortcut.md

<a href="./gone-html.md">raw html</a>

An inline [control](./gone-inline.md).
```

`links(corpus({ cwd, roots: ['docs/**'] })).should().resolve().violations()`, measured:

```text
links: examined 1 · violations 1
  line 10 broken link: "./gone-inline.md" does not resolve to a file in the repo
```

The reference link, the shortcut link and the HTML link, three broken targets, produce nothing.

## Root cause

The link walk turns a `link` node into an element and only counts a `linkReference` node
(`packages/md/src/model/links.ts:171`), for the declaration scan that `areLabelled()` reports
from. The `definition` node that holds a reference link's URL is never read, and an `html` node is
never scanned. `resolve()` runs over the elements the walk produced, so it cannot see either form.

The family already discloses both forms elsewhere: `mentions()` reports a mention inside a raw
HTML block or a reference-style link's text as `md/unread-mention`
(`packages/md/src/builders/mentions.ts:49`), and `areLabelled()` reports a declaration made of
reference-style links as one it does not read. `links()` is the rule a reader trusts for "every
link resolves", and it does neither.

## Why it matters

GitHub READMEs and wikis use reference-style links to keep long URLs out of the prose. A corpus
written that way has a link gate that checks a fraction of its links and says it checked them all.
This repository has one Markdown file with a reference definition, a nonvacuity fixture
(`scripts/nonvacuity/bad-declared-block/unreadable.md`), so its own gate does not show the gap;
an adopter's corpus can.

## Fix

Two parts, one root cause:

1. **Resolve reference-style links.** A `linkReference` whose label has a `definition` is a link
   with that definition's URL: select it in `links()`, at the reference's own line, and resolve it
   with the same `resolveLink`. A reference with no definition is not a link in CommonMark (it
   renders as text) and stays out.
2. **Report raw HTML links as unread.** A link inside an `html` node is reported as unread, as
   `mentions()` does, so the rule is never green over one without a word. Resolving it is a new
   capability, [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md).

## Verification

- [ ] Red test written first: the reproduction's `[reference link][gone]` and `[shortcut]` produce
      a broken-link finding each, at their own line. Green today.
- [ ] Red test: the reproduction's `<a href>` produces an unread finding. Green today.
- [ ] A reference link to a file that exists, and an undefined `[label]`, produce nothing.
- [ ] A nonvacuity row reddens on a broken reference-style link.
- [ ] A changeset naming `@nielspeter/eess-md`: `resolve()` reports more than it did.
- [ ] `npm run validate` green.

Deferred: resolving a raw HTML link → [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md).
