# Bug 0575: a fragment the link check cannot judge passes, and the autofix moves it unchecked

## Status

- **State:** Draft — split from [bug 0136](./0136-link-fragments-are-never-checked.md) by
  [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md), 2026-11-01; no red test yet.
- **Severity:** High — a false green: `resolve()` passes a link whose fragment it never looked at,
  and `--fix` writes an anchor onto a document that may not hold it, creating the drift the gate
  exists to catch.
- **Origin:** self-found · [bug 0136](./0136-link-fragments-are-never-checked.md)'s Symptom (4) and
  Fix (3), (4), split out so each closes whole.
- **Reported:** 2026-11-01

## Symptom

1. **A fragment on a file the corpus did not load is never judged.** `resolveLink` reports such a
   target as `not-in-corpus` (`packages/md/src/model/resolve-link.ts:80`), and `resolve()` accepts
   that case (`packages/md/src/conditions/resolve.ts:64`), so `[x](../outside/notes.md#gone)` and
   `[x](./src/a.ts#L9999)` pass with the fragment unread.
2. **The moved-link fix carries the fragment over unchecked.** `movedLinkFix`
   (`packages/md/src/model/resolve-link.ts:273`) rewrites `./old.md#section` to `./new.md#section`
   on a basename match, whatever `new.md` holds.

## Fix

Decided in [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) (decisions 4 and 5),
built after [bug 0136](./0136-link-fragments-are-never-checked.md)'s anchor set exists:

- A `#L10` or `#L10-L20` fragment on any file is a line, checked against the file's line count as a
  pointer's line is ([bug 0561](./fixed/0561-a-pointer-one-line-past-the-end-of-a-file-passes.md)).
- Any other fragment on a `not-in-corpus` target is a finding that names the fragment and the
  remedy (load the file, or remove the fragment): running out of knowledge is never a pass
  ([ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)).
- `movedLinkFix` offers its rewrite only when the new document's anchor set holds the fragment;
  otherwise the finding stays, with no fix.

## Verification

- [ ] Red test written first: `[x](../outside/notes.md#gone)` beside an existing, unloaded
      `outside/notes.md` produces a finding naming the fragment.
- [ ] `[x](./src/a.ts#L3)` passes on a three-line file and `#L4` is red; `#L2-L3` passes.
- [ ] A moved link whose fragment the new document holds is fixed; one whose fragment it does not
      hold is reported with no fix.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
