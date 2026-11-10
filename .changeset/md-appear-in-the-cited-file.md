---
'@nielspeter/eess-md': minor
---

`mentions(…).should().appearInTheCitedFile()` (plan 0648): a named code reference, as
`` `pathSuffixIndex` (`src/index.ts:1`) ``, is red when its cited file no longer holds the name as a
whole token. It needs `keepBackticks` and a pattern with `name` and `path` groups, each matched inside
its own code span, and no code facts. It claims the file holds the name, not that a cited line does.

- A reference it cannot judge (a group that did not capture, a name or path outside one code span, a
  name that is not an identifier of two or more characters, a path matching several files) is a
  finding that fails even under `.warn()` and cannot be excluded.
- A broken path is reported by this rule and by `pointers().resolve()`, each under its own id;
  `corpus/pointers-resolve` waivers do not cover the new rule.
- `pointers().resolve()` now resolves its in-repo step through the same classifier; its findings,
  its external roots and its fix are unchanged.
- The unread-mention finding no longer names `beLinked`'s verdict: it reads "so this rule cannot
  judge it", and the image alt and title remedies no longer end "as a link".
