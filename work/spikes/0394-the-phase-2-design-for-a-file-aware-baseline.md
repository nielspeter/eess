# Spike 0394: the Phase 2 design for a file-aware baseline

Started 2026-10-06 for [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s
Phase 2, as the second of its records. Time box: one working day. It ends in a design brought
back for a decision, not in code. The decision was delegated and is recorded under Decision
(2026-10-06, revised 2026-10-07 after review); one part of it moved to
[spike 0395](./0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md).

## The question

The maintainer decided on 2026-10-06 that the baseline matcher checks the file each entry records
([bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md),
[spike 0390](./0390-a-or-e-where-the-file-enters-a-findings-identity.md)). Plan 0346 left five
questions open, and this spike answers them:

1. **Grouping.** Leave `disambiguateIdentities`' grouping as it is (E0), or group per file (E+).
2. **Every consumer keyed by hash alone.** Under per-file grouping each must be keyed by
   `(hash, file)`, or it changes meaning. This spike's first output is that list, read from the
   code.
3. **A baseline with no recorded root.** Turn the check off, match nothing, or compare against the
   rediscovered root.
4. **The diagnosis.** How it tells "fixed there, made here" from "copied" and "moved".
5. **Identity-bearing and metric findings that move file.**

## Census: what keys on the hash, the subject or the grouping

Read from the code on `main` at `b1335f5`.

**eess-ts baseline** (`packages/ts/src/helpers/baseline.ts`):

| #   | consumer                                            | where                                               | keyed by today     |
| --- | --------------------------------------------------- | --------------------------------------------------- | ------------------ |
| C1  | `isKnown`, the matcher                              | `Baseline.isKnown`                                  | hash               |
| C2  | `hasEntry`, read by both diagnostics below          | `Baseline.hasEntry`                                 | hash               |
| C3  | the accepted-measurement map, a metric's ceiling    | `acceptedMeasurements`, `isKnown`                   | hash               |
| C4  | the stale-measurement diagnosis                     | `acceptedMeasurements.get` in `Baseline`            | hash               |
| C5  | the description-change diagnosis (`renamedRuleFor`) | `knownSubjects`, `baseline-diagnostics.ts`          | subject hash       |
| C6  | the "matched nothing" diagnosis                     | `matched` count from `hasEntry`, `knownHashes.size` | hash               |
| C7  | the regenerate summary (`+N, −N`)                   | `generateBaseline`, `readPriorHashes`               | hash               |
| C8  | loading                                             | `withBaseline`                                      | hash, subject hash |
| C8a | the public `size` getter                            | `Baseline.size`                                     | hash count         |

**Kernel baseline** (`packages/core/src/baseline.ts`), used by any dialect that baselines through
the kernel:

| #   | consumer                                    | keyed by today |
| --- | ------------------------------------------- | -------------- |
| C9  | `isKnown`                                   | hash           |
| C10 | the accepted-measurement map                | hash           |
| C11 | `generateBaseline` (no summary, no version) | hash           |

**Grouping and its readers:**

| #    | consumer                                                               | keyed by today    |
| ---- | ---------------------------------------------------------------------- | ----------------- |
| C12  | `groupKeyOf` in `disambiguateIdentities` (eess-ts `applyFilters` only) | `rule::subject`   |
| C12a | the suffix reservation (`taken`) inside `disambiguateIdentities`       | `rule::candidate` |
| C13  | `hasIdentityCollision`, the deferred-warning collision guard           | `rule::subject`   |
| C14  | `identityCollisions()`, the disclosure channel                         | `rule::subject`   |
| C15  | the kernel `applyFilters`, which sibling dialects use                  | no disambiguation |

**Above the baseline, keyed by subject:**

| #   | consumer                                                       | note                                                              |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| C16 | a deferred warning's `accepted` list (bug 0389's `isAccepted`) | raw or portable subject; a subject without a path carries no file |
| C17 | `check-all`, the CLI `check`, both `execute-rule` paths        | call `filterNew`; inherit C1                                      |
| C18 | the CLI `baseline` command                                     | prints C7                                                         |
| C19 | plan 0346's Phase 3 migration join                             | not built; joins on what C1 defines                               |

Three facts this list makes plain:

- **C13 protects C16, it does not follow grouping.** The collision guard exists because an
  `accepted` list is keyed by subject, which carries no file (its docstring says so). This census
  first filed it under "follows per-file grouping"; enforcement review measured that keying it per
  file lets copies in new files arrive already accepted (Review, below). Also missed at first: the
  suffix reservation inside `disambiguateIdentities` (C12a), and the public `Baseline.size` (C8a),
  which undercounts once two entries can share a hash.
- **An `accepted` list has bug 0388's hole too.** A subject without a path (`element::message`)
  carries no file, so an entry for it forgives the same finding in another file, raw or portable.
  Bug 0389 did not change that; it is the same class as 0388 and belongs to this phase.
- **Sibling dialects never disambiguate** (C15), so for them two findings with one subject in one
  file already share an entry. That is [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)'s.

## Method

One worktree of `main` at `b1335f5`, its own `node_modules` built entry by entry with the
`@nielspeter/*` links copied as relative links, so it resolves its own kernel (proven: the kernel's
realpath is the worktree's `packages/core`, and its built `dist` carries the patch). One patch
(Appendix A) adds every variant behind environment switches, so all rows run on identical code:

- `SPIKE_VARIANT=main` — today's behaviour.
- `SPIKE_VARIANT=E0` — the matcher checks the file each entry records, in both baselines; an entry
  with no recorded file matches nothing; grouping unchanged.
- `SPIKE_VARIANT=EP` — E0, plus per-file grouping (C12) and a per-file collision guard (C13), plus the
  accepted-measurement maps keyed by `(hash, file)` (C3, C10).
- `SPIKE_VARIANT=EP2` — added after review: EP with the collision guard left as on `main` and the
  suffix reservation keyed like the group key.
- **In every non-`main` variant**, not only EP, the description-change diagnosis (C5) is keyed by
  `(subject, file)` and the regenerate summary (C7) by `(hash, file)`. So E0's cells for rows R7 and
  R13 include those two re-keys, and no run measured either without them.
- Not re-keyed in any variant: the stale-measurement diagnosis (C4), the "matched nothing" count (C6)
  and `Baseline.size` (C8a). The recommendation includes them; they are reasoned, not measured.
- `SPIKE_NOROOT=off|none|rediscover` — for a baseline that records no root: skip the file check,
  match nothing, or compare against the root rediscovered at load.

The harness (Appendix B) runs each row through the public baseline API on a real repository on disk
(a `.git` directory and a named `package.json`). Runs were not timed individually. Rows R5, R6 and R8
use hand-built findings, which `filterNew` receives without `disambiguateIdentities`; real eess-ts
producers would have suffixed R5's metric identity with its path, though the kernel's
`applyFilters` (C15) would not disambiguate either. The suite runs below used `SPIKE_NOROOT`'s
default, `rediscover`.

## Results

| #   | row                                                               | `main`                                 | E0                                        | `EP` and `EP2`           |
| --- | ----------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------ |
| R1  | six cross-file cases (fix `a`, the same finding in `b`)           | **0 of 6** reported                    | 6 of 6                                    | 6 of 6                   |
| R2  | unchanged code                                                    | nothing                                | nothing                                   | nothing                  |
| R3  | fix `a`, `b` was reviewed                                         | nothing                                | **`b` reported** + a note                 | nothing                  |
| R4  | add the same finding in an earlier-sorted file                    | **`b` reported, the new one forgiven** | all three reported + a note               | the new one only         |
| R5  | a metric ceiling that worsened, 3 → 9, identity without the file  | **forgiven**                           | **forgiven** (hand-built; see Method)     | reported                 |
| R6  | a finding with an empty `file` against a file's entry             | **forgiven**                           | reported                                  | reported                 |
| R7  | regenerate summary, `a` stays and `b` duplicates it               | `+0`                                   | `+1`                                      | `+1`                     |
| R8  | an entry with no recorded file                                    | **forgives `b`**                       | reports `a` and `b`                       | reports `a` and `b`      |
| R9  | no recorded root, `off`                                           | —                                      | forgives `b` (as `main`)                  | forgives `b` (as `main`) |
| R10 | no recorded root, `none`                                          | —                                      | reports everything, even unchanged code   | same                     |
| R11 | no recorded root, `rediscover` (baseline at the repository root)  | —                                      | reports `b`, unchanged code clean         | same                     |
| R12 | a renamed file: a plain, an identity-bearing and a metric finding | all forgiven                           | all reported                              | all reported             |
| R13 | the note on the 0388 case                                         | none                                   | "matched nothing", advising to regenerate | same                     |
| R14 | an `accepted` list, cross-file                                    | **forgiven**                           | **forgiven**                              | **forgiven**             |
| R15 | the kernel baseline, cross-file                                   | **forgiven**                           | reported                                  | reported                 |

The last column holds two runs, which agreed on every row. EP2 was run after review, and
enforcement review re-ran both with the same result.

R13's note text comes from Appendix D (the harness logs only its first 50 characters). **On the
0388 case that note is wrong twice:** its first listed cause is "you upgraded", which is false here
(ADR-009 rule 2), and its remedy is to regenerate, which forgives `b` without review. An agent
following its `Fix:` line undoes the check, so the note must change in the same build. R14 shows
`warn` for a list that holds the subject; an unaccepted subject escalates to `error`
(`packages/ts/src/core/terminal-builder.ts:437-439`), but no control row was run.

**The diagnosis.** A prototype classifier (Appendix C), **run under `EP`**, for a finding whose hash an
entry holds but for another file, decides by whether that entry's file still has its finding in this
run, and whether the file still exists on disk. Its "copied" branch depends on per-file grouping:
under `main`'s grouping the copy is suffixed `#1` and reads as new.

| case                             | the prototype says                   |
| -------------------------------- | ------------------------------------ |
| fixed in `a`, made in `b` (0388) | "fixed in `src/a/x.ts`, made here"   |
| `a` stays, `b` added (copied)    | "copied (still in `src/a/x.ts`)"     |
| `a` renamed to `z`               | "moved or renamed from `src/a/x.ts`" |

## Review, and EP2

Enforcement and method review (2026-10-06) reproduced every Results cell. The findings below were
measured by enforcement review with its own probes, not by this spike's harness; they are recorded
here with that source, and the probes are not appended.

- **EP is greener than `main` for an `accepted` list** (Critical). Keying the collision guard (C13) per
  file let a finding copied into a new file arrive already accepted: with a list built from `a`,
  `a` staying and `b` copying it gave `a:warn, b:warn` under EP against `a:error, b:error` on `main`
  and E0. The suite catches a neighbouring shape, the swap (`a` fixed, `c` new): under EP,
  `deferred-warning.test.ts` ·
  `it('the swap, reproduced with a colliding subject: a genuinely new finding is escalated, not silently absorbed')`
  and `it('diagnose() names the collision, not "not accepted" — a different, more urgent cause')` fail.
- **EP produces duplicate identities** inside one file, because the suffix reservation (C12a) is still
  keyed without the file: `[X, X, X#1]` gave `X, X#1, X#1`.
- **`rediscover` is not strictly fail-closed.** With the author's root at `r`, the baseline at
  `r/pkg/b.json`, and `r/pkg` later given its own `.git`, EP2 does two things at once: it reports the
  unchanged finding at its recorded path and forgives a new one at `pkg/src/a/x.ts`. `main` forgives
  the new one too (bug 0388) and does not false-red the unchanged one. A kernel-written baseline read from a subdirectory records `../src/a.ts` and false-reds
  unchanged code (1 finding under EP2, 0 on `main`). R11 put the baseline at the repository root,
  the one place both path conventions agree.
- **The attribution prototype gives a false cause** on two of five harder shapes (a clean new file at
  a moved file's old path; two copies of which one moved), states two causes for one finding in a
  third, and in a partial run (`--changed`, `.excluding()`) claims "fixed there" about a file it did
  not examine. It has to read the findings before filters, and say when a file was not examined.

**EP2** fixes the first two. Measured on the full eess-ts suite (3,970 tests, about 40 s per variant,
all with `SPIKE_NOROOT` at its default, `rediscover`):

| variant | failing (`main` fails 18; the same 18 fail under EP and EP2) | failing only under the variant |
| ------- | ------------------------------------------------------------ | ------------------------------ |
| EP      | 27                                                           | 9                              |
| EP2     | 25                                                           | 7                              |

EP2's seven:

- three that record the fix landing: 0159's KNOWN GAP test flips, and `identity-uniqueness.test.ts`'s
  two `beImported` rows pinned the cross-file `#1` suffix that per-file grouping removes;
- two guards whose fixtures spread the findings across files, which no longer collide:
  `deferred-warning.test.ts` · `it('two same-named violations across files collide onto bare + "#1"')`
  and `identity-uniqueness.test.ts` · `it('a generated suffix never lands on a subject a producer already emits')`.
  These are not routine updates. The second is the only test that kills deleting `taken.add` (its
  own comment says the mutation takes three colliding findings to reach). Enforcement review
  deleted `taken.add` under EP2: `[X, X, X#1]` stays `X, X#2, X#1`, and only `[X, X, X, X#1]` goes
  red (`X, X#2, X#2, X#1`). So the reservation holds within one file under EP2, but the build must
  move that fixture into one file with three colliding findings, or the guard goes vacuous;
- two `baseline-compat.test.ts` rows: `it('stays green when its entries match, despite the older format')`
  depends on the no-root decision, and `it('an explicit root still overrides the recorded one')` is
  the `options.root` path, which was measured only under EP and EP2.

The two `deferred-warning` tests that EP broke pass under EP2.

Enforcement review then compared EP2 against `main` directly: 128 `accepted` cases and 5,832
baseline cases, including baselines written by `main` and read by EP2 and findings that already end
in `#n`. EP2 was green where `main` was red in none of them. Two further metric probes, run
separately and built by hand with an identity that carries no file, did differ: entries `a:10` and
`b:3`, then `a` rises to 9; and an entry `a:3` plus a `b` entry with no measurement, then `b` rises
to 9. In both, `main` reports a finding against another file's ceiling, and EP2 forgives it against
its own: more correct, not looser. Real
metric identities carry the path.

## What this answers

1. **Grouping: per file, as EP2.** E0 is never more lenient than `main`, but false-reds both edit rows
   (R3, R4). EP2 is exact on both (Results) and keeps the collision guard that protects `accepted`
   lists, as long as those lists hold entries with no file (see Decision). Within each group `main` forgives at most `min(new, old)` findings by position, and
   per-file matching forgives the sum over files of `min(new_f, old_f)`, which is never more
   findings. Per-file ceilings can forgive a metric that `main` reported against another file's
   ceiling (Review). The argument does not carry over to `accepted`, which has no counts and no
   files, which is why C13 stayed blind to files.
2. **Every consumer keyed by hash alone:** the census, with C8a and C12a added and C13 moved. Measured
   re-keyed: C3, C5, C7, C10, C12, C12a. Reasoned, not measured: C4, C6, C8a. C14 still reports a
   subject in its old form under EP2 (enforcement review), and now sees fewer collisions, because
   collisions across files no longer occur.
3. **A baseline with no recorded root:** `off` keeps bug 0388 open for those baselines, `none`
   reports even unchanged code, and `rediscover` is exact when the root agrees and, when it does
   not, can both false-red and forgive (Review). Not measured: a v1 file, and `options.root` under
   E0.
4. **The diagnosis (designed, partly measured):** a finding matched by hash in another file gets its
   own attribution. The prototype is right on the three plain cases and, by review's probes, wrong
   on two of five harder ones; the build must read the pre-filter findings, state one cause per
   finding, and say when a file was not examined. Its "copied" branch exists only under per-file
   grouping.
5. **Identity-bearing and metric findings that move file are reported again** (R12), like plain ones.

Three more things the Phase 2 build must carry:

- **An `accepted` list keeps bug 0388's hole** (R14), under every variant. New lists can close it with a
  file-qualified advice form. A raw entry with no file cannot be checked against a file at all.
- **The `ArchViolation.identity` contract changes.** It says an identity is "unique per finding
  within a rule" (`packages/core/src/violation.ts:79-80`). Under EP2 it is unique per rule and file:
  `X#1` can appear in both `a.ts` and `b.ts`. Sibling dialects (C15) never add suffixes, so for them
  the per-rule form already implies the per-file one; the field can carry one meaning.
- **Per-file grouping moves the entries today's code suffixed across files**, so it ships with plan
  0346's Phase 3 migration. Without the migration EP2 fails closed (none greener in the 2,916 cases
  where `main` wrote the baseline, by review's count; the false reds on upgrade are reasoned from
  the moved entries), but those false reds arrive with
  R13's note telling the adopter to regenerate, which forgives without review. That contradicted
  plan 0346's split as written on 2026-10-06, which shipped the Phase 2 build before the
  migration; decision 3 supersedes it.

## Decision

Made 2026-10-06 by the coordinating agent, on the maintainer's instruction ("you are more capable
of making this decession based on all the work you have done"), and revised twice on 2026-10-07
after method, enforcement and product review. The maintainer can overrule any of them.

**What is not settled.** Decision 2 accepts a risk on adopters' behalf: a rootless eess-ts baseline
turns all-red on upgrade. Accepting that risk is the maintainer's call. Until the maintainer accepts
or overrules it, the Phase 2 build plan cannot be made Ready; plan 0346's ledger and the ROADMAP
carry this as a blocker.

1. **Grouping: EP2.** Per-file grouping (C12), the suffix reservation (C12a) per file, and every
   census item except C13 keyed by `(hash, file)`. **How the collision guard (C13) is keyed is not
   decided here**; it depends on decision 4. EP2 is the only variant that is exact on both edit
   rows. In review's comparisons it never forgave a finding `main` reported, except in two
   hand-built metric shapes, where it was the more correct of the two. If spike 0395 finds no C13
   keying that is both no greener than `main` and free of false causes under EP2, this decision
   goes back to the maintainer.
2. **An eess-ts baseline with no recorded root matches nothing.**
   - **The finding.** The run reports one finding per baseline, not one per entry. It is an
     `error`, it cannot be suppressed, and filters do not drop it: no regenerate records it, and
     neither `.excluding()` nor `--changed` drops it (ADR-016: one finding per instrument
     failure). It names the baseline and says to run `--migrate`.
   - **Why `none`.** `off` keeps bug 0388 open. `rediscover` can false-red and, like `main`,
     forgive (Review). `none` cannot forgive.
   - **Scope: eess-ts's baseline format only.** The kernel's baseline (C9) records no root, and its
     file check does not need one, because it will compare `file` relative to the baseline's own
     directory. (Today the loader reads only `hash` and `measured`.) **The kernel's hash does use a
     root:** `withBaseline` and `generateBaseline` each look it up again
     (`packages/core/src/baseline.ts:150`, `:201`). That is `rediscover`.
     - **Reasoned, not measured: a shape this could forgive.** The root is `r` at write, and
       `r/pkg` later gets its own `.git`. A new finding then scrubs `r/pkg/src/a/x.ts` to the
       token that `r/src/a/x.ts` had, in the same baseline-relative file. Nothing in the record
       makes this greener than `main`, which ignores the file entirely, so it is a residual.
     - **The build measures it first.** If it forgives, the kernel baseline also records its root
       and gets decision 2, and the break table below changes.
   - **A kernel-written file read by eess-ts.** It records no root, so decision 2 applies. The
     subdirectory false red that review measured came from this reader, and decision 2 replaces it
     with one finding.
     - **What `--migrate` must do with it.** Its paths are relative to the baseline's directory,
       not to a root, so `--migrate` rebases them from there. If eess-ts and kernel hashes do not
       agree, no one is on this path; the migration record measures that first and drops the case
       if so.
   - **The remedy has to remediate.** `--migrate` on a rootless file has to assume a root.
     - It must print the root it assumed.
     - It must report, not forgive, every entry whose recorded file does not resolve under that
       root. Otherwise it writes `rediscover`'s failure into the file for good.
     - The migration's PR owns the test.
   - **A rootless file read with an explicit `options.root`.** The build plan decides this, from a
     measurement. Until then, decision 2 applies.
     - `baseline-compat.test.ts` · `it('an explicit root still overrides the recorded one')` fails
       under EP2. That failure is fail-closed and correct.
     - Its first assertion assumes a path-free identity "matches either way". The build rewrites
       that assertion to the rule it adopts, and must not weaken the assertion to make it pass.
3. **The split: separate PRs on an integration branch, `release/0346-phase2`.**
   - The Phase 2 build and Phases 1 and 3 stay separate records and pull requests, each
     reviewable in one sitting. Both target the branch, and the Phase 2 build merges first.
   - The branch merges to `main` once, as one reviewed PR carrying both changesets. The
     coordinating agent rebases it onto `main` while it lives. `ci.yml` filters `pull_request` by
     no branch, so PRs into it run the full gate chain.
   - No state of `main` holds one without the other, so no release cut from `main` can split them.
     `publish.yml` publishes any `v*` tag from any branch, so no tag is cut from the integration
     branch. `main` stays releasable for unrelated fixes meanwhile.
   - Between the two merges, the branch's no-root finding and R13's note name a `--migrate` that
     the second PR adds. The Phase 2 build's ledger records that as `deferred→` the migration
     record, not as done.
   - This replaces the first version of this decision, which held `main`'s release by hand. Nothing
     gated that hold, and a hotfix released in the window would have shipped Phase 2 without
     `--migrate`.
   - Stacked PRs: retarget the child before deleting a branch.
4. **Raw `accepted` entries with no file: reopened, moved to
   [spike 0395](./0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md).**
   - **What the first version decided:** such entries stop matching.
   - **Why it is reopened.** That premise is the one decision 1 kept C13 file-blind for. With no
     file-less entry left matching, the C13 pin named in the first version (the swap test) builds
     its list from file-less subjects, so it stays green with C13 deleted. A file-blind C13 would
     also escalate `a::X` and `b::X` with advice about positional suffixes, which no longer exist
     under EP2: a false cause (ADR-009 rule 2).
   - **The advice was unsafe as well.** It printed a "file-qualified replacement" built from where
     the subject matches now. On the 0388 shape, that accepts `b` without review, which is the
     remedy R13 is rejected for.
   - **What spike 0395 measures:** under EP2, in both C13 keyings, file-qualified lists, with and
     without decision 4, on EP's Critical shapes. It also settles one spelling for a
     file-qualified entry, aligned with bug 0389's `<root:NAME>/path` portable form.

**One behaviour for the 0388 case.** A finding whose hash an entry holds for another file is not a
match: the file check says so, and the "matched nothing" count (C6) does not count it. The
diagnosis still sees the hash hit. It reports the attribution note, which names both files, and
does not report the "matched nothing" note, whose first cause is an upgrade and whose remedy is to
regenerate. This is the requirement enforcement review first wrote: the diagnosis must not count
such a finding as unmatched. The C6 and R13 rows below pin it from both sides.

Each Phase 2 mechanism ships with a test that goes red when it is broken. Harness rows named here
are ported into the eess-ts suite. A sabotage run shows each row red with its mechanism reverted;
CI shows only that they pass. Census items C2, C8 and C11 have no row of their own: C2 (`hasEntry`)
is read only through C5 and C6, C8 (loading) through every row, and C11 (kernel
`generateBaseline`) through R1's kernel half and R7.

| mechanism                             | the test that must go red                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the file check (C1, C9)               | R1's six cross-file cases, in both baselines                                                                                                                                                                                                                                                    |
| the per-file reservation (C12a)       | `it('a generated suffix never lands on a subject a producer already emits')`, rewritten to three colliding findings in one file; `taken.add` deleted                                                                                                                                            |
| per-file grouping (C12)               | R3 and R4: `b` stays forgiven when `a` is fixed, and only the new finding is reported                                                                                                                                                                                                           |
| per-file ceilings (C3, C10)           | R5's shape, with the map reverted to hash keys                                                                                                                                                                                                                                                  |
| the stale-measurement diagnosis (C4)  | `a`'s own change of unit is reported stale, and `b`, which shares its hash, is not                                                                                                                                                                                                              |
| the description-change diagnosis (C5) | the same subject in two files, one renamed: only that one is diagnosed                                                                                                                                                                                                                          |
| the "matched nothing" note (C6)       | R13's shape: that note does not fire; with every entry stale and no hash hit anywhere, it does                                                                                                                                                                                                  |
| the regenerate summary (C7)           | R7: `+1`, not `+0`                                                                                                                                                                                                                                                                              |
| `Baseline.size` (C8a)                 | two entries sharing a hash count as two                                                                                                                                                                                                                                                         |
| C14's subject                         | a same-file collision is reported with the subject it is grouped on                                                                                                                                                                                                                             |
| the no-root rule                      | a rootless baseline, unchanged code: no entry matches, and exactly one `error` names `--migrate`; it survives `.excluding()` and `--changed`, `generateBaseline` does not record it, and two rootless baselines give two                                                                        |
| the note on the 0388 case             | R13's shape: a note is present, names the recorded file and the current one, and neither lists "you upgraded" nor advises regenerating                                                                                                                                                          |
| the attribution                       | on the three plain shapes an attribution is present; review's two false-cause shapes now give the true cause; each finding gets exactly one cause; under `--changed` a file that was not examined is called that, not "fixed"; each attribution's remedy, applied, clears the finding (ADR-009) |
| C13, once spike 0395 decides          | named by spike 0395                                                                                                                                                                                                                                                                             |

The build also rewrites three docstrings that EP2 makes false:

- **`hasIdentityCollision`** (`packages/ts/src/core/terminal-builder.ts:92`). It says the guard uses
  the grouping key `disambiguateIdentities()` groups on. Its new text waits for spike 0395.
- **`disambiguateIdentities`'s "theorem"** that no existing baseline entry moves
  (`packages/core/src/violation.ts:280-284`). Under EP2, entries that today's code suffixed across
  files move.
- **The `identity` contract** (`packages/core/src/violation.ts:79-80`) becomes unique per rule and
  file.

**Separators.** The kernel writes `file` with `path.relative`, which gives `\` on Windows. The build
normalises `file` to `/` on write and on read. That is not a format change: files written on POSIX
already use `/`, and a file written on Windows then matches on any machine. The cwd dependence is
measured by the build.

**What breaks, and in which package.** On `0.x` a break is a `minor`, marked `**Breaking**`. A
break in a package others depend on names those packages (bugs 0184, 0185). The changesets' text
is not frozen until spike 0395 rules.

| package               | breaks                                                                                                                                                                                                                                                         | names                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nielspeter/eess`    | the kernel baseline stops forgiving a finding in another file; `disambiguateIdentities` groups per file; `identity` may repeat across files for one rule, which a reader keying on `rule + identity` sees; `Baseline.size` counts entries, not distinct hashes | `eess-ts`, `eess-mermaid`, `eess-md`, `eess-gherkin` and `eess-crossvalidate`, each with "unchanged unless you pass a baseline to `check`, or use the kernel's `withBaseline` directly" |
| `@nielspeter/eess-ts` | cross-file forgiveness stops; entries suffixed across files move (`--migrate` carries them); a rootless baseline matches nothing; `Baseline.size` as above; and whatever spike 0395 decides for `accepted`                                                     | —                                                                                                                                                                                       |

With the release train's other breaking changesets, the release reaches `RELEASING.md`'s threshold
of three breaking changesets. It therefore carries a migration page covering `--migrate`, rootless
baselines and `accepted`, which belongs to the migration's record. If spike 0395 keeps file-less
entries from matching, the page also needs a recipe for editing rule source, since `accepted`
lives there and `--migrate` cannot reach it. The README's `asSeverity('warn', { accepted })`
section documents the spelling 0395 settles.

Not measured: sibling dialects beyond the kernel matcher (they never disambiguate, plan 0188), a real
`git worktree`, Windows paths, and the kernel baseline's cwd dependence and root rediscovery (both
owed by the build, above). Time box: one working day, kept (2026-10-06); the review revisions on
2026-10-07 added no measurement.

## Appendix A: the variant patch

Applied to `main` at `b1335f5` in the spike worktree; includes EP2.

```diff
diff --git a/packages/core/src/baseline.ts b/packages/core/src/baseline.ts
index 7a8811c..d49887a 100644
--- a/packages/core/src/baseline.ts
+++ b/packages/core/src/baseline.ts
@@ -168,9 +168,22 @@ export function withBaseline(baselinePath: string): Baseline {
   const violations: unknown[] = parsed.violations
   const hashes = new Set<string>()
   const accepted = new Map<string, AcceptedMeasurement>()
+  const files = new Map<string, Set<string>>()
+  const acceptedByPair = new Map<string, AcceptedMeasurement>()
   for (const entry of violations) {
     if (entry && typeof entry === 'object' && 'hash' in entry && typeof entry.hash === 'string') {
       hashes.add(entry.hash)
+      // SPIKE 0394
+      if ('file' in entry && typeof entry.file === 'string') {
+        const set = files.get(entry.hash) ?? new Set<string>()
+        set.add(entry.file)
+        files.set(entry.hash, set)
+        if ('measured' in entry && typeof entry.measured === 'number')
+          acceptedByPair.set(entry.hash + '\u0000' + entry.file, {
+            value: entry.measured,
+            unit: 'measuredUnit' in entry && typeof entry.measuredUnit === 'string' ? entry.measuredUnit : undefined,
+          })
+      }
       if ('measured' in entry && typeof entry.measured === 'number') {
         accepted.set(entry.hash, {
           value: entry.measured,
@@ -183,7 +196,7 @@ export function withBaseline(baselinePath: string): Baseline {
     }
   }

-  return new Baseline(hashes, baselineDir, root, accepted)
+  return new Baseline(hashes, baselineDir, root, accepted, files, acceptedByPair)
 }

 /**
@@ -240,8 +253,19 @@ export class Baseline {
     private readonly root?: string,
     /** hash -> accepted measurement, for metric findings. */
     private readonly accepted: Map<string, AcceptedMeasurement> = new Map(),
+    private readonly spikeFiles?: Map<string, Set<string>>,
+    private readonly spikeAcceptedByPair?: Map<string, AcceptedMeasurement>,
   ) {}

+  /** SPIKE 0394 */
+  private fileOk(v: ArchViolation, hash: string): boolean {
+    const variant = process.env.SPIKE_VARIANT ?? 'main'
+    if (variant === 'main' || this.spikeFiles === undefined) return true
+    const recorded = this.spikeFiles.get(hash)
+    if (recorded === undefined) return false
+    return recorded.has(toRelativePath(v.file, this.baselineDir))
+  }
+
   /**
    * Check if a violation is known (exists in the baseline).
    * Known violations are filtered out — they don't cause failures.
@@ -258,8 +282,12 @@ export class Baseline {
    */
   isKnown(violation: ArchViolation): boolean {
     const hash = hashViolation(violation, this.root)
+    if (!this.fileOk(violation, hash)) return false
     if (violation.measured === undefined) return this.knownHashes.has(hash)
-    const acceptedMeasurement = this.accepted.get(hash)
+    const acceptedMeasurement =
+      (process.env.SPIKE_VARIANT === 'EP' || process.env.SPIKE_VARIANT === 'EP2') && this.spikeAcceptedByPair !== undefined
+        ? this.spikeAcceptedByPair.get(hash + '\u0000' + toRelativePath(violation.file, this.baselineDir))
+        : this.accepted.get(hash)
     if (acceptedMeasurement === undefined) return false
     // Bug 0171: `<=` means nothing until both numbers count the same thing.
     if (!measurementComparable(acceptedMeasurement.unit, violation.measuredUnit)) return false
diff --git a/packages/core/src/violation.ts b/packages/core/src/violation.ts
index 4d46ede..074415c 100644
--- a/packages/core/src/violation.ts
+++ b/packages/core/src/violation.ts
@@ -260,6 +260,8 @@ export function portableSubjectOf(violation: ArchViolation, root?: string): stri
  * subject across their two rule strings would have moved a published entry.
  */
 function groupKeyOf(violation: ArchViolation): string {
+  // SPIKE 0394
+  if (process.env.SPIKE_VARIANT === 'EP' || process.env.SPIKE_VARIANT === 'EP2') return `${violation.rule}::${violation.file}::${subjectOf(violation)}`
   return `${violation.rule}::${subjectOf(violation)}`
 }

@@ -417,11 +419,13 @@ export function disambiguateIdentities(violations: ArchViolation[]): ArchViolati
     const subject = subjectOf(violation)
     let suffix = occurrence - 1
     let candidate = `${subject}#${String(suffix)}`
-    while (taken.has(`${violation.rule}::${candidate}`)) {
+    // SPIKE 0394 (EP2): the reservation is keyed like the group key
+    const reserve = (c: string): string => process.env.SPIKE_VARIANT === 'EP2' ? `${violation.rule}::${violation.file}::${c}` : `${violation.rule}::${c}`
+    while (taken.has(reserve(candidate))) {
       suffix += 1
       candidate = `${subject}#${String(suffix)}`
     }
-    taken.add(`${violation.rule}::${candidate}`)
+    taken.add(reserve(candidate))
     return { ...violation, identity: candidate }
   })
 }
