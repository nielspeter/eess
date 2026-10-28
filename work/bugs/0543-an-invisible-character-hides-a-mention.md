# Bug 0543: an invisible character hides a mention

## Status

- **State:** Draft — probed on 2026-10-21 by PR #257's enforcement review against eess-md's build of
  that branch; no red test yet.
- **Severity:** Medium — **a mention a reader sees can be hidden from `mentions()` by a character
  nobody sees.** `bug`, a zero-width space and `0338` render as `bug0338` or as the plain mention to a
  reader, are not matched by a caller's pattern, and so are neither a finding nor an element. An
  agent facing a red `beLinked()` can stamp one in, and a reviewer reading the rendered diff cannot
  tell.
- **Origin:** self-found, 2026-10-21, PR #257's enforcement review of
  [plan 0539](../plans/completed/0539-a-mention-of-a-record-is-a-link.md) (its I6). Recorded rather
  than fixed there: the fix is a design decision, not a defect in what the plan built.
- **Reported:** 2026-10-21

## Symptom

Each of these is green under `mentions(c, { pattern: /\bbug\s+\d{4}\b/g }).should().beLinked()`
in a corpus that holds other mentions (examined 1, findings 0), measured by the review's probes:

```text
text, as written in the source              what a reader sees
------------------------------------------  ------------------
"bug", U+200B ZERO WIDTH SPACE, " 0338"     bug 0338
"bug&#8203;0338"                            bug0338
"bug 03", U+00AD SOFT HYPHEN, "38"          bug 0338
"b", U+200D ZERO WIDTH JOINER, "ug 0338"    bug 0338
```

The pattern is the caller's ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)),
so no pattern eess-md could ship is wrong here; but a caller cannot reasonably be asked to allow an
invisible character between every two letters of every word.

## Root cause

`collectMentions` (`packages/md/src/model/mentions.ts`) matches the caller's pattern against the
text as parsed. Unicode format characters (category `Cf`: zero-width space, joiner and non-joiner,
soft hyphen, and the like) are kept in that text and are invisible when rendered.

## Fix

Undecided. One shape: match over the run's text with `Cf` characters removed, keeping a map back to
the original offsets for each match's line, and report a mention found only that way with its own
message ("holds an invisible character"), so the stamp is red rather than merely matched. Another:
report any `Cf` character inside a run as its own finding. Either changes what an existing rule
sees, so it ships with a changeset that says so.

## Verification

- [ ] A red test per character above, driven through `mentions()`.
- [ ] The chosen shape, with its message, and the docs' "What this cannot see" updated.
