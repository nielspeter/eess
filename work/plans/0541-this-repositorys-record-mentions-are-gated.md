# Plan 0541: this repository's record mentions are gated

## Status

- **State:** Draft — written 2026-10-21, split from [plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md)'s
  Phase 4 after PR #256's method and enforcement reviews, at the maintainer's instruction to dogfood
  [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask A on this
  repository. The ratchet below is the enforcement review's design (its C1, I1, I2, I6, I7, M1).
- **Implements:** [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)
- **Priority:** Medium — this repository's records name each other as plain text thousands of times
  (4,696 unlinked mentions in 436 files at 659c076f, measured by the method review's instrument with
  the pattern below; the gate's summary prints the live number), and every new record written that
  way adds to it.
- **Effort:** Medium, one PR. One rule and its ratchet in `scripts/check-corpus.mjs`, a ledger file,
  and sabotage rows. No package change.
- **Created:** 2026-10-21
- **Builds after:** [plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md), whose `mentions()` it
  uses. **Builds before:** [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md),
  which empties and deletes the ledger.

## Problem

[Plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md) gives a project the rule; this repository cannot turn it on red, and its two existing
ratchets are unsafe for it. The kernel baseline's identity has no file and a set holds one copy of
each hash, so one baselined `bug 0338` forgives it in every file, any number of times
([bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md), plans
[0532](./0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md) and
[0533](./0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md)); and a metric
ceiling never tightens ([bug 0538](../bugs/0538-a-metric-baseline-never-tightens.md)).

A plain per-file count, the first design, failed review: closing a plan moves its file (38 renames
under `work/` in the month to 2026-10-21), which forced a full regeneration that silently raised any
ceiling in the same commit; and a count lets one mention be swapped for another, in the boards
every PR edits.

## Design

**The rule.** `corpus/record-mention-is-a-link` over `work/`, `adr/` and `docs/`:

```js
const RECORD_MENTION =
  /\b(?<kind>bug|plan|spike)s?\s+(?<n>\d{4})\b|\b(?<kind>proposal)s?\s+(?<n>\d{3})\b|\b(?<kind>ADR)-(?<n>\d{3})\b/gi
const key = (kind, n) => `${kind.toLowerCase()}:${Number(n)}`
mentions(c, { pattern: RECORD_MENTION })
  .that()
  .satisfy(
    not(
      areSelfMentions({
        mention: (m) => key(m.groups.kind, m.groups.n),
        document: recordKeyOfPath,
      }),
    ),
  )
  .should()
  .beLinked()
```

`recordKeyOfPath` reads a lane's numbered file or directory, as `scripts/check-corpus.mjs:533`
already does for proposals; kinds are compared lower-cased, so `ADR-009` in [ADR-009](../../adr/009-agent-first-failure-surfaces.md) is its own.

**The ledger.** `scripts/record-mention-ceilings.json` maps each file to the mention texts it may
still hold unlinked, with how many of each:
`{ "work/bugs/BUGS.md": { "bug 0338": 2, "adr-009": 1 } }` (texts normalised: lower-case, runs of
whitespace as one space).

**Judged against the base ref**, chosen as `check:release` chooses it
(`scripts/check-release.mjs:73-88`: `EESS_RELEASE_BASE`, else the PR's target, else `origin/main`,
else `main`; none resolving is a hard error, never a quiet pass):

1. **Over.** A file holding more of a text than its entry allows is red, naming that text and every
   line it sits on unlinked in the file. A file or a text absent from the ledger allows 0, so every
   new record, and every new kind of mention in an old one, is gated from its first commit.
2. **Under.** A file holding fewer than its entry allows is red, "lower its entry": a paid-down
   mention cannot come back.
3. **Raised.** An entry higher than the same entry at the base ref is red. Renames are carried by
   git's rename detection between the base and the working tree (`git diff --name-status -M`), so
   closing a plan carries its entry to `completed/` and raises nothing. A file new since the base
   starts at 0.
4. **Stale.** An entry for a file that does not exist is red.
5. **The update command can only lower and carry.**
   `node scripts/check-corpus.mjs --update-record-mention-ceilings` rewrites entries to the current
   counts where they fell, moves entries across renames, and drops stale ones; it refuses to raise an
   entry, saying which and why. No message says "regenerate" as the remedy for being over.

**Only "not a link" is counted.** An unread mention ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)),
the vacuity finding ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)) and every
configuration finding are red regardless of the ledger.

