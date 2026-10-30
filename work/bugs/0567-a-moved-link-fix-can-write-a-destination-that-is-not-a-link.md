# Bug 0567: a moved link's fix can write a destination that is not a link, and the run goes green

## Status

- **State:** Draft — found by PR #283's architect review, re-measured 2026-10-30; no red test yet.
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

## Verification

- [ ] Red test written first: the reproduction gets no fix, or a fix that keeps the link a link
      (`<./new dir/b.md>`), and after applying it the rule still reports or resolves it.
- [ ] A target with a parenthesis, and one with a `|` in a table row, likewise.
- [ ] A plain target still gets its fix.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
