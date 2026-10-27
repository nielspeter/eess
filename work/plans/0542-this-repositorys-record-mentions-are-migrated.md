# Plan 0542: this repository's record mentions are migrated

## Status

- **State:** Ready — Phases 1 and 2 built 2026-10-27; lane 3 next. Frozen 2026-10-27 on the dogfood measurements below, the maintainer's three
  decisions of that day as narrowed by the freeze's review, and no open question. Written
  2026-10-21 so that [plan 0541](./completed/0541-this-repositorys-record-mentions-are-gated.md)'s ledger had a named home for bringing its count to zero.
- **Priority:** High — the release that lets adopters fix their mentions waits on it: eess's own
  corpus, migrated with the fix it ships, is the proof (the maintainer, 2026-10-27).
- **Effort:** Large: nine phases, each its own PR, sized from the counts below to about an hour's
  review (an estimate, not a measurement).
- **Created:** 2026-10-21
- **Builds after:** [plan 0541](./completed/0541-this-repositorys-record-mentions-are-gated.md), [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md) and [plan 0550](./completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md), all built.

## Problem

[Plan 0541](./completed/0541-this-repositorys-record-mentions-are-gated.md) holds this repository's unlinked mentions at the base's count and lets it only
fall. This plan brings it to zero with the fix [plan 0550](./completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md) ships, run the way an adopter
runs it, and then switches the gate to hold zero and to check that a link names its record
([plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md)).

## Decisions — the maintainer, 2026-10-27, as the freeze's review narrowed them

1. **eess alone.** The fix and the target check declare this repository's records only.
   ts-archunit's are not a source and are never linked to: the 11 links to its GitHub URLs outside
   the fold records are reworded in their lanes. **A record** is a numbered file in a lane folder
   (`adr/` directly, `work/{bugs,plans,spikes,proposals}/` at any depth below), or a numbered folder
   there, read through its `README.md`; a numbered file inside a numbered folder is not one. 525
   records at the freeze.
2. **A ts-archunit record is written so the pattern skips it.** The record-mention pattern skips a
   number written right after `ts-archunit` or `ts-archunit's`, by the lookbehind
   `(?<!ts-archunit(?:'s)?\s+)`, as in:

   ```text
   ts-archunit bug 0011 had the same root cause.
   ```

   The maintainer chose `ts-archunit` and `upstream`; the review found `upstream` a spelling any
   author can reach for (a probe hid an eess bug mention written after "the upstream" from the gate), while
   hiding no eess mention today. It is dropped: the 15 mentions written after it are reworded to
   the `ts-archunit` form in their lanes (16 at the first freeze, a miscount: corrected under
   Review). The fix's `foreign` keeps `upstream`, as the measurement did: it only refuses a fix, so
   it hides nothing from the gate, and without it `--apply` would link 3 of those 15 (the rest are refused
   for other causes) before they are reworded. The pattern is the caller's
   ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)).

