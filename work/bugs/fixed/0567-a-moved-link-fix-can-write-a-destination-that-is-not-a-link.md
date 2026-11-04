# Bug 0567: a moved link's fix can write a destination that is not a link, and the run goes green

## Status

- **State:** Fixed — the moved-link fix writes its destination through one writer and is kept only
  when the document still holds the link (2026-11-04). Found by PR #283's architect review,
  re-measured 2026-10-30.
- **Severity:** High — a false green: `--fix --apply` rewrites a broken link into text that is no
  longer a link, the finding goes away, and the rule still examines other links, so no
  zero-examined finding fires.
- **Origin:** self-found · PR #283's architect review.
- **Reported:** 2026-10-30

## Symptom

`movedLinkFix` (`packages/md/src/model/resolve-link.ts:273`) builds the new destination with
`relativeLinkPath` and writes it into the URL's span as it is. A target path holding a space or a
parenthesis needs `<…>` to stay a link destination, and a `|` in a table row ends the cell, but
nothing checks either. The mention fix does: `destinationOf`
(`packages/md/src/conditions/be-linked.ts:103`) writes `<…>` where it must and refuses what no
destination can hold.

## Reproduction

`docs/a.md` holds `See [b](./old/b.md) now. Also [c](./c.md).`, `docs/c.md` exists, and the target
moved to `docs/new dir/b.md`. `links().that().areInternal().should().resolve()`, then
`applyFixes(…, { write: true })` and the rule again, measured on main's build plus PR #283:

```text
before: [ 'broken link: "./old/b.md" does not resolve to a fi' ] fix: "./new dir/b.md"
apply: {"applied":1,"skipped":0,…}
after text: "See [b](./new dir/b.md) now. Also [c](./c.md)."
after findings: [] examined 1
```

`[b](./new dir/b.md)` is not a link (a space ends a bare destination), so it is no longer
examined, and the run is green. PR #283's architect review measured the same with `new (2)/b.md`
and with `a|b/b.md` in a table row. A definition's span (`[d]: …`) feeds the same fix.

## Fix

Not chosen. The review's direction: one owner for writing a destination, beside reading one, in
`packages/md/src/model/destination.ts`: move `destinationOf`'s write rules there, and have
`movedLinkFix` give no fix when the target cannot be written in the form the span holds (a plain
span cannot take `<…>` without widening it; an angle span cannot take `>`). Possibly a re-parse
backstop for moved-link fixes, as `fixesThatKeepTheDocument`
(`packages/md/src/model/fix-check.ts:204`) is for the mention fix.

**Built 2026-11-04**, with [bug 0575](./0575-a-fragment-the-link-check-cannot-judge-passes.md)
(the same function): `writeDestination` (`packages/md/src/model/destination.ts:41`), beside the
reader, is the one writer; the mention fix's `destinationOf` uses it for its last step. `movedLinkFix`
writes through it, in `<…>` where a space or a parenthesis needs it and as it is inside a span
already in `<…>`, and keeps the fix only when the document, read again with it applied, holds as
many links as before and one to the new URL: the review's re-parse backstop, as
`fixesThatKeepTheDocument` is for the mention fix. A `|` in a table row fails that check, so it gets
no fix.

The review round tightened it: the fix is kept only when `resolveLink` of the new URL reaches the
file the fix names (a `?`, `%` or `%20` in a folder name wrote a link the next run reported, with no
finding for `--fix --apply` to exit on), and the re-read document must hold the new URL at the
rewritten span. Not checked: two moved-link fixes in one document applied together; each is checked
alone, as `applyFixes` drops overlaps, and no input is known where two separately safe ones break.

## Verification

- [x] Red test written first: the reproduction gets no fix, or a fix that keeps the link a link
      (`<./new dir/b.md>`), and after applying it the rule still reports or resolves it. `packages/md/tests/link-fragments-reach.test.ts` · `it('a target with a space is written in <…>, and after the fix the link resolves')`; with the old `movedLinkFix` it and three rows below red (measured).
- [x] A target with a parenthesis, and one with a `|` in a table row, likewise. Pinned: `it('a target with a parenthesis is written in <…> too')` and `it('a target with a | in a table row gets no fix: it would split the cell')`; and a span already in `<…>`: `it('a destination already in <…> is rewritten inside it')`.
- [x] A plain target still gets its fix. Pinned: `it('a plain target still gets its plain fix')`.
- [x] A changeset naming `@nielspeter/eess-md`. : `.changeset/a-fragment-reaches-every-target.md`.
- [x] `npm run validate` green.

Deferred: none
