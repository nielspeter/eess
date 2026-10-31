# Bug 0575: a fragment the link check does not read passes, and the autofix moves it unchecked

## Status

- **State:** Draft — split from [bug 0136](./0136-link-fragments-are-never-checked.md) by
  [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md), 2026-11-01; no red test yet.
- **Severity:** High — a false green: `resolve()` passes a link whose fragment it never looked at
  (Symptom 1). Symptom 2 is a bad suggestion once [bug 0136](./0136-link-fragments-are-never-checked.md) lands, since the rewritten link is then
  caught on the next run.
- **Origin:** self-found · [bug 0136](./0136-link-fragments-are-never-checked.md)'s Symptom (4) and
  Fix (3), (4), split out so each closes whole.
- **Reported:** 2026-11-01

## Symptom

1. **A fragment on a file the corpus did not load, or on a directory, is never judged.**
   `resolveLink` reports such targets as `not-in-corpus` and `directory`
   (`packages/md/src/model/resolve-link.ts:81`), and `resolve()` accepts both
   (`packages/md/src/conditions/resolve.ts:64`, `:67`), so `[x](../outside/notes.md#gone)`,
   `[x](./src/a.ts#L9999)` and `[x](./fixed/#gone)` pass with the fragment unread. This repository
   holds none; a README sample of [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md)
   holds 74 (39 into `.md` files, 35 line fragments on code files), all unread in a corpus that
   loads only the README.
2. **The moved-link fix carries the fragment over unchecked.** `movedLinkFix`
   (`packages/md/src/model/resolve-link.ts:273`), called by `resolve()` and `beLinkedBack()`,
   rewrites `./old.md#section` to `./new.md#section` on a basename match, whatever `new.md` holds.

## Fix

Decided in [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md), decisions 4 and 5,
built on [bug 0136](./0136-link-fragments-are-never-checked.md)'s anchor sets and released with it:

- A Markdown file the corpus did not load is read for its anchors alone through `readCorpusFile`
  (`packages/md/src/model/corpus-internals.ts:31`), as `pointerResolves` reads a file outside the
  roots, unless the caller ignored it.
- `#L10`, `#L10-L20` and `#L10C5` on a file that is not Markdown is a line, checked against
  `lineCount(readCorpusFile(…))` (`packages/md/src/conditions/pointer-resolve.ts:102`). On a
  Markdown file it is an anchor like any other.
- A fragment on a directory is checked against the directory's index document where one is loaded
  or readable, else it is not judged.
- Anything else is not judged: a finding in [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s class for what the rule's own instrument
  could not read ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
  rules 3 and 5): `bypassFilters`, one per target file within a rule, naming the file, why it was
  not read, and the links it covers, as unread mentions are reported
  (`packages/md/src/builders/mentions.ts:244`).
- `movedLinkFix` offers its rewrite, at both callers, only when the new document's anchor set holds
  the fragment; otherwise the finding stays, with no fix.

## Verification

- [ ] Red test written first: `[x](../outside/notes.md#gone)` beside an existing, unloaded
      `outside/notes.md` with no such heading is red, and `#present` beside its heading passes.
- [ ] `[x](./src/a.ts#L3)` passes on a three-line file; `#L4` and `#L2-L4` are red; `#L2C5` passes.
- [ ] `[x](./notes.md#L3)` on a loaded Markdown file is checked as an anchor, and red.
- [ ] A fragment on a directory with a loaded `README.md` is checked against it; on one with none,
      it is not judged.
- [ ] A fragment on an ignored file and on a `.pdf` is not judged: one finding per target file,
      surviving `.excluding()`, `.warn()` and an exclusion comment.
- [ ] A moved link whose fragment the new document holds is fixed, at both callers; one whose
      fragment it does not hold is reported with no fix.
- [ ] Non-vacuity rows, each red on its own under a probe: a fragment link to an existing file
      outside the corpus roots; `#L<n+1>` on an existing n-line code file; and the gate summary's
      not-judged count non-zero under a not-judged probe, so a denominator of 0 cannot pass.
- [ ] A changeset naming `@nielspeter/eess-md`, a minor marked `**Breaking (@nielspeter/eess-md):**`
      with a migration line, released with [bug 0136](./0136-link-fragments-are-never-checked.md)'s.
- [ ] `npm run validate` green.

Deferred: none