diff --git a/packages/ts/src/core/terminal-builder.ts b/packages/ts/src/core/terminal-builder.ts
index fbed92a..b66acbc 100644
--- a/packages/ts/src/core/terminal-builder.ts
+++ b/packages/ts/src/core/terminal-builder.ts
@@ -94,7 +94,7 @@ export type { CollectResult }
 function hasIdentityCollision(violations: readonly ArchViolation[]): boolean {
   const seen = new Set<string>()
   for (const v of violations) {
-    const key = `${v.rule}::${subjectOf(v)}`
+    const key = process.env.SPIKE_VARIANT === 'EP' ? `${v.rule}::${v.file}::${subjectOf(v)}` : `${v.rule}::${subjectOf(v)}`
     if (seen.has(key)) return true
     seen.add(key)
   }
diff --git a/packages/ts/src/helpers/baseline-diagnostics.ts b/packages/ts/src/helpers/baseline-diagnostics.ts
index 1149b72..4fbf834 100644
--- a/packages/ts/src/helpers/baseline-diagnostics.ts
+++ b/packages/ts/src/helpers/baseline-diagnostics.ts
@@ -21,6 +21,8 @@ export interface BaselineFacts {
   readonly hashVersion: number
   isKnown(violation: ArchViolation): boolean
   hasEntry(violation: ArchViolation): boolean
+  /** SPIKE 0394 */
+  spikeSubjectByFile?(violation: ArchViolation, subjectHash: string): string | undefined
 }

 /**
@@ -60,7 +62,11 @@ function renamedRuleFor(ctx: BaselineFacts, violation: ArchViolation): string |
   // this the ratchet's own working case reported "1 rule whose description
   // changed", which is a false cause under ADR-009 rule 2.
   if (ctx.hasEntry(violation)) return undefined
-  return ctx.knownSubjects.get(hashSubject(violation, ctx.root))
+  const subjectHash = hashSubject(violation, ctx.root)
+  // SPIKE 0394: the description changed only if this finding's own file recorded the subject.
+  if (process.env.SPIKE_VARIANT !== undefined && process.env.SPIKE_VARIANT !== 'main')
+    return ctx.spikeSubjectByFile?.(violation, subjectHash)
+  return ctx.knownSubjects.get(subjectHash)
 }

 export function descriptionChangeFinding(
diff --git a/packages/ts/src/helpers/baseline.ts b/packages/ts/src/helpers/baseline.ts
index ca35e2d..36a63c5 100644
--- a/packages/ts/src/helpers/baseline.ts
+++ b/packages/ts/src/helpers/baseline.ts
@@ -343,6 +343,13 @@ export function withBaseline(baselinePath: string, options: BaselineOptions = {}
       : undefined
   const effectiveRoot = options.root !== undefined ? root : (recordedRoot ?? root)
   const hashes = new Set<string>()
+  // SPIKE 0394
+  const spike: SpikeIndex = {
+    files: new Map(),
+    subjectsByFile: new Map(),
+    acceptedByPair: new Map(),
+    rootRecorded: recordedRoot !== undefined || options.root !== undefined,
+  }
   // subject hash -> the rule description recorded for it. Only what the
   // description-change diagnosis needs, so a large baseline does not carry a
   // second copy of every entry. Entries written before 0.24.0 have no subject
@@ -357,7 +364,21 @@ export function withBaseline(baselinePath: string, options: BaselineOptions = {}
   const rawEntries: readonly unknown[] = parsed.violations
   for (const entry of rawEntries) {
     if (entry === null || typeof entry !== 'object') continue
-    if ('hash' in entry && typeof entry.hash === 'string') hashes.add(entry.hash)
+    if ('hash' in entry && typeof entry.hash === 'string') {
+      hashes.add(entry.hash)
+      if ('file' in entry && typeof entry.file === 'string') {
+        const set = spike.files.get(entry.hash) ?? new Set<string>()
+        set.add(entry.file)
+        spike.files.set(entry.hash, set)
+        if ('subject' in entry && typeof entry.subject === 'string' && 'rule' in entry && typeof entry.rule === 'string')
+          spike.subjectsByFile.set(entry.subject + '\u0000' + entry.file, entry.rule)
+        if ('measured' in entry && typeof entry.measured === 'number')
+          spike.acceptedByPair.set(entry.hash + '\u0000' + entry.file, {
+            value: entry.measured,
+            unit: 'measuredUnit' in entry && typeof entry.measuredUnit === 'string' ? entry.measuredUnit : undefined,
+          })
+      }
+    }
     if (
       'subject' in entry &&
       typeof entry.subject === 'string' &&
@@ -388,9 +409,19 @@ export function withBaseline(baselinePath: string, options: BaselineOptions = {}
     }
   }

-  return new Baseline(hashes, effectiveRoot, hashVersion, resolved, subjects, accepted)
+  return new Baseline(hashes, effectiveRoot, hashVersion, resolved, subjects, accepted, spike)
 }

+// SPIKE 0394
+export interface SpikeIndex {
+  files: Map<string, Set<string>>
+  subjectsByFile: Map<string, string>
+  acceptedByPair: Map<string, AcceptedMeasurement>
+  rootRecorded: boolean
+}
+export const spikeVariant = (): string => process.env.SPIKE_VARIANT ?? 'main'
+
+
 /**
  * Generate a baseline file from a list of violations.
  *
@@ -446,7 +477,9 @@ export function generateBaseline(
   fs.mkdirSync(path.dirname(resolved), { recursive: true })
   fs.writeFileSync(resolved, JSON.stringify(baseline, null, 2) + '\n')

-  const written = new Set(entries.map((e) => e.hash))
+  const keyOf = (e: { hash: string; file: string }): string =>
+    spikeVariant() === 'main' ? e.hash : e.hash + '\u0000' + e.file
+  const written = new Set(entries.map((e) => keyOf(e)))
   return {
     before: prior?.count,
     after: entries.length,
@@ -516,7 +549,12 @@ function readPriorHashes(resolved: string):
   const hashes = new Set<string>()
   for (const entry of rawEntries) {
     if (entry === null || typeof entry !== 'object') continue
-    if ('hash' in entry && typeof entry.hash === 'string') hashes.add(entry.hash)
+    if ('hash' in entry && typeof entry.hash === 'string')
+      hashes.add(
+        spikeVariant() !== 'main' && 'file' in entry && typeof entry.file === 'string'
+          ? entry.hash + '\u0000' + entry.file
+          : entry.hash,
+      )
   }
   // `count` is the entry count, not `hashes.size`: two entries can share a hash
   // (bug 0028, measured at 17% in this repo), and reporting the deduplicated
@@ -633,8 +671,27 @@ export class Baseline {
      * shipped, where equality of identity remains the right test.
      */
     private readonly acceptedMeasurements: ReadonlyMap<string, AcceptedMeasurement> = new Map(),
+    private readonly spike?: SpikeIndex,
   ) {}

