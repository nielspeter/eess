# Plan 0542: this repository's record mentions are migrated

## Status

- **State:** Done — all nine phases built 2026-10-27/29, Phase 9 in PR #PENDING → completed/; the corpus holds
  no unlinked record mention, and the gate holds zero and checks a link's target. Frozen 2026-10-27 on the dogfood measurements below, the maintainer's three
  decisions of that day as narrowed by the freeze's review, and no open question. Written
  2026-10-21 so that [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md)'s ledger had a named home for bringing its count to zero.
- **Priority:** High — the release that lets adopters fix their mentions waits on it: eess's own
  corpus, migrated with the fix it ships, is the proof (the maintainer, 2026-10-27).
- **Effort:** Large: nine phases, each its own PR, sized from the counts below to about an hour's
  review (an estimate, not a measurement).
- **Created:** 2026-10-21
- **Builds after:** [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md), [plan 0549](./0549-a-link-names-the-record-it-mentions.md) and [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md), all built.

## Problem

[Plan 0541](./0541-this-repositorys-record-mentions-are-gated.md) holds this repository's unlinked mentions at the base's count and lets it only
fall. This plan brings it to zero with the fix [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md) ships, run the way an adopter
runs it, and then switches the gate to hold zero and to check that a link names its record
([plan 0549](./0549-a-link-names-the-record-it-mentions.md)).

## Decisions — the maintainer, 2026-10-27, as the freeze's review narrowed them

1. **eess alone.** The fix and the target check declare this repository's records only.
   ts-archunit's are not a source and are never linked to: the 11 links to its GitHub URLs outside
   the fold records are reworded in their lanes (corrected 2026-10-28 at lane 3: 11 by
   `git grep`, of which 6 are links in prose, 4 in lane 2 and 2 in lane 4; the other 5 sit in fenced
   probe input in two spikes, which no gate reads, and are left as recorded). **A record** is a numbered file in a lane folder
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
   ([ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md)).

