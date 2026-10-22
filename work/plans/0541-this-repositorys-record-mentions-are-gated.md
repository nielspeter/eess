# Plan 0541: this repository's record mentions are gated

## Status

- **State:** Ready — frozen 2026-10-22, after a redesign at the freeze and two review rounds, the
  second the last design round, its findings applied without a third. The freeze measured that git sees half of this repository's closes as a delete and
  an add, so a ledger carried across renames would red them; its method and enforcement reviews then
  found the ledger's bootstrap could be reopened by any later PR. The ledger is gone: each file is
  judged against the merge base's own counts, keyed by record identity (_The freeze_ below). Written
  2026-10-21, split from [plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md)'s Phase 4
  after PR #256's method and enforcement reviews, at the maintainer's instruction to dogfood
  [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask A on this
  repository.
- **Implements:** [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)
- **Priority:** Medium — this repository's records name each other as plain text thousands of times
  (4,696 unlinked mentions in 436 files at 659c076f, measured by the method review's instrument with
  the pattern below; the gate's summary prints the live number), and every new record written that
  way adds to it.
- **Effort:** Medium, one PR. One rule and its base comparison in `scripts/check-corpus.mjs`, a
  base-resolution module with its own tests, and sabotage rows. No package change.
- **Created:** 2026-10-21
- **Builds after:** [plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md), whose `mentions()` it
  uses. **Builds before:** [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md),
  which brings the count to zero.

## Problem

[Plan 0539](./completed/0539-a-mention-of-a-record-is-a-link.md) gives a project the rule; this repository cannot turn it on red, and its two existing
ratchets are unsafe for it. The kernel baseline's identity has no file and a set holds one copy of
each hash, so one baselined `bug 0338` forgives it in every file, any number of times
([bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md), plans
[0532](./0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md) and
[0533](./0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md)); and a metric
ceiling never tightens ([bug 0538](../bugs/0538-a-metric-baseline-never-tightens.md)).

A plain per-file count, the first design, failed review: closing a plan moves its file (38 renames
git detected under `work/` in the month to 2026-10-21, at 659c076f, and 28 more moves it saw as a
delete and an add), which forced a full regeneration that silently raised any ceiling in the same
commit; and a count lets one mention be swapped for another, in the boards every PR edits.

## Design

**The rule.** `corpus/record-mention-is-a-link` over `work/`, `adr/` and `docs/`, frozen documents
included (a done folder is frozen, and leaving it out would turn every close into a paydown):

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

`recordKeyOfPath` is new, in `scripts/lib/`, modelled on `proposalNumberFromPath`
(`scripts/lib/proposal-ruling.mjs:288`). It answers which record a document belongs to: a numbered
file, or a file inside a numbered record directory (`work/spikes/0001-eess-over-ts-archunit/`'s two
files are `spike:1`), so a record naming itself is not a mention. Kinds are compared lower-cased, so
`ADR-009` in [ADR-009](../../adr/009-agent-first-failure-surfaces.md) is its own.

**A file's census key.** Unlinked mentions are counted per file key and mention text (normalised:
lower-case, runs of whitespace as one space). A file whose own name is `<number>-<slug>.md`, in a
lane folder or any folder under it (`work/bugs/`, `work/plans/`, `work/spikes/`, `work/proposals/`)
or in `adr/`, takes `<kind>:<number>`. Every other file takes its path: the boards, `docs/`, and the
files inside a record directory. This differs from `recordKeyOfPath` on purpose: two files in one
record directory are two census keys. A record keeps its key when it moves to a done folder, so no
move is carried and nothing reads git's rename detection.

**Judged against the base, by counting it.** There is no ledger, and the base reads no environment
variable but the test seam below. In particular it reads neither `EESS_RELEASE_BASE` nor
`GITHUB_BASE_REF`: either would let a one-line change name a base that forgives the PR's additions
and still exit 0 (round-2 review, measured on a simulated PR merge ref). The base is:

- **`HEAD` with two parents** (GitHub's PR checkout is a merge commit of the PR into its target):
  its first parent, which is the target's tip and, measured, the merge base.
- **Any other `HEAD`:** its merge base with `origin/main`, else `main`; neither resolving is a hard
  error. When that merge base is `HEAD` itself (a push to `main`, or a local `main`), the base is
  `HEAD` if the working tree differs from it under the three roots, and `HEAD`'s first parent if it
  does not, so a commit pushed straight to `main` is judged; a `HEAD` with no parent is a hard error.

The base's files under the roots are written to a temporary directory through a temporary
`GIT_INDEX_FILE` (`git read-tree <base>`, then `git checkout-index --prefix=<dir>/` over the roots'
paths), not `git archive`, which applies the base's `.gitattributes`: measured, `export-subst`
rewrote `$Format:%s$` into the commit subject, which can be a mention, and `export-ignore` would empty
a root. The rule is run over that directory with `corpus({ cwd })`, given only the roots that exist at
the base and no frozen globs: the rule reads every document whatever is frozen, and the head's corpus
options can throw at a base that predates them (a frozen glob dropped once its folder fills, a root
added since). **Any failure to read or count the base** (a root that cannot be read, a corpus that
throws, a base that examines zero mentions) is one unsuppressable configuration finding naming the
base and the cause, never thousands of "raised" findings with the wrong remedy (ADR-016 rules 1 and 4,
ADR-009 rule 2). Then:

1. **Raised.** A census key holding more of a text than it held at the base is red, naming the text
   and every line it sits on unlinked in the file. A key or a text absent at the base held 0, so a
   new record, a new kind of mention in an old one, and a mention swapped for another are each red
   from their first commit. Closing a plan keeps its key and raises nothing.
2. **A shared key.** Two files in the tree with one census key (`338-x.md` beside `0338-y.md`, or
   two ADRs numbered alike) are red, unsuppressably: they would share one count. At the base, a
   shared key's counts are summed.
3. **An unnumbered file that moves** reads as a new key and is red as raised from 0; its message
   says the file is keyed by its path, and that a numbered record keeps its key. Measured, no file
   under the roots that is not a numbered record has ever moved or been deleted (_The freeze_).

A paid-down mention cannot come back: the next PR's merge base holds the lower count.

**Only "not a link" is counted**, split by rule id, not message text: both of `beLinked()`'s findings
count, "is not a link" and "is in inline code, not a link" (162 of the 5,235 at `75df1b7b`). An unread mention ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)),
the vacuity finding ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)) and every
configuration finding are red regardless of the base, at the head; at the base, "not a link" is counted
and any other failure is the configuration finding above.

