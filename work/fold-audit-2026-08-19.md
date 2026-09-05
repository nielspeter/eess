# Fold audit — did plan 0088 carry ts-archunit's bug fixes across?

**Measured:** 2026-08-19 · **Scope:** all 72 records in ts-archunit's
`bugs/fixed/` · **Method:** per-bug verification against eess's built `dist`,
**running a reproduction wherever one is possible**. Some verdicts are
necessarily code-reading — a gate's root list, an export's presence, a
documented divergence — and the manifest's note column says which.

> **This file IS link-checked, as of 2026-09-04.** It used to say the opposite,
> and the note is kept rather than deleted because the note is what got it fixed.
> It read: _"`scripts/check-corpus.mjs`'s `ROOTS` are `work/plans/**`,
> `work/proposals/**`, `work/bugs/**`, `adr/**`, `docs/**` — `work/*.md` matches
> none of them, so this record's links and `path:line` citations are unverified
> while `check:corpus` reports a confident green"_, and closed by saying that
> shorthand was _"another reason this file should join a checked root"_.
>
> `ROOTS` is now `work/**`
> ([bug 0249](./bugs/fixed/0249-most-of-work-is-outside-every-corpus-root.md)),
> so this document's links resolve or the build fails. `work/dogfood-coverage.md`
> and `work/research-external-signals-2026-07.md` came in with it. A record that
> declared its own blind spot instead of hiding it is the reason the blind spot
> was findable at all. **Citations below are package-relative
> where a file is named inside a package** (`smells/duplicate-bodies.ts:125`
> means `packages/ts/src/smells/duplicate-bodies.ts:125`); that shorthand is
> another reason this file should join a checked root.

## Why this was run

eess forked ts-archunit's engine at ~v0.17 and froze. [Plan
0088](./plans/completed/0088-fold-ts-archunit-into-eess.md) folded the engine
back in, closing a drift its own Problem section measured at "10,342 diff-lines
across 118 shared files, plus 37 modules never received."

The fold reconciled **per file** — its Phase 1 is "a per-file classification of
ts-archunit's `src/` vs eess kernel + eess-ts, three buckets" — rather than
copying wholesale. A reconcile keeps eess's existing file wherever the two look
equivalent, and "looks equivalent" is exactly how a **deleted line** or a
**reordering** hides. It never enumerated upstream's fixed-bug corpus to check
which fixes came across.

That gap surfaced by accident: [plan
0150](./plans/0150-close-0088s-disclosed-review-findings.md)'s Phase 4 built
`orphanExclusions()` — the first consumer that reads the exclusion parser's
output — and it returned 14 findings, all false, because eess's parser is the
pre-fix shape for upstream's bug 0043. One sample, one hit. This audit asked
whether that was a one-off.

## Was a wholesale copy ever available? — measured, no

Tested on a throwaway branch: copying all 156 of ts-archunit's `src/` files
into `packages/ts` **typechecks clean** (zero errors in `src/`; 62 errors, all
in 15 eess test files encoding eess-only features — ADR-008's `report` option,
`--fix`, `havePathMatching`).

But it drops shared-kernel imports from **83 → 6** and duplicates 57 core files
into the dialect, re-forking the kernel that [plan
0051](./plans/completed/0051-consolidation-eess-monorepo.md) consolidated.

For `packages/core` a copy is not merely unwise but impossible:

|                                   |                                                 |
| --------------------------------- | ----------------------------------------------- |
| ts-archunit `src/core` files      | 57                                              |
| directly importing ts-morph       | 13                                              |
| **transitively ts-morph-tainted** | **37**                                          |
| transitively clean                | 20 — of which 18 are already in `packages/core` |

eess's kernel imports ts-morph in **zero** files and is gated on it
(`eess/kernel-no-engine-deps`). Upstream's `violation.ts`,
`project-relative.ts` and `exclusion-comments.ts` all import it; eess's
counterparts do not. The kernel was deliberately re-architected.