3. **The seven done fold-era records are left out by name.**
   [Plan 0071](./0071-ts-archunit-parity.md),
   [plan 0088](./0088-fold-ts-archunit-into-eess.md),
   [plan 0147](./0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md),
   [plan 0165](./0165-integrate-the-copied-ts-archunit-engine.md),
   `work/fold-audit-2026-08-19.md`, [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)
   (its whole folder, `CONCLUSION.md` included, which uses the spike branch's own numbering) and
   [bug 0198](../../bugs/fixed/0198-no-migration-path-from-ts-archunit.md) describe ts-archunit in its
   own numbering, and none of them will be edited again. The maintainer named ten; the review found
   three of them live, [plan 0090](../0090-adopt-ts-archunit-work-corpus.md),
   [plan 0100](../0100-publish-the-fold-retire-ts-archunit.md) and
   [bug 0303](../../bugs/0303-ts-archunit-adr-numbers-persist-in-eess-comments.md), where an exemption
   would leave new mentions unchecked for good. They go through their lanes instead (23 findings, no
   fix: each reworded or linked by hand). The seven are a named list with its reason in
   `check:corpus`, never a glob: each entry is an exact file path, so
   [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s two files are two entries and
   seven records are eight entries. Each is pinned by its text's hash, so a file that is missing or
   has changed is a finding: the exemption cannot outlive its premise (corrected at Phase 1's
   review from a folder entry, under which any new file was exempt). A test pins the entries.

## Measured — 2026-10-27, at 4a43bcc4, throwaway scripts

The fix over every document but the seven, eess's records only, Decision 2's pattern, `foreign`
matching `ts-archunit` or `upstream`: **3,899 fixes** in 418 files and **519 refusals**. Phase 0's anachronism instrument re-run over the
3,899 (40.4 s, 1,559 git calls): **145** mentions first written before their record's file, at its
current path, first appeared (corrected 2026-10-27 at lane 2: "before their record existed" overstated
it; a record closed by a delete and an add reads as born when it closed, so the count flags more than
the true anachronisms), on
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
branch, in [bug 0302](../../bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md); a
plan number never filed, twice in
[bug 0141](../../bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md); a bug number never
filed, in [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md): each read and
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
  and reds the pin, the same text beside it and inside [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s folder is counted, a deleted entry
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
2. **a judge reads every fix in the lane that links a record whose number ts-archunit also used**,
   whether or not its file names ts-archunit (the engine's code comments carry ts-archunit's
   numbers into records that do not; corrected 2026-10-28 at lane 4, when such a fix shipped; the
   freeze's read set, fixes in files naming ts-archunit, was 294 over all lanes; the new one is
   about 600 for lanes 5 to 8, about 180, 90, 240 and 85, each lane's dry run giving the exact count;
   it covers the same-target search for the three wrong targets so far, all inside the range), and a seeded sample of 20 of the
   lane's other fixes, the seed recorded in the PR; the judge is an agent on a different model from
   the one running the lane. A wrong fix is left out by element before applying, its cause recorded
   in this plan, and the judge then reads every fix in the lane with the same target. The same
   target's mentions in every later lane's files that do not name ts-archunit (which their read
   set misses) are searched for (`git grep`) and listed against those lanes' ledger lines; and
   every link to a ts-archunit GitHub URL in the lane's globs
   (`git grep 'github.com/nielspeter/ts-archunit'`) is listed, to be written as plain text in
   Decision 2's form in step 4 (lane 2's review found four the steps had not met);
3. `--fix --apply`, before any hand edit, so no excluded line has moved;
4. the lane's refusals, anachronisms and the other mentions on their lines closed by hand, as the
   Measured section says; where an agent proposes the edits, a second judge reads, without the
   proposer's reasons, every hand link with a number in ts-archunit's range, whatever its file says
   (corrected 2026-10-28 at lane 4, as step 2 was),
   every call that a number is ts-archunit's, and every other rewording, for meaning (lane 3's
   review); the exclusions it closed removed from the rule file;
5. **closed when the lane's documents hold no unlinked mention**: the rule file holds no exclusion
   in `LANE`, and the dry run over `LANE` reports no finding (with one rule per glob, a glob that
   matches nothing is a dead-glob finding, not clean).

**Files:** the lane's documents, `mention-fix.rules.ts`.

**Lane 2 (Phase 2), built 2026-10-27**, at base 96b0461e, with `LANE` set to `adr/**`, `docs/**`,
`work/*.md` and `work/bugs/rejected/**` (the commit leaves it empty, as between lanes):

- The instrument found 16 anachronisms in 326 fixes, the Appendix's 16 exactly. The dry run gave
  310 fixes and 46 refusals; the plan's 47th refusal, ts-archunit plan 0057 on `docs/calls.md:150`,
  sat on an excluded line, which hides every mention on it.
- The judge (Fable; seed 20261027) read the 30 fixes in the ts-archunit range and 20 sampled: 49
  right, 1 wrong. `adr/002-ts-morph-ast-engine.md:221` names ts-archunit plan 0075, its element-cache
  plan, not eess's. It was left out by element, through a new `JUDGED_WRONG` list in the rule file,
  and no other fix in the lane targets [plan 0075](../0075-manifesto-reconciliation.md). The
  exclusion took the line's two right [proposal 010](../../proposals/010-ts-performance-at-scale.md) fixes with it; they were linked by hand.
- `--apply` wrote 307 links (310 less the line's three); one more, an anachronism read as right,
  was applied after.
- **The anachronisms.** 15 of the 16 name the record they would link to, and were linked (14 by
  hand, one by the fix); `docs/calls.md:150` is ts-archunit's numbering and was reworded. The
  stated cause was wrong at first, corrected 2026-10-27 by the lane's review: 13 of the 15 were
  written after their record existed. The instrument dates a record by `git log --follow` on its
  current path, and a record closed as a delete and an add, not a rename, reads as born the day it
  closed. Two are true anachronisms that still name their record: `docs/manifesto.md:459`'s
  [plan 0073](../0073-violation-telemetry-rule-staleness.md), two hours before the plan, and `adr/023`'s [plan 0496](./0496-sections-as-elements.md), written in the PR after the one that
  filed it. In lane 2 the error flagged more, never fewer, so no wrong link came of it; but the Measured
  section's 145 counts it (corrected there), and the lanes whose targets sit in `fixed/` and
  `completed/` (4, 5, 7, 8) will meet more of it.
- By hand, 55 edits in 17 files: 41 links, 11 rewordings to the ts-archunit form (the
  skipped count, 39 at the base, read 54 at e53014bd: these 11, and 4 in this plan's own record
  of the lanes; 53 after the re-check's last rewording, as lane 3's base read it),
  and 3 incidental examples reworded. Besides those: `docs/markdown.md`'s example forms moved into
  a fenced block, as that page itself advises, and one more example reworded there; and the four
  links to ts-archunit's GitHub URLs in this lane (`adr/009` and `adr/010`, two each) written as
  plain text in the ts-archunit form, as Decision 1 says.
- Two ADR Enforcement rows cite a test title holding a record number, which can be neither linked
  nor fenced. The maintainer chose (2026-10-27) to rename the titles: `an undocumented exclusion
fails the build` and `accepts a repository that extends the base through an intermediate class`
  drop their numbers, each kept in a comment beside its test (`'@nielspeter/eess-ts': none`). [Bug 0295](../../bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md)'s
  record, in lane 5's folder, quotes the second title and was updated with it. Lane 5 holds
  one more title citation, in
  [bug 0325](../../bugs/fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md); only a bug
  record cites it, so it is lane 5's to settle.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 4,045 unlinked mentions against 4,418 at the base (96b0461e), both from its summary.

**Lane 3 (Phase 3), built 2026-10-28**, at base d3945424, with `LANE` set to `work/spikes/**` and
`work/proposals/**` (the commit leaves it empty):

- The instrument found 38 anachronisms on 36 lines in 792 fixes, the Appendix's rows exactly (two
  lines of [proposal 006](../../proposals/006-mermaid-beyond-classdiagram.md) hold two each; one exclusion
  per line). Lane 2's carried ts-archunit plan 0075, at
  [proposal 010](../../proposals/010-ts-performance-at-scale.md)'s lines 67, 232 and 234, went into
  `JUDGED_WRONG` before the dry run. The dry run gave 746 fixes and 109 refusals (the table's 111,
  less two on excluded lines). The GitHub-link grep printed seven lines: the five links below and two
  URLs in inline code, which are not links.
- The judge (Fable; seed 20261028) read the 57 fixes in the ts-archunit range and 20 sampled: 77
  right. `--apply` wrote the 746.
- The rest was closed by hand with two agents beside the lane. A proposer (Fable) read the 148
  items in context and proposed an exact edit for each, 157 in all (the nine more are other mentions
  on excluded lines). A second judge (Fable) read the 29 riskiest: the 11 links in files naming
  ts-archunit with a number in its range, and the 18 rewordings that call a number ts-archunit's.
  29 right; most ts-archunit numbers were pinned by a code comment or a fold-audit row, two by
  eess's own numbering (its plans start at 0051) and one by dates and the eess plan's content.
  Corrected 2026-10-28 at the lane's review: this said the second judge "had not seen the proposer's
  reasoning", but its input carried the proposer's one-line reason for each row. 142 edits applied
  in 24 files: 80 links, 43 rewordings, 18 to the ts-archunit form, and one example moved into a
  fence; 15 items were covered by another's edit. One rewording was applied by hand after the fix
  had linked the first mention it quoted.
- **The review found three rewordings wrong, which no judge had read** (a plain rewording was
  outside the second judge's set):
  [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask B row had come
  to mean a different test; [proposal 001](../../proposals/001-md-corpus-rule-coverage.md)'s quoted
  message had become a `path:line` that never held what it says; and
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s two examples of a form
  that cannot be told apart had been rewritten to show it told apart. Each was put right. A range of
  ts-archunit numbers in [spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md) was hidden
  with an inserted word and is now in the ts-archunit form. So step 4 now has the second judge read every rewording as well, for meaning, without the
  proposer's reasons. Lane 3's own rewordings were read by its review, which had seen the reasons,
  not by a judge reading without them.
- **What the anachronism exclusions caught.** 36 of the 38 name their record and were linked; two
  are ts-archunit's and were reworded ([proposal 002](../../proposals/002-comment-embedded-links.md)'s line 63, ts-archunit proposal 011 with ts-archunit plan 0057 beside it;
  [proposal 007](../../proposals/007-ts-expose-terminalbuilder-declared-state.md)'s line 14, ts-archunit proposal 019 with a plan beside it). The second line hid a
  wrong fix the judge could not have read: that proposal names no ts-archunit, and its plan number is
  ts-archunit's, which `--apply` would have linked to eess's
  [plan 0070](./0070-caller-owns-reporting.md). The lane's other fixes to that plan were
  read (judge 1's j004, j006, j008), and its plain mentions in lanes 4 to 8 all mean eess's. The
  flags were a mix: some true anachronisms filed minutes after the mention ([bugs 0400](../../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md), [bug 0403](../../bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md), [bug 0409](../../bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md)),
  some over-flags from a delete-and-add close.
- Quoted strings were described where a number had to leave them (a code comment, an output
  message, a probe input, an adopter's quote); each still reads true. The lane's one `upstream`
  mention, [spike 0540](../../spikes/0540-one-join-over-every-source.md)'s fixture source name at line
  62, is its share of Decision 2's 15, reworded without the number.
- The five ts-archunit GitHub links in
  [spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md) and
  [spike 0540](../../spikes/0540-one-join-over-every-source.md) sit inside `md` fences of quoted probe
  input, which no gate reads; they are left as recorded, and Decision 1 says so.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 3,142 unlinked mentions against 4,045 at the base; the skipped count, 53 at the base, reads 81 at the commit (`check:corpus`, 2026-10-28): 76
  from the lane's edits and 5 in this record's own ts-archunit forms, a derivation by file.

**Lane 4 (Phase 4), built 2026-10-28**, at base 3f22a927, with `LANE` set to `work/bugs/*.md`
(the live bugs and the board; the commit leaves it empty):

- The instrument found 13 anachronisms on 12 lines in 718 fixes, the Appendix's rows; three
  `BUGS.md` rows sat one line lower, since the board gained a row above them, and were found there.
  The dry run gave 700 fixes and 88 refusals (the table's 89, less one on an excluded line).
- Judge 1 (Fable; seed 20261028) read the 94 fixes in the ts-archunit range, among them
  [bug 0356](../../bugs/0356-project-memoizes-for-process-lifetime-so-a-module-scope-export-builds-every-project.md)'s line 69 carried from lane 2, and 20 sampled:
  113 right, 1 wrong. That carried line names ts-archunit plans 0075 and 0076, the element- and
  module-edges caches, as the code comments under `packages/ts` show; it went into `JUDGED_WRONG`
  and was reworded by hand. No other fix in the lane targets ts-archunit plan 0075's eess namesake, and lane 2's
  search found none in later lanes. Its neighbour, ts-archunit plan 0076, was not searched, and the
  fix linked it once, wrongly: see the retro read below.
- `--apply` wrote 699 links across 152 files.
- The rest by hand, under step 4 as lane 3's review left it. A proposer (Fable) proposed 109 edits
  for the 102 items (the seven more are other mentions on excluded lines), and one more was added
  for the carried line: 105 applied in 37 files, 60 links, 31 rewordings to the ts-archunit form, 12
  other rewordings and 2 fences; 5 were covered by another's edit. All 12 anachronisms were read against git and are over-flags, with three causes
  (corrected 2026-10-28 at the lane's review, from "closed later" for all): a record closed by a
  delete and an add; the instrument dating a mention by its text's first appearance anywhere in the
  file, which gave six board rows citing [ADR-009](../../../adr/009-agent-first-failure-surfaces.md) the date of an older row; and a squash merge's
  ancestry, for two bugs on three lines filed on a stacked branch. Three are delete-and-add closes.
  Judge 2 (Fable), given no reasons, read 72: every rewording and fence, and the 27 hand links in
  files naming ts-archunit with a number in its range. 66 right, 6 wrong, every one a change of
  meaning with the referent right: four rewordings altered verbatim quotes of source comments
  ([bug 0233](../../bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md)'s quoted `execute-rule.ts` comment and three in [bug 0351](../../bugs/0351-an-adr-citation-in-a-source-comment-is-gated-by-nothing.md)), one turned a recorded
  misnumbering into the corrected form, and one board row came to say the wrong ADR has no rules.
  Each was put right: the quotes are fenced whole as they stood at the base, the fix's own link
  inside one of them going with it, and the two sentences say what was cited and how.
- The GitHub-link grep printed four lines in the lane: two links, [bug 0183](../../bugs/0183-upstream-citations-are-pinned-to-a-moving-branch.md)'s line 22 and
  [bug 0538](../../bugs/0538-a-metric-baseline-never-tightens.md)'s line 24, now plain text in the ts-archunit form; [bug 0183](../../bugs/0183-upstream-citations-are-pinned-to-a-moving-branch.md)'s line 13, in a fence; and
  its line 58, in inline code. [Bug 0183](../../bugs/0183-upstream-citations-are-pinned-to-a-moving-branch.md), which is about those links, keeps its URL visible in inline
  code.
- **A wrong link shipped, and a retro read found two more.** The lane's review found that `--apply`
  had linked [bug 0335](../../bugs/0335-the-binding-resolver-asks-the-checker-once-per-identifier.md)'s mention of the module-edges per-file cache, ts-archunit plan 0076
  (`packages/ts/src/core/module-edges.ts` cites it), to eess's [plan 0076](../0076-broader-deterministic-autofix.md). [Bug 0335](../../bugs/0335-the-binding-resolver-asks-the-checker-once-per-identifier.md) does not name
  ts-archunit, so no judge read it. The cause is the engine: its code under `packages/*/src` came
  from ts-archunit, its comments cite 136 numbers inside ts-archunit's range, and records copy them
  without naming the project. So the links lanes 2 to 4 had written to a number in that range were read. A first retro read
  286 of them, picked as those in files not naming ts-archunit: 283 right, 3 wrong. Its picking was
  wrong, as the re-check found: it tested each file at lane 2's base, so it skipped files the lanes'
  own rewordings had made name ts-archunit, and its reasons were mostly one per class, not per link.
  So every one was derived again from the diff, 693 in-range links the lanes wrote
  (`retro2-set.py`, kept with the evidence), and the 432 the first retro had not matched exactly were
  read by two more judges (Fable), each reason quoting the passage: 430 right, 2 wrong, the two the
  re-check had found by hand. Five wrong in all.
  [Bug 0335](../../bugs/0335-the-binding-resolver-asks-the-checker-once-per-identifier.md)'s; [bug 0268](../../bugs/0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md)'s, which is ts-archunit plan 0069, "no rule may certify nothing"
  (`packages/ts/src/cli/rule-file-findings.ts` cites it by name); and [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s, which is
  ts-archunit's ADR-008 rule 2, eess's [ADR-009](../../../adr/009-agent-first-failure-surfaces.md) rule 2, now written as both; and [proposal 007](../../proposals/007-ts-expose-terminalbuilder-declared-state.md)'s and [proposal 010](../../proposals/010-ts-performance-at-scale.md)'s, each a code comment's ts-archunit ADR-008, eess's [ADR-009](../../../adr/009-agent-first-failure-surfaces.md). Each is reworded. Two more links the fix had put inside
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s quoted examples of a reference "written as text" contradicted their sentence and
  are described now. Step 2's and step 4's read sets now cover every number ts-archunit also used,
  whatever the file says. The 423 such links the corpus held before the migration were never read by
  a lane: [bug 0553](../../bugs/0553-links-to-a-colliding-number-written-before-the-migration-are-unjudged.md). The 0543 table moved into a fence keeps its content in another notation;
  left as it is.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 2,335 unlinked mentions against 3,142 at the base, and 130 skipped after ts-archunit
  against 81 at the base (`check:corpus`, 2026-10-28), the retro read's rewordings and this record's
  own ts-archunit forms included.

**Lane 5 (Phase 5), built 2026-10-28**, at base 4452d7fd, with `LANE` set to `work/bugs/fixed/**`
(the commit leaves it empty), under steps 2 and 4 as lane 4 left them:

- The instrument found 9 anachronisms in 521 fixes, the Appendix's rows exactly. The dry run gave
  509 fixes and 91 refusals: the table's 92 less the one lane 2 closed, [bug 0295](../../bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md)'s quoted test
  title. The grep found no ts-archunit GitHub link in the lane.
- Judge 1 (Fable, in two halves; seed 20261028) read every fix whose number ts-archunit also used,
  213, and 20 sampled: 228 right, 5 wrong. Three are ts-archunit's numbering copied from a code or
  test comment: [bug 0173](../../bugs/fixed/0173-the-line-index-cache-serves-a-stale-measurement.md)'s ts-archunit ADR-008 (eess's [ADR-009](../../../adr/009-agent-first-failure-surfaces.md)), [bug 0199](../../bugs/fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)'s ts-archunit
  plan 0078 (the configuration-finding census) and [bug 0239](../../bugs/fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)'s ts-archunit plan 0079 (the
  cardinality triage). One, [bug 0170](../../bugs/fixed/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md)'s ts-archunit ADR-008, came from the enforcement reviewer's
  checklist (below). The fifth, [bug 0278](../../bugs/fixed/0278-the-strict-family-barrel-kept-the-count-and-dropped-the-functions.md)'s, named the fold plan where it meant PR #88, the kernel
  split. Each went into `JUDGED_WRONG` and was reworded; every other fix to those targets is in the
  range, so the judges read them. `--apply` wrote 504 links across 108 files.
- By hand: a proposer (Fable) proposed 105 edits for the 100 items; 93 were applied, 10 were
  markers that another edit covers, and 2 were decided otherwise. With the 4 the builder wrote for
  four judged-wrong lines (the proposer's own fence covers the fifth, [bug 0173](../../bugs/fixed/0173-the-line-index-cache-serves-a-stale-measurement.md)'s quoted code
  comment), and one applied later, below, that makes 98. The two decided otherwise: a proposed
  rename of a test title to carry "ts-archunit bug 0016" went instead the way lane 2 went, the two
  titles in `packages/core/tests/contract/extension-surface.test.ts` holding ts-archunit's bug 0016
  dropping the number, each kept in a comment, and every record quoting them updated ([bug 0155](../../bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md),
  and [plan 0150](../0150-close-0088s-disclosed-review-findings.md), lane 6's); and a proposed edit to a reproduction inside a fence, applied later.
  [Bug 0325](../../bugs/fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md)'s quote of a third test title went the same way as the two. `'@nielspeter/eess': none`
  and `'@nielspeter/eess-ts': none`.
- Judge 2 (Fable), given no reasons, read 78: every rewording and fence and every hand link with a
  number in ts-archunit's range, whatever the file. 73 right, 4 wrong, 1 unsure. [Bug 0179](../../bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md)'s
  quoted wrong citation had been linked, which recreates the defect its paragraph describes; the
  citation is fenced now, as it stood. [Bug 0507](../../bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md)'s three table cells, which quote a reproduction's
  input, no longer matched the reproduction; the reproduction takes the same placeholder for its
  synthetic plan number, with a dated note that the run and its test use the number. The unsure one,
  [bug 0170](../../bugs/fixed/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md)'s "attribution, not colour", is the enforcement reviewer's checklist
  (`.claude/agents/reviewer-enforcement.md:37`), which gives "Agent-First Failure Surfaces"
  ts-archunit's number, ts-archunit's ADR-008, as reworded; that file's numbering is
  [bug 0303](../../bugs/0303-ts-archunit-adr-numbers-persist-in-eess-comments.md)'s.
- Five edits came after judge 2 ran and were read by the lane's method review instead: [bug 0179](../../bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md)'s
  fence, [bug 0507](../../bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md)'s reproduction, and the three test-title quotes in [bugs 0155](../../bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md) and 0325 and [plan 0150](../0150-close-0088s-disclosed-review-findings.md). The review found [bug 0179](../../bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md)'s first rewording a paraphrase of the quoted citation, now fenced,
  and [bug 0507](../../bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md)'s change unnoted, now noted. It also found [bug 0155](../../bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md)'s pointer to the renamed test
  three lines off after the rename, corrected; and a nonvacuity fixture, `corpus/docs-only-owner`,
  that sabotaged [bug 0219](../../bugs/fixed/0219-corpus-listing-surface-is-undocumented.md) by stripping its `Implements` line as plain text, which this lane had
  linked; `validate` refused the probe that could no longer fire, and it now matches the line in
  either form.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 1,720 unlinked mentions against 2,335 at the base (its summary is kept with the lane's
  evidence).

**Lane 6 (Phase 6), built 2026-10-29**, at base 8685289f, with `LANE` set to `work/plans/*.md`
(the live plans and the board; the commit leaves it empty), under steps 2 and 4 as lane 4 left them:

- The instrument found 13 anachronisms on 12 lines in 480 fixes, the Appendix's rows exactly. The
  dry run gave 451 fixes and 63 refusals. The 12 lines hold 29 fixes, counted from a dry run
  without the exclusions (the instrument's "hides" notes sum to 17 against the 16 others counted, since
  the board's line 70 at the base holds two anachronisms and its note counts the second among the others),
  so 480 less 29. The refusals are the table's 66 less the two test-title quotes lane 5 renamed in
  [plan 0150](../0150-close-0088s-disclosed-review-findings.md), less one on an excluded line. The GitHub-link grep printed one line, this plan's own
  step 2, in inline code; no test title in the lane holds a record number.
- Judge 1 (Fable; seed 20261029) read the 79 fixes in ts-archunit's range and 20 sampled: 99
  right, so no fix was left out and no same-target search was owed. `--apply` wrote 451 links
  across 21 files.
- By hand: a proposer (Fable) proposed 88 edits for the 75 items (the 13 more are other mentions on
  excluded lines). 85 were applied in 15 files: 73 links, 9 rewordings to the ts-archunit form, 2
  other rewordings and 1 fence; 3 were covered by another's edit. The builder changed one: [plan 0346](../0346-a-finding-is-identified-by-the-code-it-matched.md)'s
  sentence on an earlier draft's ADR number, proposed as a link, now says the draft gave its ADR the number 016, which [ADR-016](../../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md), Bounded Instruments, holds; a link on the draft's number would name an ADR the draft never meant. That line is the lane's one true anachronism; the other 11 are
  over-flags, ten written the day their record was filed and one, the board's row for [plan 0346](../0346-a-finding-is-identified-by-the-code-it-matched.md),
  dated by an older row's text. The carried mentions in [plan 0150](../0150-close-0088s-disclosed-review-findings.md) are
  ts-archunit bug 0016, as the tests they cite say, and are written in that form. The lane's share of Decision 2's 15 `upstream` mentions is one, on the board's line 106 at the base, now in the ts-archunit form.
- Judge 2 (Fable), given no reasons, read 34: every rewording and the fence, and the 22 hand links
  with a number in ts-archunit's range: 34 right.
- The board's row for this plan still said its judges read the freeze's 294 fixes, a read set
  step 2 widened at lane 4; it now says every fix to a number ts-archunit also used.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 1,176 unlinked mentions against 1,720 at the base, and 181 skipped after ts-archunit against
  170, one of them in this record (`check:corpus`, 2026-10-29). The docs link test passes over
  the lane.

**Lane 7 (Phase 7), built 2026-10-29**, at base 9be99075, with `LANE` set to
`work/plans/completed/0[0-3]*.md` and `work/plans/completed/04[0-4]*.md` (the closed plans numbered below 0450; the commit leaves it empty), under steps 2 and 4 as lane 4 left them:

- The instrument found 35 anachronisms on 34 lines in 475 fixes, the Appendix's lines exactly. The
  dry run gave 438 fixes, the other 37 sitting on the excluded lines, and 77 refusals, the table's 78
  less one on an excluded line. The greps found no ts-archunit GitHub link and no test title holding
  a record number.
- Judge 1 (Fable, in two halves; seed 20261029) read the 171 fixes in ts-archunit's range and 20
  sampled: 189 right, 2 wrong. [plan 0089](./0089-family-standalone-sufficiency.md)'s mention of the fold's port of ts-archunit's ADR-008/009, which eess took as
  [ADR-009](../../../adr/009-agent-first-failure-surfaces.md) and [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md), had been linked to eess's [ADR-008](../../../adr/008-caller-owns-reporting.md); and [plan 0237](./0237-eess-runtime-use-only-in-rule-files.md)'s ts-archunit plan
  0067 C, cited from `packages/ts/src/core/project-relative.ts:2`, to eess's [plan 0067](./0067-harness-informed-roadmap.md). Both went
  into `JUDGED_WRONG` and were reworded into the ts-archunit form. The lane's other fixes to those two
  targets, eight and one, were in the read set and right, and lane 8's files hold neither form.
  `--apply` wrote 436 links across 32 files.
- By hand: a proposer (Fable) proposed 115 edits for the 111 items (the 4 more are other mentions on
  excluded lines), all applied in 26 files: 90 links, 16 rewordings to the ts-archunit form, 7 other
  rewordings and 2 fences; with the builder's two for the judged-wrong lines. All 34 anachronism lines
  are over-flags, a record filed the same day or one whose first commit at its path is its move to
  `completed/`, and were linked. Of the proposer's open calls the builder settled one by measurement:
  [plan 0148](./0148-workspace-multi-root-awareness.md)'s fail-closed citation means eess's [ADR-009](../../../adr/009-agent-first-failure-surfaces.md): the passage and the code comment it echoes, in
  `project-relative.ts`, were written in eess on 2026-08-16, in the commit that created that ADR
  (6dbc6f46), and the comment was re-wrapped on 2026-08-21 (corrected 2026-10-29 at the lane's
  review, which found the first date given here was the re-wrap's).
- Judge 2 (Fable), given no reasons, read 61: the 25 rewordings and fences, the builder's two, the 30 hand
  links with a number in ts-archunit's range, and four more on a closed plan's deferral, three of
  them unwrapped from code and one dropping a duplicate link after its token. 61 right; every `deferred→` token
  still matches the ledger's reading. One it passed, a paraphrase of a fixture line that
  [plan 0405](./0405-md-select-the-links-a-block-declares.md) had quoted verbatim, was found by the lane's review; the example now says beside it that the
  fixture's line names the bug by its number. A fence would have kept the words, as that file's other
  fixture quote is kept, but a fence inside a list item is read as prose by the docs link test
  ([bug 0416](../../bugs/0416-the-link-test-reads-an-indented-fence-as-prose.md)), and this line holds a link.
- **One more wrong fix, outside both judges' sets.** After judge 2, the builder found that
  [plan 0405](./0405-md-select-the-links-a-block-declares.md)'s sabotage row quoted a fixture's colon-less "Related to" line, whose bug number is
  sample data, and that the fix had linked the number to eess's [bug 0253](../../bugs/0253-frozen-drift-is-not-reported-only-unexamined.md). The row is described now,
  and the lane's method review read it. Judge 1 reads a fix past ts-archunit's range only by sample,
  so the builder scanned the lane's links inside double quotes; it found two more, both a quoted
  criterion naming the plan it means, which are right. The method review then ran the wider search,
  each fix's text matched against the tests, fixtures and examples, and links near "e.g.",
  "fixture" or "sample": nothing more. Lane 8 carries that search.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 623 unlinked mentions against 1,176 at the base, and 201 skipped after ts-archunit against 181, two of them in this record
  (`check:corpus`, 2026-10-29). `check:ledger`, the docs link test, format and `check:fast` pass
  over the lane.

**Lane 8 (Phase 8), built 2026-10-29**, at base 15aa6a42, with `LANE` set to
`work/plans/completed/04[5-9]*.md` and `work/plans/completed/0[5-9]*.md` (the closed plans numbered
0450 and above; the commit leaves it empty), under steps 2 and 4 as lane 4 left them:

- The instrument found 21 anachronisms on 21 lines in 587 fixes, the Appendix's lines exactly. The
  dry run gave 562 fixes, the other 25 sitting on the excluded lines, and 35 refusals, the table's 36
  less one on an excluded line. The GitHub-link grep printed one line, a URL in inline code; no test
  title in the lane holds a record number.
- The search lane 7 carried, run before the judges: each fix's text, with twelve characters either
  side, matched against `packages/*/tests/**`, `scripts/nonvacuity/**`, `scripts/check-nonvacuity.mjs`
  and `examples/**`, and every fix within sixty characters of "e.g.", "fixture", "sample",
  "probe" or "synthetic" listed (a first pass that also keyed on "example" gave 47; the 30 more sit near the word "example" only, most of them the examples gate's name or
  an example file under it, and the lane's method review read each and found a real reference; the script, `sample-scan.py`, is kept with the evidence and
  reproduces both counts at the base). 17 hits, each a real reference: sibling plans named beside
  their own fixtures, [bug 0502](../../bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md) named beside another review item's fixture, and one code comment citing [ADR-005](../../../adr/005-no-any-no-type-assertions.md).
- Judge 1 (Fable, in two halves; seed 20261029) read the 134 fixes in ts-archunit's range and 20
  sampled: 154 right, so no fix was left out and no same-target search was owed. `--apply` wrote 562
  links across 19 files.
- By hand: a proposer (Fable) proposed 61 edits for the 56 items (the 5 more are other mentions on
  excluded lines), all applied in 14 files: 55 links, 3 fences, 2 rewordings and 1 rewording to the
  ts-archunit form. The builder changed one, dropping two bare-number links the proposer had added
  after a list's first number, as the fix links only the first (corrected 2026-10-29 at the lane's
  review, which found that lane 5 had linked each number of such a list, twice, in [bug 0502](../../bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md)'s
  and [bug 0507](../../bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md)'s State lines; this said the earlier lanes link only the first). Five items are
  sample data, a number in a quoted fixture line, an adopter-notation example, a pattern's example
  and two quoted mentions as written: three are fenced word for word and two reworded, none linked.
  The carried search's other half, every hand edit whose old text held a code span with a mention
  matched against the fixtures, found one verbatim fixture line, `task-items-marks.test.ts:124`,
  which is among the three fenced. All 21 anachronism lines are over-flags, each record filed the
  day its mention was written, and were linked.
- Judge 2 (Fable), given no reasons, read 15: every rewording and fence, every hand link with a
  number in ts-archunit's range, and two more, a closed plan's `done-otherwise` box and the list
  the builder changed: 6 rewordings and fences, the five sample-data rows among them, 7 links and
  those 2. 15 right. One unwrapped `deferred→` token on a ticked box, in no judge's set, was read
  by the lane's method review.
- Closed: with no exclusion left, the dry run over the lane reports no fix and no finding. The gate
  reads 0 unlinked mentions against 623 at the base, and 202 skipped after ts-archunit against 201
  (`check:corpus`, 2026-10-29). `check:ledger`, the docs link test and format pass over the lane.

### Phase 9 — the gate holds zero, and checks the target

- **A skipped number past ts-archunit's range is red.** ts-archunit's numbering runs to 10 ADRs,
  106 plans, 80 bugs, 28 proposals and 69 spikes, so a bug numbered past 0080 after `ts-archunit`
  cannot be its record:
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
- **The target.** [plan 0549](./0549-a-link-names-the-record-it-mentions.md)'s join over Decision 1's records with `areInTitleLinks`,
  paired with `beLinked()`, `.expectNonEmpty()` written, reading the same left-out list as the
  mention rule. Re-run first: its census (one true red, the `ROADMAP.md` row for
  [plan 0454](./0454-box-marks-are-the-callers.md), over 1,409 judged links) was taken
  with ts-archunit as a source, before Decision 1. A red beyond that row is recorded as a bug, not
  fixed here. Its rows: a crossed link red, a title link green, an empty mention side red. What it
  cannot see: a link to a record whose number ts-archunit also used that no judge read (the 423
  written before the migration are [bug 0553](../../bugs/0553-links-to-a-colliding-number-written-before-the-migration-are-unjudged.md)), and a linked mention written after `ts-archunit`,
  which the pattern skips.
- `mention-fix.rules.ts`, `scripts/lib/mention-anachronisms.mjs` and
  `scripts/lib/record-mention.mjs`'s lane exports removed; `CLAUDE.md`'s `check:corpus` entry says
  the rule holds zero.

**Files:** `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs`, `scripts/lib/`,
`package.json` (`record-mention-base.test.mjs` leaves the `node --test` list),
`work/plans/ROADMAP.md`, `CLAUDE.md`, `mention-fix.rules.ts` (deleted).

**Phase 9, built 2026-10-29**, at base 0a13f919, the corpus at zero:

- **A skipped number past ts-archunit's range is red.** Each kind has its own alternative, skipped
  only when it follows `ts-archunit` or `ts-archunit's` and its number is in ts-archunit's range,
  the range a pattern beside the kind in `scripts/lib/record-mention.mjs` (`KINDS`). A test holds
  every written number of every kind to it, after both forms, and a range narrowed by one reds it.
  The corpus held one such mention, this plan's own example in inline code, now reworded.
- **Zero outright.** Every finding of the rule is red. The base machinery is gone: the base module
  and its tests, the seam and its finding, the unreadable-base finding, the shallow-clone stop and
  the census keys. Decided at build, to be overruled if wrong: the shared-census-key finding went
  with the counts it protected, since two files that share a key now share nothing;
  `corpus/record-number-unique` and `check:numbers` keep a number to one record. `check:corpus`
  takes 7.0 s, against 8.2 s at the base.
- **What it says.** The remedy is chosen by cause: a number naming no eess record (the ts-archunit
  form inside the range, else correct it), a record past the range (the link, named in full, and
  that `ts-archunit` before it does not skip it), and a record inside it (the link, or the ts-archunit
  form, which takes it out of every check). A mention in inline code is told to leave the span. The
  summary counts the mentions examined, the unlinked, the skipped, the seven records left out (eight
  documents) and the links the join judged.
- **The target.** The census re-run over eess's records alone: 5,749 linked mentions, 5 title links
  exempt, 5,744 judged (22 of them to this repository's own GitHub URLs), and one red, the board row
  for [plan 0454](./0454-box-marks-are-the-callers.md), a click on its quoted bug landing on the plan. The row now links the bug outside
  the plan's link. The join adds 0.2 s and is its own receipt member, 11,488 checks.
- **The rows.** The 13 base-era rows are replaced one for one, in place, so no other fixture changes
  shard (round-robin by position, and [bug 0552](../../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)'s slowest shard keeps its load): a plain mention,
  the no-record and in-range remedies, a done folder, a committed mention in a live and in a done
  folder (the switch itself, in a shared clone), the unread mention, the three waiver forms, a
  crossed link, a title link and the same row a word off, and the empty side (a copy of the script
  whose join selects nothing, since emptying a real corpus trips the dead-root refusal first). Each
  red half asserts the exact set and the printed `Fix:`; each remedy row writes in the link the
  finding gave and is green, exit 0. Phase 1's two rows stay, rewritten: in-range numbers after
  `ts-archunit` are skipped, the count rising by the ten written, and a number one past the range,
  after either form, is red. The 15 rows ran in 303 s.
- `mention-fix.rules.ts`, `scripts/lib/mention-anachronisms.mjs` and the lane exports are removed;
  `CLAUDE.md` says the rule holds zero.
- What it cannot see stays as Phase 9 says: [bug 0553](../../bugs/0553-links-to-a-colliding-number-written-before-the-migration-are-unjudged.md)'s links, and a number in ts-archunit's range
  written after `ts-archunit`.

## Out of scope

- Code references that point at the wrong line: [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md).
- Links to ts-archunit, by Decision 1.

## Superseded at the freeze, kept as history

The Draft's numbers and Appendix came from [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s Phase 0, which declared ts-archunit
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
  ts-archunit used: 294, measured at 4a43bcc4. [Spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s `CONCLUSION.md` was already left out
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

Method, Ready with fixes, kept: [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s folder makes the seven records eight documents, which
the list, its test and the summary now say; 3 of the 15 `upstream` mentions, not all of them, are
what `foreign` keeps from `--apply`; the first freeze's 16 counted one in the fold audit, a left-out
document. Every new number was reproduced at 4a43bcc4.

## Progress ledger

- [x] Ready (2026-10-27)
- [x] Phase 1 — the gate's narrowing, proven, and the rule file
- [x] Phase 2 — `adr/`, `docs/`, `work/` root, `work/bugs/rejected/`
- [x] Phase 3 — `work/spikes/`, `work/proposals/` (carried from lane 2: ts-archunit plan 0075 in
      [proposal 010](../../proposals/010-ts-performance-at-scale.md) at lines 67, 232 and 234; the file
      names no ts-archunit, so the judge's read set misses it; the ts-archunit GitHub links in
      [spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md) (lines 48, 49) and
      [spike 0540](../../spikes/0540-one-join-over-every-source.md) (lines 47, 48, 54); ts-archunit plan 0075 excluded and reworded, the GitHub links left as
      recorded as fenced probe input, Decision 1 corrected)
- [x] Phase 4 — `work/bugs/` (live) (carried from lane 2, for the judge:
      [bug 0356](../../bugs/0356-project-memoizes-for-process-lifetime-so-a-module-scope-export-builds-every-project.md)'s
      mention of a plan numbered 0075 at line 69, read as ts-archunit's; the ts-archunit GitHub
      links in [bug 0183](../../bugs/0183-upstream-citations-are-pinned-to-a-moving-branch.md) (line 22)
      and [bug 0538](../../bugs/0538-a-metric-baseline-never-tightens.md) (line 24); ts-archunit plan 0075 confirmed by judge 1 and reworded, the
      GitHub links written as plain text)
- [x] Phase 5 — `work/bugs/fixed/`
- [x] Phase 6 — `work/plans/` (live) (carried from lane 5: [plan 0150](../0150-close-0088s-disclosed-review-findings.md)'s prose mentions
      of ts-archunit's bug 0016, its two test-title quotes already updated; reworded to the
      ts-archunit form)
- [x] Phase 7 — `work/plans/completed/` 0001–0449
- [x] Phase 8 — `work/plans/completed/` 0450 and above (carried from lane 7: each fix's text matched
      against the tests, fixtures and examples, and the links near "e.g.", "fixture" or "sample",
      since judge 1 reads a fix past ts-archunit's range only by sample; and every hand rewording of a
      code span, its old text matched against the fixtures, so a quote is kept or fenced rather than
      paraphrased; both run, and no fix or hand edit links sample data)
- [x] Phase 9 — the gate holds zero and checks the target

Deferred: none. The links written before the migration, unjudged, are [bug 0553](../../bugs/0553-links-to-a-colliding-number-written-before-the-migration-are-unjudged.md)'s, filed
at lane 4.

## Appendix — the 145 anachronisms, at 4a43bcc4

Each a mention first written before the record it would link to first appeared at its current
path, with both dates (corrected 2026-10-27 at lane 2: see the Measured section; many are not true
anachronisms). The
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
