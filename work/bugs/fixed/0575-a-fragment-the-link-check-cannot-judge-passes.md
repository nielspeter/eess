# Bug 0575: a fragment the link check does not read passes, and the autofix moves it unchecked

## Status

- **State:** Fixed — a fragment on a file the corpus did not load, a line and a directory is
  judged, anything else is an unsuppressable finding, and the moved-link fix carries a fragment only
  when the new target holds it (2026-11-04). Split from
  [bug 0136](./0136-link-fragments-are-never-checked.md) by
  [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md), 2026-11-01.
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
   holds none; a README sample of [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md)
   holds 74 (39 into `.md` files, 35 line fragments on code files), all unread in a corpus that
   loads only the README.
2. **The moved-link fix carries the fragment over unchecked.** `movedLinkFix`
   (`packages/md/src/model/resolve-link.ts:273`), called by `resolve()` and `beLinkedBack()`,
   rewrites `./old.md#section` to `./new.md#section` on a basename match, whatever `new.md` holds.

## Fix

Decided in [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md), decisions 4 and 5,
built on [bug 0136](./0136-link-fragments-are-never-checked.md)'s anchor sets and released with it:

- A Markdown file the corpus did not load is read for its anchors alone through `readCorpusFile`
  (`packages/md/src/model/corpus-internals.ts:31`), as `pointerResolves` reads a file outside the
  roots, unless the caller ignored it.