**Narrowed after review (PR #70).** What this measures is the cost of a
_verbatim file copy_, over upstream's own module graph. A fix is a diff, not a
file — and `packages/core` itself records doing exactly what the taint number
calls impossible: splitting a pure part out of a ts-morph-blocked file
(`packages/core/src/project-relative.ts:6-9`, `packages/core/src/path-universe.ts:6`,
`glob-site.ts:9` all say so
in their own docstrings). So:

- **verbatim file copy** into the kernel: genuinely unavailable;
- **fix-by-fix port** (enumerate upstream's fixes, replay each): always
  available, and is what the "lesson worth keeping" section below recommends.

The earlier wording — "the reconcile was **forced**, not chosen carelessly" —
overstated this into "we could not have carried the fixes." Reconcile at _file_
granularity was forced. Reconcile _as practiced_ (compare files, keep eess's
where equivalent) was one implementation of it, not the only one.

**The failure is therefore narrow and specific:** having chosen reconcile — the
one mode where upstream fixes vanish silently — the fold owed a bug-corpus
check, and never ran one. Plan 0088 did not simply forget: it explicitly routed
the corpus to plan 0090 (`0088:479`, "The corpus migration … is 0090"). So the
honest diagnosis is two-part — 0088 deferred, and **0090 mis-typed what it was
deferred to**. See "Plan 0090's premise is refuted by this record" below.

## Results

Counted from the per-bug manifest at the end of this record, which carries one
row per upstream id. The totals below are **derived from it** — if they
disagree with the manifest, the manifest is right.

> **72 files, 71 distinct numbers.** Upstream's `bugs/fixed/` contains two
> records numbered `0007` — `0007-not-matcher-haveReturnTypeMatching.md` and
> `0007-rules-dependencies-pure-aliases.md`. **Both were audited**; the
> manifest lists them as `0007a` and `0007b`. "All 72 records" means files,
> not distinct ids.

| verdict                        | sample (11) | sweep (61) |  total |
| ------------------------------ | ----------: | ---------: | -----: |
| PRESENT                        |           6 |         37 |     43 |
| PARTIAL                        |           0 |         15 |     15 |
| MISSING                        |           5 |          6 |     11 |
| N/A (feature absent from eess) |           0 |          3 |      3 |
| **total**                      |      **11** |     **61** | **72** |

**43 of 72 fixes (60%) came across fully; 58 of 72 (81%) fully or partly.**

> **Correction, recorded rather than quietly fixed.** The first version of this
> table listed only the sweep's 61 verdicts while labelling the total `72`, and
> reported "~85% of upstream's fixes came across" — a figure that is really
> `61/72`, the _classification coverage_, not the fraction of fixes carried.
> Caught in review of PR #70. The manifest below exists so this cannot recur:
> the totals are now countable, and a row that is in no bucket is visible.

The misses cluster in three files — `rule-builder.ts`, `exclusion-comments.ts`,
`preset-dispatch.ts` — rather than spreading evenly. The first sample was
deliberately biased (silent-failure bugs in shared kernel files) and returned
45% missing; the unbiased sweep returns 10%. **Neither number describes the
corpus**; the combined 11/72 (15%) does. This record exists partly so the 45%
figure is not remembered as the finding.

Every **upstream fix** that failed to arrive is inherited — the defect was in
eess before the fold, not introduced by it. Most are in the published `0.2.x`;
see Timing. (Two findings here are _not_ inherited and shouldn't be read as
such: the absent cycle **rule** in bug 0160 is eess's own gap, and the `--fix`
regression noted under upstream 0025 is in eess-new code the fold never
touched.)

### Filed as bugs

| upstream         | eess bug                                                                                         | what                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 0043             | [0154](./bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)     | a directive inside a string literal suppresses a real violation |
| 0019             | [0155](./bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md)                    | a rule with subjects and no condition passes silently           |
| 0020             | [0156](./bugs/fixed/0156-should-twice-silently-drops-the-first-assertion.md)                     | a second `.should()` discards the first assertion               |
| 0038             | [0157](./bugs/fixed/0157-a-typo-in-a-preset-override-key-is-a-silent-false-green.md)             | a typo'd preset override key is silently ignored                |
| 0039             | [0158](./bugs/fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md)       | a reason-free directive suppresses and only warns               |
| 0064, 0067, 0065 | [0159](./bugs/0159-violation-identities-collide-across-distinct-findings.md)                     | distinct findings share one identity                            |
| 0054             | [0160](./bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md)             | `within()` cycle, and no cycle rule exists                      |
| 0013             | [0161](./bugs/fixed/0161-smell-detectors-silently-miss-object-literal-functions.md)              | smells never collect object-literal functions                   |
| 0023             | [0162](./bugs/0162-a-folder-glob-in-strictboundaries-shared-falsely-flags-with-no-diagnostic.md) | a folder-shaped `shared` glob falsely flags, silently           |
| 0029             | [0163](./bugs/0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md)             | config finding printed twice; ADR-008's gated row defeated      |

### Backlog — real, not yet filed

**Filing criterion, stated after review (PR #70).** The earlier split between
"filed" and "backlog" was arbitrary — it left two false greens and a defeated
`gated` ADR clause in prose while filing a Medium. The rule now applied:

> **Anything that produces a wrong result — a false green or a false red — gets
> a number and a board row immediately.** Everything else (message quality,
> missing diagnostics, coverage gaps, narrower divergences) stays here until
> picked up.

By that rule, upstream 0013 → [bug 0161](./bugs/fixed/0161-smell-detectors-silently-miss-object-literal-functions.md),
0023 → [bug 0162](./bugs/0162-a-folder-glob-in-strictboundaries-shared-falsely-flags-with-no-diagnostic.md),
and 0029 → [bug 0163](./bugs/0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md)
were moved out of this list and filed. What remains below produces no wrong
result on its own.

- **upstream 0030 — MISSING.** `definePredicate`/`defineCondition` are arity-2
  with no `globs` parameter, so a user-defined predicate cannot declare its
  globs and `diagnose()` is blind to it. The plumbing works: the same object
  built as a literal with `globs` diagnoses correctly.
- **upstream 0021 — PARTIAL.** Config findings inherit the rule author's
  `docs` link: a vacuity finding about a dead selector carries a URL about
  cycles. The `suggestion` half is correct; `docs` leaks.
- **upstream 0047 — PARTIAL.** Fileless findings render `(:0)` in terminal and
  `"file": "", "line": 0` in JSON, rather than nulling the location.
- **upstream 0046 — PARTIAL.** `README.md`, `CLAUDE.md`, `RELEASING.md` and
  every `packages/*/README.md` are in **no link-checked root**
  (`scripts/check-corpus.mjs`'s `ROOTS`). The repo whose product is "links
  resolve" does not check its own front door.
- **upstream 0036, 0040, 0048, 0060, 0010, 0018, 0080 — PARTIAL.**
  Narrower gaps: unclassified glob surfaces; a gated empty-layer check; empty-
  project advice that differs between the rule and `doctor`; no `hashVersion`
  or stale-baseline diagnostic. (Upstream 0015 was listed here in an earlier
  draft _and_ under Deliberate divergences — contradictory. It belongs under
  divergences only; see there.)

### A module the audit did not see — `owns-empty-discovery.ts`

Found in PR #70's review, not by the audit itself, and worth recording as a
limitation of the method: **this audit enumerated upstream's _bugs_, so it is
blind to a missing _module_ that no bug record happens to name.**

`grep -rin "ownsEmpty|owns-empty|EMPTY_DISCOVERY" packages/ scripts/ *.ts` →
**0 hits**. Upstream's `src/core/owns-empty-discovery.ts` is a module-level
`WeakSet` registry with `marksOwnEmptyDiscovery`/`ownsEmptyDiscovery`, whose
docstring records that a `unique symbol` variant was broken via
`Object.getOwnPropertySymbols`.

It is one of the three unforgeable capability registries plan 0088's own Phase
1 named, with instructions to _"port each registry verbatim, including the
WeakSet-vs-symbol choice — the choice **is** the threat model."_ The other two
(`cardinality.ts`, `silent-exclusion.ts`) are in `packages/core/src`. This one
is not.

It may be a legitimate divergence — eess's condition set may have no
empty-discovery opt-out to protect — but that is a **ruling this record owes
and does not have**. Until it is made, treat it as an open question, not a
gap and not a decision.

### Deliberate divergences — decisions, not defects

Worth recording so they are not "fixed" by a later reader:

- **upstream 0015.** eess routes the untested-allowlist notice to stderr only
  (`packages/ts/src/cli/commands/check.ts:131-139`: _"a `--format json` consumer's document
  stays machine-clean"_). Upstream put it on stdout precisely because _"an
  agent parses stdout, so a stderr-only notice would have been invisible."_
  This is not a style preference but an **ADR-008-vs-ADR-009 collision**:
  ADR-009's context clause is _"An agent does not read warnings… A warning in a
  CI log is invisible"_, while eess's routing is justified by ADR-008's
  machine-clean stdout. Both ADRs are binding; one of them should move. Naming
  the collision is this record's job; resolving it is an ADR decision.
- **upstream 0050.** eess exports `marksAssertsCardinality` publicly (the
  kernel/dialect split requires it), which weakens upstream's "the binding is
  not exported" guarantee. Already disclosed in `packages/core/src/cardinality.ts`.
- **upstream 0027, 0044, 0017.** Features eess does not have: baseline
  diagnosis (eess's `baseline.ts` is 231 lines to upstream's 774),
  `orphanExclusions` (attempted and reverted — see plan 0150), and
  `because`/`suggestion` metadata on `no-cross-boundary`.

### Not fold drift

- **upstream 0007 (dependencies aliases).** Upstream still ships
  `src/rules/dependencies.ts` and its subpath export too; no removal commit in
  either repo. The record's "Fixed / Removed" status is false upstream as well.
- **upstream 0051 (JSX never run on-disk).** A test-coverage gap, not a defect
  — a real `.tsx` fixture was built and the entry point worked correctly.

## The lesson worth keeping

Upstream pairs `orphanExclusions()`'s unit test with a **dogfood** test that
runs it over its own `src/` and asserts `[]` by identity. That test's own
comment records why it exists: _"We shipped `orphanExclusions` to catch it, and
then exercised it only in its own unit test."_

Plan 0150's attempt ported the unit test and left the dogfood behind —
repeating verbatim the mistake the source repo had already made, fixed, and
written down.

**When porting, enumerate from the source's test-file list, not from its
implementation.** A fix whose shape is a deletion leaves nothing to copy; only
its test shows it existed.

## Plan 0090's premise is refuted by this record

[Plan 0090](./plans/0090-adopt-ts-archunit-work-corpus.md) (Draft, live on the
ROADMAP) classifies upstream's fixed bugs as **heritage**:

> **History** — 83 completed plans, 69 fixed bugs, 10 ADRs, 33 docs. These are
> _records_: settled, frozen, load-bearing only as provenance. They must come
> in as **heritage** — preserved, not re-audited

and its Phase 2 success criterion is **file-count equality**.

This audit is the empirical refutation. **26 of 72** upstream fixed-bug records
(11 MISSING + 15 PARTIAL) describe defects live in the engine eess now owns.
The fixed-bug corpus of a folded ancestor is not heritage — it is a
**regression corpus**. Its counts are also already stale (69 vs the 72 upstream
now has).

Left unrevised, the next migration files all 72 under `docs/heritage/` frozen,
marks the phase green on a file count, and the live defects become unreadable
history. **Plan 0090's classification, and its count-equality criterion, need
revising before it is built** — that is a bigger recurrence risk than the one
this record set out to name.

## Timing — six of the seven filed bugs are already published

npm serves `@nielspeter/eess@0.2.2` / `eess-ts@0.2.1`; `0.3.0` (the fold) is
versioned locally but unreleased behind [plan
0100](./plans/0100-publish-the-fold-retire-ts-archunit.md).

Each filed bug's defect line was checked against `810808b` — the `v0.2.3`
release commit, i.e. the tree those published versions were cut from:

<!-- eess-exclude-start corpus/pointers-resolve: dated citations against commit 810808b, the v0.2.3 release tree. These record where each defect stood in ANOTHER tree on 2026-08-19; repointing them at today's code would falsify the measurement the audit exists to preserve. Sanctioned as a region rather than per row because a directive inside a table cell is inert (bug 0255). -->

| bug  | severity | in the published tree? | evidence                                                                                           |
| ---- | -------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| 0154 | High     | **yes**                | `exclusion-comments.ts` identical line-scan                                                        |
| 0155 | High     | **yes**                | `rule-builder.ts:337` `_phase === 'predicate'`                                                     |
| 0156 | High     | **yes**                | `rule-builder.ts:294` `fork._conditions = []`                                                      |
| 0157 | High     | **yes**                | `validateOverrides(…): void`                                                                       |
| 0158 | High     | **yes**                | reason-free directive path unchanged                                                               |
| 0159 | High     | **partly**             | `reverse-dependency.ts` has zero `identity` mentions; the `duplicate-pair::` collision is fold-era |
| 0160 | Medium   | **yes**                | `within.ts:2` value-import                                                                         |

<!-- eess-exclude-end -->

> **Correction, recorded rather than quietly fixed.** The first version of this
> section claimed "most of what is listed here is in the unpublished `0.3.0`"
> with 0154 and 0158 as the only published exceptions. That is backwards, and
> the evidence refuting it was already inside bugs 0155/0156/0157, each of
> which cites `git show 810808b:…` to prove the defect predates the fold — and
> anything predating the fold is, by definition, in the published `0.2.x`.
> Caught in review of PR #70.

**Consequence for sequencing.** Five published High false-greens are not
"fix before the next publish" — they are live for anyone on `0.2.x` today. Plan
0100 is therefore the wrong deadline for them; a `0.2.x` patch release is the
question worth asking, and it is a call for the maintainer, not this record.
0100 remains the right gate only for the fold-era portion of 0159.

## Manifest — one row per upstream bug

The audit's denominator, made countable. `P` = PRESENT · `p` = PARTIAL ·
`M` = MISSING · `-` = N/A. "src" is which pass produced the verdict.

<!-- eess-exclude-start corpus/pointers-resolve: the same dated sweep, one row per audited id. Same reason as the table above. -->

| id    | v   | src    | note                                                              |
| ----- | --- | ------ | ----------------------------------------------------------------- |
| 0001  | P   | sweep  | `execute-rule.ts:59-64` post-fix targets; live-checked            |
| 0002  | P   | sweep  | all 6 property conditions present                                 |
| 0003  | P   | sweep  | ctor/method/setter params scanned                                 |
| 0004  | P   | sweep  | visibility predicates compose                                     |
| 0005  | P   | sweep  | `haveReturnTypeMatching` live                                     |
| 0006  | P   | sweep  | `haveArgumentWithProperty` live                                   |
| 0007a | P   | sweep  | unified `not`/`and`/`or` dispatch (`not-matcher`)                 |
| 0007b | M   | sweep  | **not fold drift** — upstream still ships the aliases too         |
| 0008  | P   | sweep  | `getElementName` walks ancestors                                  |
| 0009  | P   | sweep  | `parseMatchingGlob`, all 4 spellings                              |
| 0010  | p   | sweep  | portable identity root; no `hashVersion`/stale diagnostic         |
| 0011  | P   | sweep  | generic dead-glob gate fires                                      |
| 0012  | P   | sweep  | metric ratchet red/green table correct                            |
| 0013  | p   | sweep  | **false green** — smells miss object-literal functions → bug 0161 |
| 0014  | P   | sweep  | bare-package globs match                                          |
| 0015  | p   | sweep  | detection present; stdout surface diverges — see Divergences      |
| 0016  | P   | sample | copy-on-write present; `CorrespondenceBuilder` gap noted          |
| 0017  | -   | sweep  | eess's `no-cross-boundary` carries no metadata to overclaim       |
| 0018  | p   | sweep  | file glob still selects nothing, but loudly (ADR-010)             |
| 0019  | M   | sample | → bug 0155                                                        |
| 0020  | M   | sample | → bug 0156                                                        |
| 0021  | p   | sweep  | `docs` still leaks onto config findings                           |
| 0022  | P   | sweep  | all three edge kinds seen                                         |
| 0023  | p   | sweep  | **false red** — folder-glob silently misflags → bug 0162          |
| 0024  | P   | sweep  | `writeStderr` + EPIPE listener                                    |
| 0025  | P   | sample | fault class carried; `--fix` regression noted separately          |
| 0026  | P   | sweep  | `attributeToRuleFile` wired                                       |
| 0027  | -   | sweep  | baseline diagnosis absent (231 vs 774 lines)                      |
| 0028  | P   | sweep  | 4 findings, 4 distinct hashes                                     |
| 0029  | p   | sweep  | **ADR-008 double render** → bug 0163                              |
| 0030  | M   | sweep  | `define*` factories cannot declare globs                          |
| 0031  | P   | sweep  | project-empty dedup via WeakSet                                   |
| 0032  | P   | sweep  | `absent` carries scoped text                                      |
| 0033  | P   | sweep  | `assignedFrom` accepts project-relative                           |
| 0034  | P   | sweep  | `matchedTriviaPositions`, idempotent                              |
| 0035  | P   | sweep  | plan 0148's multi-root work                                       |
| 0036  | p   | sweep  | 2 of 4 glob surfaces classified, no census                        |
| 0037  | P   | sweep  | relative import spelling accepted                                 |
| 0038  | M   | sample | → bug 0157                                                        |
| 0039  | M   | sample | → bug 0158                                                        |
| 0040  | p   | sweep  | empty-layer check gated on `pairs.length > 0`                     |
| 0041  | P   | sample | `execute-rule` ordering carried (sabotage-verified)               |
| 0042  | P   | sample | producer states own remedy; all 4 guards hold                     |
| 0043  | M   | sample | → bug 0154                                                        |
| 0044  | -   | sweep  | `orphanExclusions` absent (plan 0150, reverted)                   |
| 0045  | P   | sweep  | `disk-set` prunes by name before `isDirectory()`                  |
| 0046  | p   | sweep  | root + package READMEs in no link-checked root                    |
| 0047  | p   | sweep  | fileless findings render `(:0)` / `"line": 0`                     |
| 0048  | p   | sweep  | empty-project text not doctor-parity                              |
| 0049  | P   | sweep  | module-scoped, dogfooded, unexcluded                              |
| 0050  | P   | sample | WeakSet unforgeable; export is a disclosed weakening              |
| 0051  | M   | sweep  | **coverage gap, not a defect** — JSX works on-disk when run       |
| 0052  | P   | sweep  | `triviaRoot()` gated                                              |
| 0053  | P   | sweep  | anchored + case-sensitive marker                                  |
| 0054  | M   | sweep  | → bug 0160                                                        |
| 0055  | P   | sweep  | cycle edges real, no `unknown:0`                                  |
| 0056  | P   | sample | sorted membership + per-edge identity                             |
| 0057  | P   | sweep  | per-field `?? true`                                               |
| 0058  | P   | sweep  | `per-root-compiler-options` (plan 0148)                           |
| 0059  | P   | sweep  | `QUESTIONS` keys edge kinds per question                          |
| 0060  | p   | sweep  | change detector present; parts 1–2 have no counterpart            |
| 0061  | P   | sweep  | `anyCase` derived + escaped                                       |
| 0063  | P   | sweep  | 3 dependency identities distinct                                  |
| 0064  | M   | sweep  | → bug 0159 (1)                                                    |
| 0065  | p   | sweep  | message half carried, identity half absent → bug 0159 (3)         |
| 0066  | P   | sweep  | ADR-010 floor covers zero-file smells                             |
| 0067  | M   | sweep  | → bug 0159 (2)                                                    |
| 0068  | P   | sweep  | qualified names, 6 distinct identities                            |
| 0069  | P   | sweep  | superseded — the message doesn't exist in eess                    |
| 0073  | P   | sweep  | fixed at the root; `SmellBuilder` inherits the gate               |
| 0076  | P   | sweep  | `distinctVocabulary` pre-filter                                   |
| 0080  | p   | sweep  | loader indirection present; `isolate: true` pin absent            |

<!-- eess-exclude-end -->

**Counts:** P 43 · p 15 · M 11 · - 3 · **total 72**.

Of the 11 `M`, two are not fold drift: **0007b** (upstream still ships it) and
**0051** (a test-coverage gap; the code works). So **9 genuine missing fixes**,
of which 7 are filed as bugs 0154–0160 and 2 remain in the backlog (0030, and
0064/0065/0067 folded into 0159).