**No waiver for this rule here.** `scripts/check-corpus.mjs` reports any
`eess-exclude corpus/record-mention-is-a-link` directive under its roots as a finding, read through the
kernel's own directive parser so the single-line, block and HTML forms all count
(`packages/core/src/exclusion-comments.ts:72,112,120`): under this
script nothing discloses what a waiver suppressed
([bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md)), so quoted examples go in
fenced blocks, which the rule does not read.

**The test seam.** `EESS_RECORD_MENTION_BASE=<tree-ish>` names the base tree directly, in place of
the merge base, as `EESS_CROSSVAL_GHERKIN_ROOT` overrides a corpus for `check:crossval`
(`scripts/check-crossval.mjs:99-106`). A run with it set always adds one unsuppressable finding,
`corpus/record-mention-fixture-base`, naming the tree, so it can never exit 0; setting it in
`package.json` or CI only reds the gate. It is the only variable the base reads.

**The summary line** prints mentions examined, the unlinked count at the head and at the base, the
base it judged against (its commit, and which rule chose it: first parent of a merge, merge base, or
`HEAD`), so a green run says
how much is still owed and against what.

**What this does not catch, by design.** A mention moved from one line to another in the same file,
or from one file to another key that held the same text: counts are per key and text, not per line.
An invisible character inside a mention hides it from the rule
([bug 0543](../bugs/0543-an-invisible-character-hides-a-mention.md)). A record's number reused in the
same PR that deletes the old record inherits its count; `check:numbers` keeps numbers in `work/` from
being claimed twice. A shared key's two files may trade mentions at the base, where their counts are
summed; there are none today (514 files, 514 keys). A direct push of several commits to `main` is
judged on its last commit only, after the fact, as every gate on `main` is. Locally, a merge commit
is judged against its first parent, so only CI judges a branch's earlier commits. Symlinked Markdown
files are read on neither side (`packages/core/src/file-walk.ts:44-48`), and none are tracked.