**No waiver for this rule here.** `scripts/check-corpus.mjs` reports any
`eess-exclude corpus/record-mention-is-a-link` directive under its roots as a finding: under this
script nothing discloses what a waiver suppressed
([bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md)), so quoted examples go in
fenced blocks, which the rule does not read.

**The summary line** prints mentions examined, unlinked, files and texts in the ledger, and the
ledger total, so a green run says how much is still owed.

## Open before Ready

Judgement 3 has no rule yet for an entry **absent at the base** (PR #256's round-2 method review,
I1), and three things depend on it:

- **The bootstrap.** The PR that builds this plan writes the first ledger, which `main` does not
  have. If "absent at base" means 0, every entry in that PR is "raised" and the plan's own PR is
  red; if it means "not judged", the rule must say when that holds (only while the ledger file is
  itself absent at the base) and why that is not an escape.
- **The probe rows.** A probe file is new since the base, so any non-zero probe entry is "raised",
  and the over, new-text and under rows go red for a second reason. The probe ledger needs its own
  rule under judgement 3, or the rows another way to isolate what they name.
- **The rename row.** An uncommitted probe has no base path, and `git diff --name-status -M <base>`
  does not list untracked files, so "renamed with its entry carried is green" cannot be built as
  written; nor can an unstaged local `mv`, which reads as stale plus new. The row needs a committed
  probe in a scratch worktree, or a different proof of rename carrying.

## Phases

### Phase 1 — the rule and the ledger, judged both ways

The rule, the ledger's reader, judgements 1, 2 and 4, the counted-finding split, the waiver ban,
the summary line, and the first ledger written from the tree at the PR's base.

**Files:** `scripts/check-corpus.mjs`, `scripts/record-mention-ceilings.json` (new).

### Phase 2 — against the base ref

Judgement 3 with rename carrying, and the update command's lower-and-carry rule.

**Files:** `scripts/check-corpus.mjs`.

### Phase 3 — sabotage rows

In the production-script shape (`scripts/check-nonvacuity.mjs:136-143`), each an ephemeral probe
with its own probe ledger entry, so no tracked file is left sabotaged by a killed run ([bug 0231](../bugs/fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)'s
class), and `check:integrity` names a leftover probe ledger:

- a probe record with one plain mention of an existing record and no entry is red; linked, green;
- a probe with an entry, holding one more of that text than allowed, is red;
- a probe whose new mention text is absent from its entry is red, though its total is unchanged;
- a probe entry above its file's count is red, "lower its entry";
- a probe entry raised above its value at the base ref is red;
- a probe file renamed, with its entry carried by the update command, is green; renamed without it,
  red as stale and as new;
- a probe holding a mention in an HTML block is red under a slack entry;
- a probe holding a waiver for this rule id is red.

**Files:** `scripts/check-nonvacuity.mjs`, `scripts/check-workspace-integrity.mjs` (the probe
ledger's name).

## Test inventory

| row                                                                  | phase |
| -------------------------------------------------------------------- | ----- |
| over, by count and by a new text: red, naming the text and its lines | 1, 3  |
| under: red, "lower its entry"                                        | 1, 3  |
| stale entry: red                                                     | 1, 3  |
| raised against the base: red; carried across a rename: green         | 2, 3  |
| the update command refuses to raise, and says so                     | 2     |
| an unread mention is red under a slack entry                         | 1, 3  |
| a waiver for this rule id is red                                     | 1, 3  |
| no base ref resolving is a hard error                                | 2     |

## Release

No package changes; `scripts/` only. `check:release` needs no changeset.

## Out of scope

- **Emptying the ledger**: [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).
- **`.claude/skills/` and `kit/`**: not corpus roots ([bug 0535](../bugs/0535-the-corpus-gate-does-not-read-skill-or-kit-files.md)).
- **What a mention's link points at**: [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask B, held.

## Progress ledger

- [ ] Phase 1 — the rule, the ledger, judgements 1, 2 and 4, the counted split, the waiver ban, the summary
- [ ] Phase 2 — judgement 3 against the base ref, rename carrying, lower-and-carry updates
- [ ] Phase 3 — the sabotage rows and the probe ledger in `check:integrity`
- [ ] `npm run validate` green, with its time reported
