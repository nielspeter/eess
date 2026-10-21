# Bug 0535: the corpus gate does not read skill or kit files

## Status

- **State:** Draft — measured 2026-10-21; no red test yet.
- **Severity:** Medium — **a broken link in an agent's instructions is green.** The skills under
  `.claude/skills/` and the portable kit under `kit/` are what an agent reads before it writes a
  record, and `check:corpus` reads neither, so a link there that points at a moved record stays
  broken without a word.
- **Origin:** self-found, 2026-10-21, while adding the "a record is named by a link" guard to the
  record-authoring skills ([proposal 018](../proposals/018-md-a-mention-of-a-record-is-a-link.md)
  is the gate for the corpus itself).
- **Reported:** 2026-10-21

## Symptom

`scripts/check-corpus.mjs:98` sets `ROOTS = ['work/**', 'adr/**', 'docs/**']`. Neither
`.claude/` nor `kit/` is a root, so no rule in the gate sees their links.

Measured with a scan of every relative link in `.claude/**/*.md`, `kit/**/*.md` and
`skills/**/*.md` against the filesystem: 49 relative links, 27 that resolve to nothing. Most of the
27 are not defects: examples inside code spans, the kit's template rows pointing at records an
adopter will create, and lanes (`work/refinement/`, `work/support/`) that the kit ships for an
adopter and this repository does not have. Two are real breaks:

| file                                          | link                                                  | where the record is now |
| --------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| `.claude/skills/review-proposal/SKILL.md:239` | `../../../work/bugs/0141-no-check-binds-…`            | `work/bugs/fixed/`      |
| `.claude/skills/review-proposal/SKILL.md:265` | `../../../work/plans/0142-bind-proposals-to-plans.md` | `work/plans/completed/` |

Both records moved to their done-folder in the PR that closed them; `/close` step 6 repairs the
inbound links the corpus gate can see, and these it cannot.

## Root cause

The root list was widened from three lane globs to whole directories by
[bug 0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) so that a new directory is
covered by default, but only inside `work/`, `adr/` and `docs/`. The skills and the kit are
Markdown the repository ships and agents read, and were never in the list.

## Fix

Undecided. The kit is a different kind of corpus: its templates point at records an adopter will
create, so its links cannot be held to this repository's files the way `.claude/skills/` can. The
likely shape is `.claude/**` as a repo-native root, and `kit/` read with its template rows declared
rather than skipped; which profile `kit/` takes is the decision.

## Verification

- [ ] A red test: a skill file linking a moved record fails `check:corpus`.
- [ ] The two broken links above repaired in the same PR.
- [ ] `kit/`'s placeholder links classified, not silently skipped.