3. **The seven done fold-era records are left out by name.**
   [Plan 0071](./completed/0071-ts-archunit-parity.md),
   [plan 0088](./completed/0088-fold-ts-archunit-into-eess.md),
   [plan 0147](./completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md),
   [plan 0165](./completed/0165-integrate-the-copied-ts-archunit-engine.md),
   `work/fold-audit-2026-08-19.md`, [spike 0001](../spikes/0001-eess-over-ts-archunit/README.md)
   (its whole folder, `CONCLUSION.md` included, which uses the spike branch's own numbering) and
   [bug 0198](../bugs/fixed/0198-no-migration-path-from-ts-archunit.md) describe ts-archunit in its
   own numbering, and none of them will be edited again. The maintainer named ten; the review found
   three of them live, [plan 0090](./0090-adopt-ts-archunit-work-corpus.md),
   [plan 0100](./0100-publish-the-fold-retire-ts-archunit.md) and
   [bug 0303](../bugs/0303-ts-archunit-adr-numbers-persist-in-eess-comments.md), where an exemption
   would leave new mentions unchecked for good. They go through their lanes instead (23 findings, no
   fix: each reworded or linked by hand). The seven are a named list with its reason in
   `check:corpus`, never a glob: each entry is an exact file path, so
   [spike 0001](../spikes/0001-eess-over-ts-archunit/README.md)'s two files are two entries and
   seven records are eight entries. Each is pinned by its text's hash, so a file that is missing or
   has changed is a finding: the exemption cannot outlive its premise (corrected at Phase 1's
   review from a folder entry, under which any new file was exempt). A test pins the entries.

## Measured — 2026-10-27, at 4a43bcc4, throwaway scripts

The fix over every document but the seven, eess's records only, Decision 2's pattern, `foreign`
matching `ts-archunit` or `upstream`: **3,899 fixes** in 418 files and **519 refusals**. Phase 0's anachronism instrument re-run over the
3,899 (40.4 s, 1,559 git calls): **145** mentions first written before their record existed, on
140 distinct lines, listed in the Appendix; 34 other fixable mentions share those lines. Of the
fixes, **761** link one of the first ten ADRs, whose numbers are ts-archunit's too; **159** of them
sit in a file that names ts-archunit. Wider: **294** fixes sit in a file that names ts-archunit and
link a record whose number ts-archunit also used (its numbering runs to 10 ADRs, 106 plans, 80
bugs, 28 proposals and 69 spikes): 159 ADRs, 81 proposals, 53 plans and 1 bug.

| phase | lane                                                       | fixes | files | anachronisms | refusals |
| ----- | ---------------------------------------------------------- | ----- | ----- | ------------ | -------- |
| 2     | `adr/`, `docs/`, `work/` root files, `work/bugs/rejected/` | 326   | 41    | 16           | 47       |
| 3     | `work/spikes/`, `work/proposals/`                          | 792   | 40    | 38           | 111      |
| 4     | `work/bugs/` (live)                                        | 718   | 154   | 13           | 89       |
| 5     | `work/bugs/fixed/`                                         | 521   | 110   | 9            | 92       |
| 6     | `work/plans/` (live)                                       | 480   | 21    | 13           | 66       |
| 7     | `work/plans/completed/` 0001–0449                          | 475   | 33    | 35           | 78       |
| 8     | `work/plans/completed/` 0450 and above                     | 587   | 19    | 21           | 36       |

Refusals by reason: 114 another project named around the mention (reworded into Decision 2's form
where it names ts-archunit, linked by hand where it names eess); 143 in inline code (a quotation
fenced or reworded, a live reference unwrapped and linked); 96 naming no eess record, 92 of them
ts-archunit numbers (reworded into Decision 2's form) and 4 not (a plan number claimed on a
branch, in [bug 0302](../bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md); a
plan number never filed, twice in
[bug 0141](../bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md); a bug number never
filed, in [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md): each read and
reworded or fenced; the rule takes no waiver); 85 touching `*`, `_` or `~` and 81 not written as matched (linked by hand). Each lane's own
dry run gives its exact list.

## Phases

### Phase 1 — the gate's narrowing, proven, and the rule file

- `scripts/lib/record-mention.mjs`, new: Decision 2's pattern, Decision 1's record set and
  Decision 3's list, one owner. `check:corpus` reads them from it, still judged against the base's
  counts.
- `mention-fix.rules.ts` at the repository root reads the same module: `beLinked({ fix })` over the
  records, `foreign` matching `ts-archunit` or `upstream` (Decision 2), the seven left out, a
  `LANE` constant of globs, one rule per glob (`.that().resideInFile(glob)`), so a glob that
  matches nothing is named as a dead glob rather than hidden by the others; empty in this phase, so the rule file declares
  no rule and is not run.
  An `.excluding()` list holds the current lane's anachronisms only. No mention changes.
- `scripts/lib/mention-anachronisms.mjs`, new: Phase 0's anachronism instrument (40 s over all
  lanes), committed so each lane re-runs it at its own base; it prints the lane's anachronisms as
  `.excluding()` entries, and hard-errors on a shallow clone, as `check:corpus` does.
