# Bug 0570: a link whose destination sits on a blockquote continuation line gets no fix

## Status

- **State:** Draft — found by PR #283's re-check, re-measured 2026-10-30; no red test yet.
- **Severity:** Low — a missing fix, not a false verdict: the broken link is still reported, but
  `--fix` offers nothing where it did before PR #283.
- **Origin:** self-found · PR #283's re-check.
- **Reported:** 2026-10-30

## Symptom

A link in a blockquote whose destination starts on the next line, `> See [x](` then
`> ./old/moved.md).`, gets no URL span, so a moved target gets no fix. The same link on one line
gets its fix. Before PR #283 the span was the last match of the URL in the link and found it.

## Reproduction

`docs/new/moved.md` exists; `links(c).that().areInternal().should().resolve()`, measured on main's
build:

```text
"# A\n\n> See [x](\n> ./old/moved.md).\n" → 1 finding(s), fix: null
"# A\n\n> See [x](./old/moved.md).\n" → 1 finding(s), fix: "./old/moved.md"
```

## Root cause

`destinationAt` (`packages/md/src/model/destination.ts:13`) skips spaces and one line ending after
the `](`, then stops at the continuation line's `>`, which is the blockquote's marker, not the
destination, so `writtenAt` finds no URL there.

## Fix

After the line ending, skip the container's continuation markers (`>` and the spaces around them)
as well, and keep refusing anything else. A list item's continuation is indentation, which the
whitespace skip already covers.

## Verification

- [ ] Red test written first: the reproduction's blockquote link gets its fix over the URL.
- [ ] A nested blockquote (`> >`) likewise; a `>` that is not a continuation marker is not skipped.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
