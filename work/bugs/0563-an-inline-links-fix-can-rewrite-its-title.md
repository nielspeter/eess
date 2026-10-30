# Bug 0563: an inline link's fix can rewrite its title instead of its URL

## Status

- **State:** Draft — found by PR #282's architect review, re-measured 2026-10-30 on main's build
  (eess-md 0.13.0 plus PR #282); no red test yet.
- **Severity:** Medium — a fix that writes the wrong span: applied, it rewrites the title and
  leaves the broken URL in place, which `resolve()` still reports, so it is a corrupt edit, not a
  false green.
- **Origin:** self-found · PR #282's architect review. PR #282 anchored the same search for a
  reference-style link's definition; the inline path predates it and is recorded here, not fixed
  there.
- **Reported:** 2026-10-30

## Symptom

A broken inline link whose target moved gets a fix rewriting its URL. The fix's span is found by
searching the link's raw text for the decoded URL, from the end. When the destination is written
with an escape or an entity, the raw destination is not the decoded URL, and the last match can be
the title.

## Reproduction

`docs/a.md` holds `See [x](<./old/a\>b.md> "./old/a>b.md").` (an escaped `>` in the destination,
and a title holding the decoded URL), and `docs/new/a>b.md` exists. Measured:

```text
inline fix: {"span":"./old/a>b.md","replacement":"./new/a>b.md"}
  applied line: "See [x](<./old/a\\>b.md> \"./new/a>b.md\")."
```

The title is rewritten; the URL is still `./old/a\>b.md`.

## Root cause

`collectLinkBlocks` takes `raw.lastIndexOf(node.url)` over the link's raw text
(`packages/md/src/model/links.ts:214`), with no anchor to where the destination starts.

## Fix

As PR #282 does for a definition (`packages/md/src/model/definitions.ts`): accept a match only
where the destination starts, after the link text's `](`, and leave the span absent, so no fix,
anywhere else.

## Verification

- [ ] Red test written first: the reproduction gets no fix. Today the fix rewrites the title.
- [ ] A plain inline link and one with a title still get their fix over the URL.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