- A line fragment after `?plain=1` on a Markdown file (`./a.md?plain=1#L5`, GitHub's source view)
  is a line too, checked the same way; [bug 0136](./0136-link-fragments-are-never-checked.md)
  leaves it unjudged (added 2026-11-03 by its enforcement review).
- `#L10`, `#L10-L20` and `#L10C5` on a file that is not Markdown is a line, checked against
  `lineCount(readCorpusFile(…))` (`packages/md/src/conditions/pointer-resolve.ts:102`), and a
  column against its line's length. On a Markdown file it is an anchor like any other.
- A fragment on a directory is checked against the page the anchor rule names for a directory (a
  new optional `AnchorRule` member, so a caller's rule written for [bug 0136](./0136-link-fragments-are-never-checked.md) keeps compiling)
  (under the default, the directory's `README.md`), loaded or read on demand; a directory with no
  such page, or a rule that names none, leaves it not judged.
- Anything else is not judged: a finding in the class
  [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 3 names, for what
  the rule's own instrument could not read: `bypassFilters`, as unread mentions are
  (`packages/md/src/builders/mentions.ts:186`), and one per target file within a rule, as its rule 5
  says, naming the file, why it was not read, and the links it covers.
- `movedLinkFix` offers its rewrite, at both callers, only when the new document's anchor set holds
  the fragment; otherwise the finding stays, with no fix.

**Built 2026-11-04.** `resolveLink` sets a verdict on `not-in-corpus` and `directory` targets too:
`unloadedVerdict` (`packages/md/src/model/resolve-link.ts:280`) reads an unloaded Markdown file for
its anchors (`unloadedDocument`, `:240`, once per corpus), judges a line fragment on any other file
(`judgeLine`, `packages/md/src/model/anchors.ts:258`, with `lineCount`), and marks the rest
`not-judged`; `directoryVerdict` (`:310`) judges against `AnchorRule.directoryPages`, a new optional
member tried in order (`['README.md']` under `githubAnchors`). `resolve()` reports a `not-judged` fragment as one
`md/fragment-not-judged` finding per target and cause (`notJudgedFinding`,
`packages/md/src/conditions/resolve.ts:162`), through `unreadFinding`, so it carries
`bypassFilters`. `movedLinkFix` (`resolve-link.ts:465`) carries a fragment only when `resolveLink`
finds it on the new target, at both callers. A line after `?plain=1` on a loaded Markdown file is
judged as a line now, as [bug 0136](./0136-link-fragments-are-never-checked.md) deferred here.

**Review round (2026-11-04).** The architect and enforcement reviews changed the build:

- A file that is not text (one holding a NUL byte or bytes UTF-8 does not decode, or opening
  `%PDF-`, which an ASCII-only PDF does) is not judged: `#L1` on a PDF or an image passed
  as a line, and the not-judged finding's own remedy ("link a line of it as `#L5`") led there. Its
  cause is `not-text`, whose remedy offers no line; `not-markdown` is now only a text file.
- A hand-built self link from a document the corpus did not load is `not-loaded`, not a silent
  pass, as [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md) decision 4 named it; a directory whose rule names no page is `no-page-rule`,
  apart from `no-directory-page`, whose remedy names the rule's own page; an ignored target's
  remedy says to remove it from `ignore`, and a directory's page is named as the file.
- The not-judged finding sits at a reference-style link's definition, once per site.
- The moved-link fix is kept only when `resolveLink` of the new URL is the file the fix names (a
  `?`, `%` or `%20` in a folder name wrote a link the next run reported) and when the re-read
  document holds the new URL at the rewritten span, not anywhere; the document's link count is
  taken once.
- `#L0`, a column 0 and a line on an empty file each name what is wrong.
- The three non-vacuity rows became one, `corpus/links/fragment-reach`, with a fourth payload for a
  directory's page: one gate run, each payload required (directory MISSING with directory verdicts
  switched off, measured).

Which files a host renders, so that a line fragment reaches nothing on them, is
[bug 0615](../0615-which-files-the-host-renders-decides-a-line-fragment.md).

## Verification

- [x] Red test written first: `[x](../outside/notes.md#gone)` beside an existing, unloaded
      `outside/notes.md` with no such heading is red, and `#present` beside its heading passes. `packages/md/tests/link-fragments-reach.test.ts` · `it('an unloaded Markdown file is read for its anchors')`; six of the file's rows red with unloaded and directory verdicts switched off (measured).
- [x] `[x](./src/a.ts#L3)` passes on a three-line file; `#L4` and `#L2-L4` are red; `#L2C5`
      passes on a line of five or more characters and is red on a shorter one. Pinned: `it('a line fragment on a file that is not Markdown is judged against its lines and columns')` (with `#L1C2` on a one-character line as the short case).
- [x] `[x](./notes.md#L3)` on a loaded Markdown file is checked as an anchor, and red; and
      `[x](./notes.md?plain=1#L3)` is checked as a line. Pinned: `it('on a loaded Markdown file #L3 is an anchor, and after ?plain=1 it is a line')`.
- [x] Under the default rule, a fragment on a directory holding a `README.md` is checked against
      it, loaded or not; on a directory with none, it is not judged. Pinned: `it('a fragment on a directory is judged against its README.md, loaded or not; with none it is not judged')` and `it('an unloaded README.md of a directory is read for its anchors')`.
- [x] A fragment on an ignored file and on a `.pdf` is not judged: one finding per target file,
      surviving `.excluding()`, `.warn()` and an exclusion comment. Pinned: `it('a .pdf and an ignored file: one finding each, naming the links it covers')` and `it('survives .excluding(), .warn() and an exclusion comment')`, which reds with `bypassFilters` removed (measured).
- [x] A moved link whose fragment the new document holds is fixed, at both callers; one whose
      fragment it does not hold is reported with no fix. Pinned: `it('resolve() and beLinkedBack() fix a moved link whose fragment the new document holds')` and `it('a moved link whose fragment the new document does not hold is reported with no fix, at both callers')`.
- [x] Non-vacuity rows, each red on its own under a probe: a link to an existing Markdown file
      outside the corpus roots with a fragment that file does not hold; `#L<n+1>` on an existing
      n-line code file; a fragment on a target that cannot be read (an ignored file or a `.pdf`);
      and the gate summary's
      not-judged count non-zero under a not-judged probe, so a denominator of 0 cannot pass. : `corpus/links/fragment-reach` in `scripts/check-nonvacuity.mjs`, one probe with four payloads (the root `README.md`, outside the gate's roots; `package.json#L999999`; `packages/md/` as a directory; a fragment on `package.json`) and the summary's `1 not judged`, each required; the not-judged count reported NOT COUNTED and the directory payload MISSING under their sabotages (measured).
- [x] A changeset naming `@nielspeter/eess-md`, a minor marked `**Breaking (@nielspeter/eess-md):**`
      with a migration line, released with [bug 0136](./0136-link-fragments-are-never-checked.md)'s. : `.changeset/a-fragment-reaches-every-target.md`.
- [x] `npm run validate` green.

Deferred: none