+  /** SPIKE 0394: the finding's file as recorded, root-relative. */
+  private spikeFile(v: ArchViolation): string {
+    return toPortablePath(v.file, this.root)
+  }
+
+  /** SPIKE 0394: does an entry for this hash record this finding's file? */
+  private fileOk(v: ArchViolation, hash: string): boolean {
+    if (spikeVariant() === 'main' || this.spike === undefined) return true
+    if (!this.spike.rootRecorded) {
+      const mode = process.env.SPIKE_NOROOT ?? 'rediscover'
+      if (mode === 'off') return true
+      if (mode === 'none') return false
+    }
+    const recorded = this.spike.files.get(hash)
+    if (recorded === undefined) return false
+    return recorded.has(this.spikeFile(v))
+  }
+
   /**
    * Check if a violation is known (exists in the baseline).
    * Known violations are filtered out — they don't cause failures.
@@ -647,7 +704,8 @@ export class Baseline {
    * entry and is not known.
    */
   hasEntry(violation: ArchViolation): boolean {
-    return this.knownHashes.has(hashViolation(violation, this.root))
+    const hash = hashViolation(violation, this.root)
+    return this.knownHashes.has(hash) && this.fileOk(violation, hash)
   }

   /**
@@ -661,6 +719,7 @@ export class Baseline {
   isKnown(violation: ArchViolation): boolean {
     const hash = hashViolation(violation, this.root)
     if (!this.knownHashes.has(hash)) return false
+    if (!this.fileOk(violation, hash)) return false

     // Bug 0012: a metric finding is known only while it is **no worse** than
     // what was accepted. Identity answers "is this the same finding?"; a metric
@@ -672,7 +731,10 @@ export class Baseline {
     // so it stays accepted until the baseline is regenerated. Treating a
     // missing value as 0 would fail every metric finding in an older baseline
     // and call it a regression.
-    const accepted = this.acceptedMeasurements.get(hash)
+    const accepted =
+      (spikeVariant() === 'EP' || spikeVariant() === 'EP2') && this.spike !== undefined
+        ? this.spike.acceptedByPair.get(hash + '\u0000' + this.spikeFile(violation))
+        : this.acceptedMeasurements.get(hash)
     if (violation.measured === undefined || accepted === undefined) return true

     // Bug 0171: the entry's number and this run's number must count the same
@@ -702,6 +764,10 @@ export class Baseline {
       hashVersion: this.hashVersion,
       isKnown: (violation) => this.isKnown(violation),
       hasEntry: (violation) => this.hasEntry(violation),
+      spikeSubjectByFile: (violation, subjectHash) =>
+        spikeVariant() === 'main' || this.spike === undefined
+          ? undefined
+          : this.spike.subjectsByFile.get(subjectHash + '\u0000' + this.spikeFile(violation)),
     }
   }

```

## Appendix B: the harness

Run from `packages/ts` of the patched worktree, with `SPIKE_VARIANT` and `PROBE_OUT` set.

```ts
// Spike 0394 harness. Run with SPIKE_VARIANT=main|E0|EP|EP2 (and SPIKE_NOROOT for the no-root rows).
import { describe, it, expect, afterAll } from 'vitest'
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { modules, classes, functions } from '../../src/index.js'
import { generateBaseline, withBaseline } from '../../src/helpers/baseline.js'
import { generateBaseline as kernelGenerate, withBaseline as kernelWith } from '@nielspeter/eess'
import { subjectOf } from '@nielspeter/eess/internal'
import { notHaveDefaultExport } from '../../src/conditions/exports.js'
import { moduleContain } from '../../src/conditions/body-analysis-module.js'
import { beImported, onlyBeImportedVia } from '../../src/conditions/reverse-dependency.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchViolation } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'

const OUT = process.env.PROBE_OUT ?? '/dev/null'
const V = process.env.SPIKE_VARIANT ?? 'main'
const log = (row: string, value: unknown) =>
  appendFileSync(OUT, `${V}\t${row}\t${JSON.stringify(value)}\n`)
const dirs: string[] = []
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))
function repo(): string {
  const r = mkdtempSync(path.join(tmpdir(), 's0394-'))
  dirs.push(r)
  mkdirSync(path.join(r, '.git'))
  writeFileSync(path.join(r, 'package.json'), '{"name":"acme"}')
  return r
}
function project(r: string, files: Record<string, string>): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const [f, t] of Object.entries(files)) tsm.createSourceFile(path.join(r, f), t)
  return {
    tsConfigPath: path.join(r, 'tsconfig.json'),
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}
const rel = (r: string, vs: readonly ArchViolation[]) =>
  vs.filter((v) => v.file !== '').map((v) => path.relative(r, v.file))
const meta = (vs: readonly ArchViolation[]) =>
  vs.filter((v) => v.file === '').map((v) => v.message.slice(0, 50))
function roundTrip(
  r: string,
  before: readonly ArchViolation[],
  after: readonly ArchViolation[],
  tweak?: (j: any) => void,
) {
  const f = path.join(r, 'baseline.json')
  generateBaseline([...before], f)
  if (tweak) {
    const j = JSON.parse(readFileSync(f, 'utf8'))
    tweak(j)
    writeFileSync(f, JSON.stringify(j))
  }
  return withBaseline(f).filterNew([...after])
}

type Rule = (p: ArchProject) => readonly ArchViolation[]
const BAD = 'function handle() {}\n',
  OK = 'export function handle() {}\n'
const exported: Rule = (p) =>
  functions(p)
    .that()
    .resideInFolder('**/src/**')
    .should()
    .beExported()
    .rule({ id: 'r' })
    .violations()
const cases: [string, Rule, Record<string, string>, Record<string, string>][] = [
  [
    'notHaveDefaultExport',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(notHaveDefaultExport())
        .rule({ id: 'r' })
        .violations(),
    { 'src/a/index.ts': 'export default 1\n', 'src/b/index.ts': 'export const b = 1\n' },
    { 'src/a/index.ts': 'export const a = 1\n', 'src/b/index.ts': 'export default 1\n' },
  ],
  [
    'moduleContain',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(moduleContain(call('init')))
        .rule({ id: 'r' })
        .violations(),
    { 'src/a/index.ts': 'export const a = 1\n', 'src/b/index.ts': 'init()\n' },
    { 'src/a/index.ts': 'init()\n', 'src/b/index.ts': 'export const b = 1\n' },
  ],
  [
    'beImported',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(beImported())
        .rule({ id: 'r' })
        .violations(),
    {
      'src/a/index.ts': 'export const a = 1\n',
      'src/b/index.ts': "import { c } from '../c'\nexport const b = c\n",
      'src/c.ts': "import { b } from './b/index'\nexport const c = typeof b\n",
    },
    {
      'src/a/index.ts': "import { c } from '../c'\nexport const a = c\n",
      'src/b/index.ts': 'export const b = 1\n',
      'src/c.ts': "import { a } from './a/index'\nexport const c = typeof a\n",
    },
  ],
  [
    'onlyBeImportedVia',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(onlyBeImportedVia('**/nowhere/**'))
        .rule({ id: 'r' })
        .violations(),
    {
      'src/a/index.ts': 'export const a = 1\n',
      'src/b/index.ts': 'export const b = 1\n',
      'src/c.ts': "import { a } from './a/index'\nexport const c = a\n",
    },
    {
      'src/a/index.ts': 'export const a = 1\n',
      'src/b/index.ts': 'export const b = 1\n',
      'src/c.ts': "import { b } from './b/index'\nexport const c = b\n",
    },
  ],
  [
    'classes extend',
    (p) =>
      classes(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .extend('Base')
        .rule({ id: 'r' })
        .violations(),
    {
      'src/base.ts': 'export class Base {}\n',
      'src/a/svc.ts': 'export class Svc {}\n',
      'src/b/svc.ts': "import { Base } from '../base'\nexport class Svc extends Base {}\n",
    },
    {
      'src/base.ts': 'export class Base {}\n',
      'src/a/svc.ts': "import { Base } from '../base'\nexport class Svc extends Base {}\n",
      'src/b/svc.ts': 'export class Svc {}\n',
    },
  ],
  [
    'functions beExported',
    exported,
    { 'src/a/x.ts': BAD, 'src/b/x.ts': OK },
    { 'src/a/x.ts': OK, 'src/b/x.ts': BAD },
  ],
]

// Hand-built findings for shapes no built-in producer reaches.
const finding = (r: string, file: string, extra: Partial<ArchViolation> = {}): ArchViolation => ({
  rule: 'm',
  element: 'Big',
  file: file === '' ? '' : path.join(r, file),
  line: 1,
  message: 'Big is too big',
  ...extra,
})

describe('spike 0394', () => {
  it('1 cross-file cases: b reported', () => {
    const got: Record<string, boolean> = {}
    for (const [name, rule, r1, r2] of cases) {
      const r = repo()
      const fresh = roundTrip(r, rule(project(r, r1)), rule(project(r, r2)))
      got[name] = rel(r, fresh).some((f) => f.includes('b/'))
    }
    log('1-cross-file-b-reported', got)
    expect(true).toBe(true)
  })
  it('2 unchanged code', () => {
    const r = repo()
    const p = project(r, { 'src/a/x.ts': BAD, 'src/b/x.ts': BAD })
    log('2-unchanged-new', rel(r, roundTrip(r, exported(p), exported(p))))
    expect(true).toBe(true)
  })
  it('3 edits to duplicates', () => {
    const r = repo()
    const base = { 'src/a/x.ts': BAD, 'src/b/x.ts': BAD }
    const fixA = roundTrip(
      r,
      exported(project(r, base)),
      exported(project(r, { 'src/a/x.ts': OK, 'src/b/x.ts': BAD })),
    )
    log('3a-fix-a-b-reviewed', { real: rel(r, fixA), meta: meta(fixA) })
    const r2 = repo()
    const ins = roundTrip(
      r2,
      exported(project(r2, base)),
      exported(project(r2, { 'src/0/x.ts': BAD, ...base })),
    )
    log('3b-insert-earlier-duplicate', { real: rel(r2, ins), meta: meta(ins) })
    expect(true).toBe(true)
  })
  it('4 metric ceiling, identity without the file', () => {
    const r = repo()
    const m = { identity: 'M::Big', measured: 3, measuredUnit: 'methods' }
    const before = [finding(r, 'src/a.ts', m), finding(r, 'src/b.ts', { ...m, measured: 10 })]
    const after = [
      finding(r, 'src/a.ts', { ...m, measured: 9 }),
      finding(r, 'src/b.ts', { ...m, measured: 10 }),
    ]
    log('4-a-worsened-3-to-9-reported', rel(r, roundTrip(r, before, after)))
    expect(true).toBe(true)
  })
  it('5 an empty-file finding against a baselined file finding', () => {
    const r = repo()
    log(
      '5-empty-file-reported',
      roundTrip(r, [finding(r, 'src/a.ts')], [finding(r, 'src/a.ts'), finding(r, '')]).filter(
        (v) => v.message === 'Big is too big',
      ).length,
    )
    expect(true).toBe(true)
  })
  it('6 regenerate summary, a stays and b duplicates it', () => {
    const r = repo()
    const f = path.join(r, 'baseline.json')
    generateBaseline([finding(r, 'src/a.ts')], f)
    const d = generateBaseline([finding(r, 'src/a.ts'), finding(r, 'src/b.ts')], f)
    log('6-regenerate-added', d.added)
    expect(true).toBe(true)
  })
  it('7 an entry with no recorded file', () => {
    const r = repo()
    const fresh = roundTrip(
      r,
      [finding(r, 'src/a.ts')],
      [finding(r, 'src/a.ts'), finding(r, 'src/b.ts')],
      (j) => j.violations.forEach((e: any) => delete e.file),
    )
    log('7-no-file-entry-reported', rel(r, fresh))
    expect(true).toBe(true)
  })
  it('8 a baseline with no recorded root', () => {
    const r = repo()
    const strip = (j: any) => delete j.root
    const added = roundTrip(
      r,
      [finding(r, 'src/a.ts')],
      [finding(r, 'src/a.ts'), finding(r, 'src/b.ts')],
      strip,
    )
    const same = roundTrip(r, [finding(r, 'src/a.ts')], [finding(r, 'src/a.ts')], strip)
    log(`8-no-root[${process.env.SPIKE_NOROOT ?? 'rediscover'}]`, {
      aStaysBAdded: rel(r, added),
      unchanged: rel(r, same),
    })
    expect(true).toBe(true)
  })
  it('9-11 renames', () => {
    const r = repo()
    const plain = roundTrip(r, [finding(r, 'src/a.ts')], [finding(r, 'src/z.ts')])
    const idBearing = roundTrip(
      r,
      [finding(r, 'src/a.ts', { identity: 'X' })],
      [finding(r, 'src/z.ts', { identity: 'X' })],
    )
    const m = { identity: 'M::Big', measured: 3, measuredUnit: 'methods' }
    const metric = roundTrip(r, [finding(r, 'src/a.ts', m)], [finding(r, 'src/z.ts', m)])
    log('9-11-rename-reported', {
      plain: rel(r, plain),
      identityBearing: rel(r, idBearing),
      metric: rel(r, metric),
    })
    expect(true).toBe(true)
  })
  it('12 the diagnosis on the 0388 case', () => {
    const r = repo()
    const fresh = roundTrip(
      r,
      exported(project(r, { 'src/a/x.ts': BAD, 'src/b/x.ts': OK })),
      exported(project(r, { 'src/a/x.ts': OK, 'src/b/x.ts': BAD })),
    )
    log('12-meta', meta(fresh))
    expect(true).toBe(true)
  })
  it('13 an accepted list, cross-file', () => {
    const r = repo()
    const accepted = exported(project(r, { 'src/a/x.ts': BAD, 'src/b/x.ts': OK })).map((v) =>
      subjectOf(v),
    )
    const sev = functions(project(r, { 'src/a/x.ts': OK, 'src/b/x.ts': BAD }))
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
      .rule({ id: 'r' })
      .asSeverity('warn', { accepted })
      .violations()
      .map((v) => v.severity)
    log('13-accepted-b-severity', sev)
    expect(true).toBe(true)
  })
  it('14 the kernel baseline, cross-file', () => {
    const r = repo()
    const f = path.join(r, 'k.json')
    kernelGenerate([finding(r, 'src/a.ts')], f)
    log('14-kernel-b-reported', rel(r, kernelWith(f).filterNew([finding(r, 'src/b.ts')])))
    expect(true).toBe(true)
  })
})
```

## Appendix C: the attribution prototype

```ts
// Spike 0394: a classifier for a finding whose hash an entry holds but for another file.
import { it } from 'vitest'
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { functions } from '../../src/index.js'
import { generateBaseline, hashViolation } from '../../src/helpers/baseline.js'
import type { ArchViolation } from '@nielspeter/eess'

type Entry = { hash: string; file: string }
/** For each finding not matched on (hash, file): which cause, decided from the entries, the run and the disk. */
function classify(
  root: string,
  entries: Entry[],
  findings: ArchViolation[],
): Record<string, string> {
  const out: Record<string, string> = {}
  const runKeys = new Set(
    findings.map((v) => hashViolation(v, root) + '\0' + path.relative(root, v.file)),
  )
  for (const v of findings) {
    const hash = hashViolation(v, root)
    const file = path.relative(root, v.file)
    if (entries.some((e) => e.hash === hash && e.file === file)) continue
    const elsewhere = entries.filter((e) => e.hash === hash && e.file !== file)
    if (elsewhere.length === 0) {
      out[file] = 'new'
      continue
    }
    const causes = elsewhere.map((e) =>
      runKeys.has(e.hash + '\0' + e.file)
        ? `copied (still in ${e.file})`
        : existsSync(path.join(root, e.file))
          ? `fixed in ${e.file}, made here`
          : `moved or renamed from ${e.file}`,
    )
    out[file] = causes.join('; ')
  }
  return out
}
function repoWith(files: Record<string, string>): string {
  const r = mkdtempSync(path.join(tmpdir(), 'a-'))
  mkdirSync(path.join(r, '.git'))
  writeFileSync(path.join(r, 'package.json'), '{"name":"acme"}')
  for (const [f, c] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(r, f)), { recursive: true })
    writeFileSync(path.join(r, f), c)
  }
  return r
}
const run = (r: string, files: Record<string, string>) => {
  const t = new Project({ useInMemoryFileSystem: true })
  for (const [f, c] of Object.entries(files)) t.createSourceFile(path.join(r, f), c)
  return [
    ...functions({
      tsConfigPath: path.join(r, 'tsconfig.json'),
      _project: t,
      getSourceFiles: () => t.getSourceFiles(),
    })
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
      .rule({ id: 'r' })
      .violations(),
  ]
}
const BAD = 'function handle() {}\n',
  OK = 'export function handle() {}\n'
