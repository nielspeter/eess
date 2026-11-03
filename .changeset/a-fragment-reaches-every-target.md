---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** a link's `#fragment` is judged on every target, and a fragment `resolve()` cannot judge is reported (bug 0575). Released with the fragment check of bug 0136:

- A Markdown file the corpus did not load is read for its anchors alone, so `[x](../outside/notes.md#gone)` is red when `notes.md` has no such heading.
- A line fragment (`#L5`, `#L5-L9`, `#L5C3`) on a file that is not Markdown, or after `?plain=1` on a Markdown file, is judged against the file's lines and the line's columns: `broken fragment: … is past the end of src/a.ts, which has 31 lines`.
- A fragment on a directory link is judged against the page the anchor rule names for a directory, a new optional `AnchorRule.directoryPage` (`README.md` under `githubAnchors`), loaded or not.
- Anything else (a fragment on a file the corpus ignores, on a file that is not text such as a PDF or an image, an anchor on a text file that is not Markdown, a directory with no such page, or a hand-built link from a document the corpus did not load) is one `md/fragment-not-judged` finding per target file and cause, naming the links it covers. It is unsuppressable: `.excluding()`, `.warn()`, an exclusion comment and a baseline do not hide it. The rule id is exported as `FRAGMENT_NOT_JUDGED`, and `NotJudgedReason` names its causes.
- `FragmentVerdict` gains `out-of-range` and `not-judged`, and `resolveLink()` sets `fragment` on `not-in-corpus` and `directory` targets too.

The moved-link fix (`resolve()` and `beLinkedBack()`) carries a fragment over only when the new target holds it, writes the new destination in `<…>` where a space or a parenthesis needs it, and offers no fix when the document, read again with it applied, would not hold the link (bug 0567: `[b](./new dir/b.md)` was text, not a link, and the run went green).

The fix is also kept only when the new URL resolves to the file it names, so a folder name holding `?` or `%` gets no fix.

Migration: a fragment on a PDF, an image or another file that is not text is now a finding; link the file without the fragment. An anchor on a text file that is not Markdown is one too; link it without the fragment, or as a line (`#L5`).