**Cost, measured at `75df1b7b`.** Writing the base's roots out: about 65 ms. Counting the base: about
4 s, added to every `check:corpus` run (about 10 s today), and so to `check:fast` and to each of the
roughly 23 existing `check-corpus.mjs` runs in `check:nonvacuity`.

## The freeze (2026-10-22)

Three questions were open at Draft (PR #256's round-2 method review, I1): a ledger entry absent at
the base, the probe rows, and the rename row. The first freeze decided them, then measured the
mechanics under them; the measurement broke rename carrying, and its reviews broke the ledger's
bootstrap. This section records both, so the design above is read with its reasons.

### Measured

At `75df1b7b` unless stated, re-run by both reviews:

| question                                                                                                                                                               | result                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| moves into a done folder since 2026-08-01, as `git log -M` reports them                                                                                                | 77 renames and 74 moves seen as a delete and an add: 49% are not renames to git                                                                                                                                                                                                                                                                                                                                                                                                    |
| similarity of those moves                                                                                                                                              | the 39 detected renames since 2026-09-21 score 50% to 94%, 30 of them below 70%; the 74 missed moves score 2% to 49%, and `-M30%` still misses 42 of them (method review)                                                                                                                                                                                                                                                                                                          |
| every move under `work/`, `adr/`, `docs/` since the first commit (2026-07-06)                                                                                          | 168: 166 found by pairing a delete with an add of one file name, and 2 that changed their slug as well (bugs 0255 at `89343659`, 0229 at `f3ce5e45`, method review). Every one a numbered record keeping its number and lane; no unnumbered file under the roots was ever deleted                                                                                                                                                                                                  |
| numbered files tracked, against census keys                                                                                                                            | 514 files, 514 keys, none shared; one record is a directory of two files                                                                                                                                                                                                                                                                                                                                                                                                           |
| `check:numbers`' reach                                                                                                                                                 | `work/` only, one folder deep, keyed by digit width: the 23 ADRs are outside it, and `338-` beside `0338-` passes it (both reviews). Hence judgement 2                                                                                                                                                                                                                                                                                                                             |
| the base counted from `git archive`, against the same commit counted on disk                                                                                           | equal on every key and text, except the three pairs this plan's own edit added to `plan:541` (the control that should move)                                                                                                                                                                                                                                                                                                                                                        |
| GitHub's PR checkout, simulated (`refs/pull/N/merge`)                                                                                                                  | its first parent is the merge base, and stays so after `main` moves; `EESS_RELEASE_BASE=HEAD^2` made the PR's own tip the base and forgave its additions (round-2 review; first-parent fact re-run)                                                                                                                                                                                                                                                                                |
| `git archive` against `read-tree` + `checkout-index`                                                                                                                   | `archive` applied `export-subst` (a `$Format:%s$` became the commit subject) and `export-ignore`; `checkout-index` wrote the same files byte for byte without either, 65 ms against 47 ms (round-2 review; `export-subst` re-run)                                                                                                                                                                                                                                                  |
| a base tree built for a sabotage row (`git hash-object -w`, a temporary `GIT_INDEX_FILE`, `git write-tree`)                                                            | 36 ms; the working tree and every ref unchanged; `git archive` of the tree returns the probe                                                                                                                                                                                                                                                                                                                                                                                       |
| the judgement replayed on this corpus: the last 20 commits on `main` (`8feb4d1b` to `75df1b7b`), each against its first parent, with eess-md's `mentions().beLinked()` | 20 of 20 red, 1 to 85 raised key and text pairs each, 492 in all, while the unlinked count grew from 3,674 to 4,690. A close (`41e11d7a`) raised only the two mentions its new text added, and `09befdbe` lowered the total and still raised one pair, as judgement 1 intends. The two open branches at the freeze are red as well, with 9 and 5 pairs. From the day it lands, the rule asks each PR to link every mention it adds, which none of those 20 did. 77 s for 21 counts |

### What the reviews changed

- **Rename carrying → census keys.** git misses half the closes (_Measured_). Keying by identity
  covers every move this repository has made. Pairing a delete with an add of one file name was
  rejected as a second heuristic covering nothing more; lowering git's threshold was rejected because
  it still misses 42 of the 74.
- **The ledger → the merge base's own counts.** With a ledger, an absent base ledger had to be "not
  judged", and the enforcement review showed that state reachable by any later PR: deleting the
  ledger (plan 0542's end state), renaming it, or pointing the seam at a new file. Counting the base
  has no such state, judges the bootstrap PR's own additions, and drops the under and stale
  judgements and the update command, which existed only to keep a ledger equal to the tree.
- **Key uniqueness is the gate's own** (judgement 2), since `check:numbers` does not reach ADRs or
  digit widths.
- **The merge base, and the first parent on `main`**, so a branch behind `main` is not red for
  mentions `main` removed, and a direct push is judged.
- **The seam reds every run**, so it is not a way to turn the comparison off.
- **The rows run the working script in the main tree** against a built base tree, not a scratch
  worktree's committed copy, which would test the last commit's script (enforcement review).
- **Round 2 (enforcement, the last design round):** the base reads no environment but the seam; it
  is read with `checkout-index`, not `git archive`; its corpus takes no head options; a base that
  cannot be counted is one configuration finding; and one row runs the production base path with no
  seam, since counting `HEAD` in place of the base survived every seam row.

## Phases

### Phase 1 — the rule and the base comparison

The rule, `recordKeyOfPath` and the census key, base resolution, the base count, judgements 1–3,
the counted-finding split, the seam and its finding, the waiver ban, the summary line. Base
resolution and the base count (writing the roots out, counting them, and turning any failure into the
one configuration finding) live in `scripts/lib/record-mention-base.mjs`, with a `node --test` file added to the node
tests `check:corpus` already runs (`package.json:32`), building throwaway git repositories: a `HEAD`
with two parents takes its first; no merge base resolving is a hard error; a merge base equal to
`HEAD` takes `HEAD` when the roots are dirty and its first parent when they are clean; a `HEAD` with
no parent is a hard error; `EESS_RELEASE_BASE` and `GITHUB_BASE_REF` set to another commit change
nothing.

`check:corpus` becomes the second gate that reads a base ref, so the two places that say
`check:release` is the only one change with it: `CLAUDE.md` (the `check:release` bullet) and the
comment on the `check:release` step in `.github/workflows/ci.yml`. CI's `test` job checks out with
`fetch-depth: 0`, so `check:corpus` there has the base.

**Files:** `scripts/check-corpus.mjs`, `scripts/lib/record-mention-base.mjs` (new),
`scripts/lib/record-mention-base.test.mjs` (new), `scripts/lib/record-key.mjs` (new), `package.json`
(`check:corpus`), `CLAUDE.md`, `.github/workflows/ci.yml` (comment only).

### Phase 2 — sabotage rows

In the production-script shape (`scripts/check-nonvacuity.mjs:136-143`): the working
`scripts/check-corpus.mjs`, run in the main tree with an ephemeral probe under `work/bugs/`. The seam
rows set `EESS_RECORD_MENTION_BASE` to a tree built from the **working tree's** roots (a temporary
`GIT_INDEX_FILE`: `read-tree HEAD`, the roots' working files added, the probe excluded), with the
row's base-side probe added, so a dirty local tree does not red an exact-set row. No tracked file is
touched ([bug 0231](../bugs/fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)'s
class), the built tree is an unreferenced object, and `check:integrity` names a leftover probe. Each
row asserts the exact set of findings by rule id and text, the seam's finding included, through
`firedOn` (`scripts/check-nonvacuity.mjs:531`), so the rule-id audit sees each id proven:

- a new numbered probe with one plain mention, absent from the base: raised from 0; linked: only
  the seam's finding;
- a probe holding one `bug 0338` at the base and two at the head: raised, naming the text and both
  lines;
- a probe holding `bug 0338` at the base and `bug 0339` in its place at the head: raised, though the
  total is unchanged;
- a probe holding at least one plain mention, at `work/bugs/` in the base and moved to
  `work/bugs/fixed/` at the head, its text unchanged: only the seam's finding, and the summary's base
  and head counts equal. The equality proves the base was read, and that a done folder (frozen) is
  counted on both sides;
- a probe that is not a numbered record, moved: raised from 0, with the path-key message;
- two probes sharing a key (`0999-a.md` and `999-b.md` under `work/bugs/`), one of them free of
  mentions, both present identically at the base: only the shared-key finding, so it is the tree
  that is judged, not a count;
- a probe holding a mention in an HTML block, identical at the base: unread, red;
- a probe holding a waiver for this rule id, one row each for the single-line, block and HTML
  directive forms: red;
- the seam set and no probe: exactly the seam's finding, exit 1;
- **the production base path, no seam.** `git clone --shared --no-checkout` of the repository into a
  temporary directory (measured: 131 ms, no ref or worktree added to the main repository), its
  `origin` removed, `main` set at `HEAD`, and a commit adding a probe with one plain mention. The main
  tree's working `scripts/check-corpus.mjs` is run with the clone as its working directory (measured:
  it runs, 9.8 s). It must report raised, no seam finding, and a summary naming `main`'s commit as
  the merge base. Then `main` is moved to the probe commit, so the merge base is `HEAD` and the
  roots are clean: still raised, judged against the first parent. Counting `HEAD` in place of the
  base survives every seam row and reds this one.

**Files:** `scripts/check-nonvacuity.mjs`, `scripts/check-workspace-integrity.mjs` (the probes'
names).

**Cost:** each row runs the production script both ways, about 28 s; with the clone row and the 4 s
the base count adds to each existing `check-corpus.mjs` run in `check:nonvacuity`, about 4–6 minutes
of shard time over the four shards, inside their 20-minute timeout (round-2 review's estimate).

## Test inventory

| row                                                                                                              | phase | where                                      |
| ---------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------ |
| raised, by count and by a swapped text: red, naming the text and its lines                                       | 2     | `check:nonvacuity`                         |
| a key absent at the base starts at 0                                                                             | 2     | `check:nonvacuity`                         |
| a record moved to its done folder: green, with the base read                                                     | 2     | `check:nonvacuity`                         |
| an unnumbered file moved: raised from 0, path-key message                                                        | 2     | `check:nonvacuity`                         |
| a shared census key: red                                                                                         | 2     | `check:nonvacuity`                         |
| an unread mention is red whatever the base holds                                                                 | 2     | `check:nonvacuity`                         |
| a waiver for this rule id is red                                                                                 | 2     | `check:nonvacuity`                         |
| the seam always reds                                                                                             | 2     | `check:nonvacuity`                         |
| the production base path, merge base and first parent, no seam                                                   | 2     | `check:nonvacuity`                         |
| base resolution: two parents, no base, merge base = `HEAD` dirty and clean, no parent, release variables ignored | 1     | `scripts/lib/record-mention-base.test.mjs` |
| a base that cannot be counted: one configuration finding                                                         | 1     | `scripts/lib/record-mention-base.test.mjs` |

## Release

No package changes; `scripts/` only. `check:release` needs no changeset.

## Out of scope

- **Bringing the count to zero**: [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).
- **`.claude/skills/` and `kit/`**: not corpus roots ([bug 0535](../bugs/0535-the-corpus-gate-does-not-read-skill-or-kit-files.md)).
- **What a mention's link points at**: [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask B, held.
- **`check:numbers` reaching `adr/` and digit widths**: judgement 2 covers this rule's need, and
  the allocator numbers only `work/` by design.

## Progress ledger

- [ ] Phase 1 — the rule, census keys, base resolution and its tests, the base count, judgements 1–3, the seam, the waiver ban, the summary, the two base-ref docs
- [ ] Phase 2 — the seam rows, the production-base-path row, and the probes' names in `check:integrity`
- [ ] `npm run validate` green, with its time reported