- `check:corpus` prints how many mentions the lookbehind skipped, from this phase on.
- **Break classes, each a `check:nonvacuity` row:** a mention written after `ts-archunit` is not
  counted while the same text without it is, probed for each alternative of the pattern (`bug`,
  `plan`, `spike`, `proposal`, `ADR-`) and for the `ts-archunit's` form; a mention in a listed file
  is not counted while the same text in an unlisted one is; a list entry naming no file is red. The
  lookbehind's text and the list's seven paths (deep-equal, not a count) are pinned by
  `scripts/lib/record-mention.test.mjs`, so a widened word list or a swapped entry is red; the test
  joins `check:corpus`'s `node --test` list in `package.json`, where a script test must be named to
  run.

**Files:** `scripts/lib/record-mention.mjs` (new), `scripts/lib/record-mention.test.mjs` (new),
`scripts/lib/mention-anachronisms.mjs` (new), `scripts/check-corpus.mjs`,
`scripts/check-nonvacuity.mjs`, `package.json`, `mention-fix.rules.ts` (new).

**Built (2026-10-27).** As planned, with these differences, measured at c6e7b8f9:

- The anachronism instrument reproduces the freeze exactly over every lane, 3,899 fixes and 145
  anachronisms, each Appendix row and no other, in 67.5 s, not 40 s.
- One rule per glob needs the exclusions split by glob: lane 2's dry run gave 48 "Unused exclusion"
  lines, each rule holding the other globs' entries. `anachronismsByGlob` gives each rule only its
  own, matched as `resideInFile` matches, and an entry under no glob throws, since it would
  otherwise be dropped without that line. Lane 2's dry run then gave its 326 fixes less its 16
  anachronisms, 310, and no unused line. A mistyped glob reds as its own rule's dead selector, a moved
  line prints one "Unused exclusion".
- The gate's summary prints 38 mentions skipped after ts-archunit and "8 of 8 left-out files as
  pinned"; its run time is unchanged (7.8 s).
- **Changed at review (enforcement and testing lenses).** The left-out list was a dead-entry check
  over seven paths, one a folder; it gave up a ratchet main has (a mention added to a left-out file
  was red at the base, green after) on a premise nothing enforced, and its folder exempted any new
  file. It is now eight exact files, each pinned by hash (CRLF read as LF), so an edit or a deletion
  is `corpus/record-mention-left-out`. The instrument exited 0 with an empty list on a dead glob or
  an unreadable fix; each now stops with exit 1 and nothing on stdout, an undated fix is named, and a
  record renamed from another number is undated. Overlapping lane globs throw. The pin covers both
  patterns' full sources. Two rows, appended at the end of the list so no other fixture changes
  shard: `ts-archunit-skipped` (each alternative, both forms, and the skipped count up by exactly the
  ten written) and `left-out`, in a shared clone (a mention appended to a listed file is not counted
  and reds the pin, the same text beside it and inside [spike 0001](../spikes/0001-eess-over-ts-archunit/README.md)'s folder is counted, a deleted entry
  is red). A unit test over `corpusFromText` covers each entry's matching and the fix.
- **Each guard shown red** by a sabotage of what it guards, in `record-mention.mjs` alone: the
  lookbehind dropped from the `ADR-` alternative; the skipped count wired to nothing; six file
  entries matching nothing; the changed check and the missing check each removed; the match widened
  to each entry's folder. Two first-draft breaks were no break (picomatch reads `./a.md` and
  `a.md/**` as matching `a.md`) and were replaced. The first draft's skipped-count check returned a
  string, which the row helper reads as a pass; it returns a boolean.
- **Changed at the re-check.** The pin hashed the raw text, so `/close`'s link repair (seven live
  records are linked from three left-out files) would unpin a file, and the remedy offered "update
  the hash", which re-approves whatever else the edit added. The hash now blanks link destinations,
  so a repair leaves the pin alone and any prose edit does not; the remedy no longer offers a re-pin;
  and the eight files are in `.prettierignore`, so a formatter cannot rewrite them. The clone row
  rewrites a destination first and expects no finding (the old raw hash reds there), and its
  skipped count must not move when a `ts-archunit` mention lands in a left-out file (a count that
  reads the left-out files reds there). A folder record's number is read from its folder.