it('classify', () => {
  const rows: [string, Record<string, string>, Record<string, string>][] = [
    [
      '0388: fixed in a, made in b',
      { 'src/a/x.ts': BAD, 'src/b/x.ts': OK },
      { 'src/a/x.ts': OK, 'src/b/x.ts': BAD },
    ],
    [
      'copied: a stays, b added',
      { 'src/a/x.ts': BAD, 'src/b/x.ts': OK },
      { 'src/a/x.ts': BAD, 'src/b/x.ts': BAD },
    ],
    ['renamed: a moved to z', { 'src/a/x.ts': BAD }, { 'src/z/x.ts': BAD }],
  ]
  for (const [name, before, after] of rows) {
    const r = repoWith(after)
    const f = path.join(r, 'b.json')
    generateBaseline(run(r, before), f)
    const entries: Entry[] = JSON.parse(readFileSync(f, 'utf8')).violations
    appendFileSync(
      process.env.PROBE_OUT!,
      `${name}\t${JSON.stringify(classify(r, entries, run(r, after)))}\n`,
    )
    rmSync(r, { recursive: true, force: true })
  }
})
```

## Appendix D: the note harness

The source of R13's note text, run under `SPIKE_VARIANT=E0` and `EP`.

```ts
import { it } from 'vitest'
import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { functions } from '../../src/index.js'
import { generateBaseline, withBaseline } from '../../src/helpers/baseline.js'
it('meta', () => {
  const r = mkdtempSync(path.join(tmpdir(), 'm-'))
  mkdirSync(path.join(r, '.git'))
  writeFileSync(path.join(r, 'package.json'), '{"name":"acme"}')
  const p = (files: Record<string, string>) => {
    const t = new Project({ useInMemoryFileSystem: true })
    for (const [f, c] of Object.entries(files)) t.createSourceFile(path.join(r, f), c)
    return {
      tsConfigPath: path.join(r, 'tsconfig.json'),
      _project: t,
      getSourceFiles: () => t.getSourceFiles(),
    }
  }
  const run = (files: Record<string, string>) =>
    functions(p(files))
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
      .rule({ id: 'r' })
      .violations()
  const f = path.join(r, 'b.json')
  generateBaseline(
    [
      ...run({
        'src/a/x.ts': 'function handle() {}\n',
        'src/b/x.ts': 'export function handle() {}\n',
      }),
    ],
    f,
  )
  const fresh = withBaseline(f).filterNew([
    ...run({
      'src/a/x.ts': 'export function handle() {}\n',
      'src/b/x.ts': 'function handle() {}\n',
    }),
  ])
  for (const v of fresh.filter((x) => x.file === ''))
    appendFileSync(
      process.env.PROBE_OUT!,
      `${process.env.SPIKE_VARIANT}: ${v.message.replace(/\n/g, ' / ').slice(0, 700)}\n\n`,
    )
})
```
