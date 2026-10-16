# Bug 0445: a checkbox marked `[~]` or `[?]` is invisible, so a closed record can hide unresolved items

## Status

- **State:** Draft — recorded 2026-10-16; reproduced here on main's build. No red test yet.
- **Severity:** Medium — a false green: a closed record whose items are all `[~]` passes the closing check. In this repository, four `[~]` items sit in closed records that `check:ledger` cannot see: `work/bugs/fixed/0249-most-of-work-is-outside-every-corpus-root.md:160`, `:167` and `:201`, and `work/bugs/fixed/0256-the-spike-lane-is-run-but-never-declared.md:130`. Adopters report more (as reported, not measured here).
- **Origin:** inbound · two adopter monorepos (unnamed), feedback on proposal 017, verified here.
- **Reported:** 2026-10-16

## Symptom

GFM recognises only `[ ]`, `[x]` and `[X]` as a task box. `collectTaskItems` keeps a list item only
when mdast gives it a boolean `checked` (`packages/md/src/model/task-items.ts:37`), so `- [~] half
done` is an ordinary list item. Reproduced: a record in `completed/` with `**State:** Done` and three
items, `- [~] half done`, `- [?] unknown`, `- [ ] really open`, gets one finding, for the `[ ]` box.
The other two are not seen, and nothing says they were skipped.

The inbound report also said nested boxes are missed; that did not reproduce. Measured on main: `[ ]`, `[x]`, `[X]`, `*`, `+` and numbered bullets, and boxes nested under a box or
a plain item at two- or four-space indent, are all read; boxes in fences and blockquotes are skipped
on purpose. Only the non-GFM marks are missed.

## Root cause

A corpus convention (`[~]` for in progress, `[?]` for unknown) that the parser cannot know, with no
way for the caller to declare it and no report that it was ignored.

## Fix

The caller names extra box marks and what each means (open or done), with no default marks beyond
GFM's (proposal 017's principle). A list item whose text starts with a bracketed mark the caller did not name is reported as an unknown box state rather than skipped. **Breaking:** a corpus that carries such marks and passes today will red (this repository's four included), so the fix ships as a flagged break with a migration line ("declare the mark, or rewrite the box").

## Verification

- [ ] Red first: the three-item record above, through `honestyAtClose`
- [ ] Green: a declared `[~]` counts as open, an undeclared `[?]` is a finding, with non-vacuity rows
- [ ] This repository's four `[~]` lines in 0249 and 0256 are read, and pass as disposed

Deferred: none