- **Known, not pinned.** The instrument's stops (dead glob, a finding that is not a mention's, an
  unreadable or undated fix, a record renamed from another number, a shallow clone) were each shown
  by hand, and no test holds them; its globs are typed by hand, so a set narrower than `LANE` is
  caught only by step 1's comparison with the Appendix. Both are lane tools, deleted in Phase 9.
  The two rows run `check:corpus` seven times between them, about a minute on CI, appended so no
  other fixture changes shard.

### Phases 2 to 8 — the lanes

Each lane is its own PR, in this order:

1. `LANE` set to the lane's globs; the anachronism instrument re-run at the lane's base and its
   output written as the rule file's `.excluding()` list, the rows that differ from the Appendix's
   for this lane named in the PR; the dry run, `eess-ts check mention-fix.rules.ts --fix`, read
   grouped by target file name (`docs/markdown.md`'s pipeline), its largest groups first. **Any
   "Unused exclusion" line stops the lane** before step 3: the list was written from a re-run at this
   lane's base, so an entry the rule does not match means the instrument and the rule disagree
   about a line. **So does an Appendix row for this lane that the re-run misses**, until
   that row is shown linked, reworded, or found by the re-run on its new line: an empty or short
   re-run would otherwise apply every anachronism unread. A fix count far from the table's row is
   explained before going on;
2. **a judge reads every fix in the lane that sits in a file naming ts-archunit and links a record
   whose number ts-archunit also used** (294 over all lanes), and a seeded sample of 20 of the
   lane's other fixes, the seed recorded in the PR; the judge is an agent on a different model from
   the one running the lane. A wrong fix is left out by element before applying, its cause recorded
   in this plan, and the judge then reads every fix in the lane with the same target;
3. `--fix --apply`, before any hand edit, so no excluded line has moved;
4. the lane's refusals, anachronisms and the other mentions on their lines closed by hand, as the
   Measured section says; the exclusions it closed removed from the rule file;
5. **closed when the lane's documents hold no unlinked mention**: the rule file holds no exclusion
   in `LANE`, and the dry run over `LANE` reports no finding (with one rule per glob, a glob that
   matches nothing is a dead-glob finding, not clean).

**Files:** the lane's documents, `mention-fix.rules.ts`.

**Lane 2 (Phase 2), built 2026-10-27**, at base 96b0461e:

- The instrument found 16 anachronisms in 326 fixes, the Appendix's 16 exactly. The dry run gave
  310 fixes and 46 refusals; the plan's 47th refusal, ts-archunit plan 0057 on `docs/calls.md:150`, sat on an
  excluded line, which hides every mention on it.
- The judge (Fable; seed 20261027) read the 30 fixes in the ts-archunit range and 20 sampled: 49
  right, 1 wrong. `adr/002-ts-morph-ast-engine.md:221` names ts-archunit plan 0075, its element-cache plan,
  not eess's; it was left out by element, and no other fix in the lane targets
  [plan 0075](./0075-manifesto-reconciliation.md).
  [Bug 0356](../bugs/0356-project-memoizes-for-process-lifetime-so-a-module-scope-export-builds-every-project.md)'s
  mention of the same number is likely ts-archunit's too, for lane 4 to read.
- `--apply` wrote 307 links; one more, an anachronism read as right, was applied after.
- Of the 16 anachronisms, 15 name the record they would link to: each was written in the PR that
  claimed the number, before the record's file landed. They were linked by hand. One,
  `docs/calls.md:150`, is ts-archunit's numbering and was reworded. The instrument errs toward
  flagging, as designed, so most of what it flags is right.
- By hand, 55 edits in 17 files: 10 mentions reworded to the ts-archunit form (the skipped count
  went from 39 to 49), the rest linked; `docs/markdown.md`'s example forms moved into a fenced
  block, as that page itself advises; two incidental examples reworded.
- Two ADR Enforcement rows cite a test title holding a record number, which can be neither linked
  nor fenced. The maintainer chose (2026-10-27) to rename the titles: `an undocumented exclusion
fails the build` and `accepts a repository that extends the base through an intermediate class`
  drop their numbers, each kept in a comment beside its test (`'@nielspeter/eess-ts': none`).
  Lane 5 holds one more such citation, in
  [bug 0325](../bugs/fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md), treated the same way.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 4,046 unlinked mentions, against 4,418 at the base.

### Phase 9 — the gate holds zero, and checks the target

- **A skipped number past ts-archunit's range is red.** ts-archunit's numbering runs to 10 ADRs,
  106 plans, 80 bugs, 28 proposals and 69 spikes, so `ts-archunit bug 0400` cannot be its record:
  the lookbehind's escape is closed for every later number, with no false positive by construction
  (Phase 1's enforcement review).
- **Zero outright.** `corpus/record-mention-is-a-link` is judged as the other rules are: any
  unlinked mention outside the seven is red, whatever the base holds. The base machinery goes:
  `scripts/lib/record-mention-base.mjs`, the `EESS_RECORD_MENTION_BASE` seam and its findings, the
  shallow-clone hard error, and the seam's own `check:nonvacuity` rows (the fixture base, the
  unreadable base, the shallow clone). Phase 1's rows stay, rewritten for the zero judgement.
  The new rows: a mention the base already holds is still red (the switch itself, which a new
  probe cannot show), built on the existing shared-clone row with the mention committed to the
  clone, and the same in a done folder, which the rule reads too.
- **What it says.** The remedy no longer reads "each mention this change added", and it is chosen
  by cause, since the rule holds the record set. A number naming no eess record: write it in
  Decision 2's form (straight apostrophe) if it is ts-archunit's, else correct it. A number naming
  an eess record beyond ts-archunit's range: link it, with no word of the ts-archunit form. A number
  inside that range: either, saying that the ts-archunit form takes the mention out of every
  check. Each branch has a row showing its remedy, written in, clears the finding. The summary counts the
  mentions examined, the mentions the lookbehind skipped, the records left out (7, eight documents) and the links
  the join judged.
- **The target.** [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md)'s join over Decision 1's records with `areInTitleLinks`,
  paired with `beLinked()`, `.expectNonEmpty()` written, reading the same left-out list as the
  mention rule. Re-run first: its census (one true red, the `ROADMAP.md` row for
  [plan 0454](./completed/0454-box-marks-are-the-callers.md), over 1,409 judged links) was taken
  with ts-archunit as a source, before Decision 1. A red beyond that row is recorded as a bug, not
  fixed here. Its rows: a crossed link red, a title link green, an empty mention side red. What it
  cannot see: a link to a record whose number ts-archunit also used that the lanes' judge did not
  read, and a linked mention written after `ts-archunit`, which the pattern skips.
- `mention-fix.rules.ts`, `scripts/lib/mention-anachronisms.mjs` and
  `scripts/lib/record-mention.mjs`'s lane exports removed; `CLAUDE.md`'s `check:corpus` entry says
  the rule holds zero.

**Files:** `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs`, `scripts/lib/`,
`package.json` (`record-mention-base.test.mjs` leaves the `node --test` list),
`work/plans/ROADMAP.md`, `CLAUDE.md`, `mention-fix.rules.ts` (deleted).

## Out of scope

- Code references that point at the wrong line: [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md).
- Links to ts-archunit, by Decision 1.

## Superseded at the freeze, kept as history

The Draft's numbers and Appendix came from [plan 0550](./completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s Phase 0, which declared ts-archunit
as a second source and left 1,601 mentions as collisions (4,704 plain mentions at c9e55336: 3,098
with one record, 1,601 in both sources, 5 in none). Decision 1 turns those collisions into fixes, so
the anachronisms were re-counted over the new set (128 then, 145 now), and the refusal lists are
each lane's dry run's; the old lists are not carried.

## Review — 2026-10-27

The first freeze (4a43bcc4) was reviewed by the method and enforcement lenses, both Changes needed.
Kept, not edited away:

- **Method C1:** nothing scoped a lane, so the first `--apply` would have written all 3,899 links.
  The rule file's `LANE` globs.
- **Enforcement C1:** Phase 1 narrowed the gate twice with no break class; the head and the base
  are counted the same way, so any narrowing stayed green. Phase 1's rows.
- **Enforcement C2:** "holds zero outright" changed a judgement, named no row, and left the base
  machinery's fate open. Phase 9's first item.
- **Enforcement I1, I3:** `upstream` dropped and the three live fold records moved into lanes
  (Decisions 2 and 3).
- **Enforcement I5:** a link to a wrong ADR among the first ten is green under every gate; a
  sample of 20 in 1,062 finds a 1% error class about 18% of the time. The judge reads all 159 in
  files naming ts-archunit.
- **Method I1–I3, enforcement I2, I4 and the Minors:** the refusals counted without the fold records
  (481, then 519 once the three live ones and `upstream`'s 16 came in), refusals by lane, the
  record set defined, the four no-record mentions that are not ts-archunit's named, the 140
  distinct lines and the 34 mentions sharing them, a lane closed by its own dry run, exclusions
  removed as lanes close, `--apply` before any hand edit (the review's measurements found one
  anachronism's line moved by six between two commits), the completed plans split in two, the
  join's census taken before Decision 1, the sample's seed recorded, the measurements re-taken at
  one commit.

The revision (46ec9671) was re-checked by both lenses, both Ready with fixes. Kept:

- **Method C1:** Phase 1 set `foreign` to `ts-archunit` alone while the numbers were measured with
  `upstream` too; re-run that way, 17 refusals become fixes, among them adr/009's mention of two
  ts-archunit plans by number, which `--apply` would link to the eess plan with the first number. `foreign` keeps `upstream`.
- **Enforcement N1:** the judge read ADR fixes only, but ts-archunit's plan, bug and proposal
  numbers collide too. The read set is every fix in a file naming ts-archunit whose target number
  ts-archunit used: 294, measured at 4a43bcc4. [Spike 0001](../spikes/0001-eess-over-ts-archunit/README.md)'s `CONCLUSION.md` was already left out
  with its folder; Decision 3 now says so.
- **Method I2, enforcement N3:** exclusions keyed by line at 4a43bcc4 go stale as the board files
  change, and with every lane's entries in the list the "Unused exclusion" warning is noise. Each
  lane re-runs the instrument at its base, the list holds that lane's entries only, and an unused
  one stops the lane.
- **Enforcement N2:** Phase 9 would have deleted Phase 1's rows with the seam. They stay; the list
  is pinned by a test.
- **Enforcement N4, N5, N6; method I1, I3 and the Minors:** the remedy and summary after the base;
  a lane closed with its exclusions gone and `.expectNonEmpty()`; "waived" replaced, since the rule
  takes no waiver; the board row; `upstream`'s 16 corrected to 15 (481 + 23 + 15 = 519); lanes 7
  and 8 counted apart; a census red beyond the known one recorded as a bug; each pattern
  alternative probed; a wrong fix in the sample widens the read to its target.

The fixes were re-checked (cd6cf531). Enforcement, Ready with fixes, kept:

- **P1:** with the exclusion list taken from a re-run, an empty re-run stopped nothing. A missed
  Appendix row now stops the lane, and the instrument refuses a shallow clone.
- **P2:** the pinning test was named nowhere that runs it. It joins `check:corpus`'s list and
  compares the seven paths, not their count.
- **P3, P4 and the Minors:** `.expectNonEmpty()` could not see one dead glob among several, so the
  lane is one rule per glob; Phase 9's remedy is chosen by cause, so the ts-archunit form is not
  offered as a way out for an eess mention; the switch row's base, the skipped count from Phase 1,
  and the folder entry's exception stated.

Method, Ready with fixes, kept: [spike 0001](../spikes/0001-eess-over-ts-archunit/README.md)'s folder makes the seven records eight documents, which
the list, its test and the summary now say; 3 of the 15 `upstream` mentions, not all of them, are
what `foreign` keeps from `--apply`; the first freeze's 16 counted one in the fold audit, a left-out
document. Every new number was reproduced at 4a43bcc4.

## Progress ledger

- [x] Ready (2026-10-27)
- [x] Phase 1 — the gate's narrowing, proven, and the rule file
- [x] Phase 2 — `adr/`, `docs/`, `work/` root, `work/bugs/rejected/`
- [ ] Phase 3 — `work/spikes/`, `work/proposals/`
- [ ] Phase 4 — `work/bugs/` (live)
- [ ] Phase 5 — `work/bugs/fixed/`
- [ ] Phase 6 — `work/plans/` (live)
- [ ] Phase 7 — `work/plans/completed/` 0001–0449
- [ ] Phase 8 — `work/plans/completed/` 0450 and above
- [ ] Phase 9 — the gate holds zero and checks the target

## Appendix — the 145 anachronisms, at 4a43bcc4

Each a mention first written before the record it would link to existed, with both dates. The
reference each lane's own re-run is compared with: the lane's `.excluding()` list comes from that
re-run at the lane's base, since a line here moves as its file changes. Fenced, so no gate reads it.

```tsv
location	mention	target	mention first	record first
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:40	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:68	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:79	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:92	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/023-a-predicate-and-a-condition-that-share-a-word.md:6	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
docs/calls.md:150	proposal 011	work/proposals/011-core-name-the-evidence-gate.md	2026-07-06	2026-09-07
docs/calls.md:158	bug 0324	work/bugs/fixed/0324-the-callback-conditions-read-a-direct-callback-only.md	2026-09-19	2026-09-20
docs/manifesto.md:459	plan 0073	work/plans/0073-violation-telemetry-rule-staleness.md	2026-07-19	2026-07-19
docs/markdown.md:1463	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
docs/migrating-to-eess-ts-0.6.md:170	bug 0295	work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md	2026-09-19	2026-10-04
docs/migrating-to-eess-ts-0.6.md:171	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-19	2026-09-20
docs/migrating-to-eess-ts-0.6.md:172	bug 0314	work/bugs/fixed/0314-the-function-rules-read-no-parameter-default.md	2026-09-19	2026-09-19
docs/migrating-to-eess-ts-0.6.md:177	bug 0324	work/bugs/fixed/0324-the-callback-conditions-read-a-direct-callback-only.md	2026-09-19	2026-09-20
docs/migrating-to-eess-ts-0.6.md:95	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-19	2026-09-20
docs/standard-rules.md:117	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-14	2026-09-20
docs/standard-rules.md:42	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-14	2026-09-20
work/bugs/0244-the-board-status-cell-is-bound-to-nothing.md:226	bugs 0295	work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md	2026-09-14	2026-10-04
work/bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md:20	bugs 0282	work/bugs/rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md	2026-09-14	2026-09-14
work/bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md:21	bugs 0289	work/bugs/0289-a-fence-its-container-closes-hides-the-next-line.md	2026-09-14	2026-09-14
work/bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md:22	bug 0282	work/bugs/rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md	2026-09-14	2026-09-14
work/bugs/0407-a-wrapped-code-span-reads-as-links-to-the-link-test.md:8	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/bugs/BUGS.md:336	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/BUGS.md:336	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/BUGS.md:343	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/BUGS.md:349	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/BUGS.md:410	bug 0507	work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md	2026-10-19	2026-10-19
work/bugs/BUGS.md:437	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/BUGS.md:456	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/BUGS.md:469	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md:239	plan 0089	work/plans/completed/0089-family-standalone-sufficiency.md	2026-08-14	2026-08-18
work/bugs/fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md:102	bug 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md	2026-08-19	2026-08-21
work/bugs/fixed/0240-check-guardrails-prints-a-rule-count-it-does-not-derive.md:60	Bug 0239	work/bugs/fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md	2026-09-03	2026-09-03
work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:85	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:92	bug 0476	work/bugs/fixed/0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md	2026-10-18	2026-10-18
work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:94	bug 0476	work/bugs/fixed/0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md	2026-10-18	2026-10-18
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:48	bug 0475	work/bugs/fixed/0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md	2026-10-18	2026-10-18
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:58	bug 0475	work/bugs/fixed/0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md	2026-10-18	2026-10-18
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:60	bug 0475	work/bugs/fixed/0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md	2026-10-18	2026-10-18
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:10	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:352	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:353	Bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:418	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:572	ADR-016	adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md	2026-09-28	2026-10-01
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:667	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:791	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/ROADMAP.md:58	ADR-009	adr/009-agent-first-failure-surfaces.md	2026-08-12	2026-08-16
work/plans/ROADMAP.md:70	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
work/plans/ROADMAP.md:70	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/ROADMAP.md:88	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/ROADMAP.md:89	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/ROADMAP.md:90	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0070-caller-owns-reporting.md:140	ADR-008	adr/008-caller-owns-reporting.md	2026-07-13	2026-07-13
work/plans/completed/0070-caller-owns-reporting.md:154	ADR-008	adr/008-caller-owns-reporting.md	2026-07-13	2026-07-13
work/plans/completed/0070-caller-owns-reporting.md:158	ADR-008	adr/008-caller-owns-reporting.md	2026-07-13	2026-07-13
work/plans/completed/0070-caller-owns-reporting.md:68	ADR-008	adr/008-caller-owns-reporting.md	2026-07-13	2026-07-13
work/plans/completed/0072-adoption-surface.md:152	plan 0073	work/plans/0073-violation-telemetry-rule-staleness.md	2026-07-19	2026-07-19
work/plans/completed/0072-adoption-surface.md:183	plan 0073	work/plans/0073-violation-telemetry-rule-staleness.md	2026-07-19	2026-07-19
work/plans/completed/0096-dogfood-missing-crossvalidate-bindings.md:541	plan 0089	work/plans/completed/0089-family-standalone-sufficiency.md	2026-08-12	2026-08-18
work/plans/completed/0096-dogfood-missing-crossvalidate-bindings.md:542	plan 0101	work/plans/completed/0101-sibling-gates-go-fail-closed.md	2026-08-12	2026-08-16
work/plans/completed/0406-md-a-declared-link-is-answered.md:131	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/plans/completed/0406-md-a-declared-link-is-answered.md:240	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/plans/completed/0406-md-a-declared-link-is-answered.md:257	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:148	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:167	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:17	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:19	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:214	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:221	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:224	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:226	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:237	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:276	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:319	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:339	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:365	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:38	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:400	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:407	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:407	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:408	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:466	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:527	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:548	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:551	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:61	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:65	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1131	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1163	Bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1166	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:795	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:156	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:417	bug 0467	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md	2026-10-18	2026-10-18
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:525	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:533	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:704	bug 0467	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md	2026-10-18	2026-10-18
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:803	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:115	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:175	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:265	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:294	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:321	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:94	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:22	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:25	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:34	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:40	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:50	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/proposals/001-md-corpus-rule-coverage.md:403	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-08-09	2026-10-14
work/proposals/001-md-corpus-rule-coverage.md:689	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-08-09	2026-10-14
work/proposals/002-comment-embedded-links.md:162	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-08-12	2026-10-14
work/proposals/002-comment-embedded-links.md:63	proposal 011	work/proposals/011-core-name-the-evidence-gate.md	2026-08-12	2026-09-07
work/proposals/006-mermaid-beyond-classdiagram.md:471	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:473	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:481	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:491	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:493	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:542	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:548	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:548	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:556	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:681	Bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:698	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:710	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
work/proposals/006-mermaid-beyond-classdiagram.md:761	Plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:761	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/proposals/006-mermaid-beyond-classdiagram.md:765	plans 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:820	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/proposals/007-ts-expose-terminalbuilder-declared-state.md:14	proposal 019	work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md	2026-09-03	2026-10-21
work/proposals/017-md-blocks-to-check-a-documents-shape.md:1072	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/proposals/017-md-blocks-to-check-a-documents-shape.md:1091	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/proposals/PROPOSALS.md:189	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/PROPOSALS.md:197	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:126	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:16	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:182	Bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:215	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:291	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:314	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:412	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:461	bug 0403	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:472	Plans 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:55	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:128	Bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:235	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:74	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
```
