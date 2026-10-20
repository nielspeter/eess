# Spike 0395: what an accepted entry without a file does under per-file grouping

Opened 2026-10-07 for [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s
Phase 2, after enforcement review of
[spike 0394](./0394-the-phase-2-design-for-a-file-aware-baseline.md)'s decision found that two of
its decisions contradict each other. Time box: half a working day. It ends in a design
for a decision, not in code, and the Phase 2 build plan is not written until it has.
_2026-10-20: the Phase 2 build plan is written,
[plan 0532](../plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md), as a Draft
whose `accepted` and C13 parts are left open for this spike; it does not go Ready until this spike
has decided (plan 0346, "Notes, 2026-10-20")._

**Run 2026-10-20**, inside the time box (about one hour of measurement). The results are under
Results, and the design it recommends is under Recommendation. **Nothing is decided yet:** the
coordinating agent decides (Who decides), and records it under a Decision section here.

## The question

Spike 0394 chose per-file grouping (EP2) and kept the deferred-warning collision guard
(`hasIdentityCollision`, census C13) blind to files, because an `accepted` entry carries no file: a
guard keyed per file let a copy in a new file arrive already accepted (spike 0394, Review). Its first
decision 4 then made entries with no file stop matching, which removes that premise. Enforcement
review found three consequences, reasoned from the code and not measured:

- **The guard's pin cannot fail.** `deferred-warning.test.ts` ·
  `it('the swap, reproduced with a colliding subject: a genuinely new finding is escalated, not silently absorbed')`
  builds its list from file-less subjects. If none of them match, every finding is `error` with the
  guard deleted.
- **A file-blind guard gives a false cause.** Under EP2, `a::X` and `b::X` are no longer suffixed,
  but the guard still treats them as one collision, and its advice says the repair assigns a
  positional suffix, which it no longer does (ADR-009 rule 2).
- **The advice for a file-less entry is unsafe.** A "file-qualified replacement" built from where the
  subject matches now accepts `b` without review on the bug 0388 shape.

## What to measure

Under EP2, with the guard keyed blind to files and keyed per file:

1. EP's Critical shapes ("`a` stays, `b` copies"; the swap; "two accepted, then `c`"), with lists
   that are file-qualified, file-less, and mixed.
2. The same with file-less entries matching, and with them not matching (the first decision 4).
3. Which collisions a file-qualified list cannot tell apart, and so which keying the guard needs.
4. What advice a file-less entry can give that does not accept an unreviewed finding.
5. One spelling for a file-qualified entry, aligned with bug 0389's `<root:NAME>/path` portable form.

Each answer is compared against `main` the way spike 0394's review did: no shape may be green where
`main` is red, and every escalation must state its true cause.
Each option is also costed for adopters: `accepted` lives in rule source, so `--migrate` cannot
rewrite it, and an option that breaks existing lists needs a recipe for editing them by hand.

## Who decides

The coordinating agent, under the delegation recorded in spike 0394's Decision, unless an option
accepts a risk on adopters' behalf; that goes to the maintainer. Two outcomes go back to the
maintainer by rule:

- no C13 keying is both no greener than `main` and free of false causes under EP2: spike 0394's
  decision 1 is reopened;
- any measurement here contradicts EP2: the question returns to spike 0394.

## Out of scope

Everything spike 0394 decided: per-file grouping, the no-root rule, the integration branch.

## Method

One worktree at `dc1dbdc` (the branch of PR #255), its own `node_modules` from `npm ci`, built.
One throwaway patch (Appendix A) puts every option behind environment switches, read at call time,
so every cell runs on identical code. It was committed only to an unpushed scratch branch
(`scratch/0395-proto`, `d6d289e`) and is not merged anywhere.

- `SPIKE_VARIANT=EP2`: spike 0394's EP2 grouping, in the kernel. `disambiguateIdentities` groups on
  `rule::file::subject` (C12) and reserves suffixes per file (C12a). Unset, the grouping is `main`'s.
  The baseline's file check is not part of this patch: `accepted` never reads the baseline.
- `SPIKE_C13`: the collision guard keyed `blind` (`rule::subject`, as on `main`), `perfile`
  (`rule::file::subject`, the key EP2 groups on), or `none` (deleted, for the pins).
- `SPIKE_FL`, what a file-less entry (a string) does:
  - `match`: as on `main`, it matches its subject in any file.
  - `none`: spike 0394's first decision 4. It matches only a finding whose subject names the
    finding's own file as a whole token, raw or portable. A subject that carries its path is
    already tied to one file, so this removes only the entries that carry no file.
  - `unique`: it matches only while every finding it matches is in one file. If its subject is
    found in two or more files, it cannot say which was reviewed, and those findings escalate with
    their own cause (ambiguous). Counted on the raw findings, before exclusions, as the collision
    guard is.
  - `unique-coarse`: the same, but an ambiguous entry escalates the whole batch, as the collision
    guard does.
- `SPIKE_FQ=on`: a file-qualified entry, `{ file, subject }`, matches a finding whose file is
  `file` (raw, or `<root:NAME>/path` as bug 0389 spells it) and whose subject is `subject` (raw or
  portable). On `main` such an entry matches nothing.

The harness (Appendix B) drives the public path: a rule's `violations()` to write a list,
`asSeverity('warn', { accepted })` on the next run, `violations()` for each finding's severity,
`checkAll` for the rule's verdict, and `deferredWarningAdvice()` for the cause. Root discovery reads
a real directory (`.git` and a named `package.json`), with the files in an in-memory project at
paths under it, as `an-accepted-list-is-portable.test.ts` does. The rule is
`functions().that().areExported().should().haveNameMatching(/Handler$/)`, whose subject
(`parseConfig::parseConfig does not have a name matching /Handler$/`) carries no file, which is the
case the question is about. Two same-file findings are two declarations of one function in one
file. The path-bearing rows use `modules().should().notHaveAliasedImports()`, whose identity carries
the path.

**Three list kinds.** FL: a file-less list, as an adopter writes it today, from `violations()`
(written under `main` and under EP2; the two gave the same cell in every row). FQ: every entry
qualified with its file. MX: the first finding qualified, the rest file-less.

**The comparison with `main`.** `main` cannot read an FQ entry, so every row is compared with `main`
holding the FL list for the same review. A cell is wrong if the rule is green where `main` is red,
or if a finding that was not reviewed in its own file is `warn` where `main` has it `error`. A
reviewed finding at `warn` where `main` has it `error` is counted separately: it is what
qualifying an entry is for, and the tables say where it happens. A cause is false if the advice
names a mechanism the run did not use.

**Timings.** The matrix: under 1 s. The exhaustive comparison: about 5 s per option. The eess-ts
suite: 46 s with the patch at its defaults and 49 s under the recommended option (3,981 tests).

## Results

### The shapes

Each cell is the rule's verdict, each finding's severity (`aW` is the finding in `a` at `warn`,
`aE` at `error`), and the cause the advice names: **C** the collision guard's message ("assigns a
POSITIONAL suffix"), **Cf** the per-file guard's ("two or more findings in ONE FILE"), **A**
ambiguous ("carries no file but matches findings in more than one file"), **N** not in the list.
`blind, unique` gave the same cell as `blind, match` in every row, so it has no column.

**file-less list (FL)**

| shape                                             | `main`, FL           | blind, match         | blind, none          | per file, match       | per file, none        | per file, unique      | per file, unique-coarse |
| ------------------------------------------------- | -------------------- | -------------------- | -------------------- | --------------------- | --------------------- | --------------------- | ----------------------- |
| S0 unchanged `{a,b}`                              | **red** aE bE (C)    | **red** aE bE (C)    | **red** aE bE (C)    | green aW bW           | **red** aE bE (N)     | **red** aE bE (A)     | **red** aE bE (A)       |
| S1 the copy `{a}→{a,b}`                           | **red** aE bE (C)    | **red** aE bE (C)    | **red** aE bE (C)    | green aW bW           | **red** aE bE (N)     | **red** aE bE (A)     | **red** aE bE (A)       |
| S2 the swap `{a,b}→{b,c}`                         | **red** bE cE (C)    | **red** bE cE (C)    | **red** bE cE (C)    | green bW cW           | **red** bE cE (N)     | **red** bE cE (A)     | **red** bE cE (A)       |
| S3 two accepted, then c `{a,b}→{a,b,c}`           | **red** aE bE cE (C) | **red** aE bE cE (C) | **red** aE bE cE (C) | green aW bW cW        | **red** aE bE cE (N)  | **red** aE bE cE (A)  | **red** aE bE cE (A)    |
| S4 bug 0388 `{a}→{b}`                             | green bW             | green bW             | **red** bE (N)       | green bW              | **red** bE (N)        | green bW              | green bW                |
| S5 a same-file pair `{a×2}`, unchanged            | **red** aE aE (C)    | **red** aE aE (C)    | **red** aE aE (C)    | **red** aE aE (Cf)    | **red** aE aE (Cf)    | **red** aE aE (Cf)    | **red** aE aE (Cf)      |
| S6 the pair, then a copy `{a×2}→{a×2,b}`          | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf)   |
| S7 a copy beside a unique Y `{a:X+Y}→{a:X+Y,b:X}` | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (C) | green aW aW bW        | **red** aE aE bE (N)  | **red** aW aE bE (A)  | **red** aE aE bE (A)    |

**file-qualified list (FQ)**

| shape                                             | `main`, FL           | blind, match         | blind, none          | per file, match       | per file, none        | per file, unique      | per file, unique-coarse |
| ------------------------------------------------- | -------------------- | -------------------- | -------------------- | --------------------- | --------------------- | --------------------- | ----------------------- |
| S0 unchanged `{a,b}`                              | **red** aE bE (C)    | **red** aE bE (C)    | **red** aE bE (C)    | green aW bW           | green aW bW           | green aW bW           | green aW bW             |
| S1 the copy `{a}→{a,b}`                           | **red** aE bE (C)    | **red** aE bE (C)    | **red** aE bE (C)    | **red** aW bE (N)     | **red** aW bE (N)     | **red** aW bE (N)     | **red** aW bE (N)       |
| S2 the swap `{a,b}→{b,c}`                         | **red** bE cE (C)    | **red** bE cE (C)    | **red** bE cE (C)    | **red** bW cE (N)     | **red** bW cE (N)     | **red** bW cE (N)     | **red** bW cE (N)       |
| S3 two accepted, then c `{a,b}→{a,b,c}`           | **red** aE bE cE (C) | **red** aE bE cE (C) | **red** aE bE cE (C) | **red** aW bW cE (N)  | **red** aW bW cE (N)  | **red** aW bW cE (N)  | **red** aW bW cE (N)    |
| S4 bug 0388 `{a}→{b}`                             | green bW             | **red** bE (N)       | **red** bE (N)       | **red** bE (N)        | **red** bE (N)        | **red** bE (N)        | **red** bE (N)          |
| S5 a same-file pair `{a×2}`, unchanged            | **red** aE aE (C)    | **red** aE aE (C)    | **red** aE aE (C)    | **red** aE aE (Cf)    | **red** aE aE (Cf)    | **red** aE aE (Cf)    | **red** aE aE (Cf)      |
| S6 the pair, then a copy `{a×2}→{a×2,b}`          | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf)   |
| S7 a copy beside a unique Y `{a:X+Y}→{a:X+Y,b:X}` | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aW aW bE (N)  | **red** aW aW bE (N)  | **red** aW aW bE (N)  | **red** aW aW bE (N)    |

**mixed list (MX): the first finding qualified, the rest file-less**

| shape                                             | `main`, FL           | blind, match         | blind, none          | per file, match       | per file, none        | per file, unique      | per file, unique-coarse |
| ------------------------------------------------- | -------------------- | -------------------- | -------------------- | --------------------- | --------------------- | --------------------- | ----------------------- |
| S0 unchanged `{a,b}`                              | **red** aE bE (C)    | **red** aE bE (C)    | **red** aE bE (C)    | green aW bW           | **red** aW bE (N)     | **red** aW bE (A)     | **red** aE bE (A)       |
| S1 the copy `{a}→{a,b}`                           | **red** aE bE (C)    | **red** aE bE (C)    | **red** aE bE (C)    | **red** aW bE (N)     | **red** aW bE (N)     | **red** aW bE (N)     | **red** aW bE (N)       |
| S2 the swap `{a,b}→{b,c}`                         | **red** bE cE (C)    | **red** bE cE (C)    | **red** bE cE (C)    | green bW cW           | **red** bE cE (N)     | **red** bE cE (A)     | **red** bE cE (A)       |
| S3 two accepted, then c `{a,b}→{a,b,c}`           | **red** aE bE cE (C) | **red** aE bE cE (C) | **red** aE bE cE (C) | green aW bW cW        | **red** aW bE cE (N)  | **red** aW bE cE (A)  | **red** aE bE cE (A)    |
| S4 bug 0388 `{a}→{b}`                             | green bW             | **red** bE (N)       | **red** bE (N)       | **red** bE (N)        | **red** bE (N)        | **red** bE (N)        | **red** bE (N)          |
| S5 a same-file pair `{a×2}`, unchanged            | **red** aE aE (C)    | **red** aE aE (C)    | **red** aE aE (C)    | **red** aE aE (Cf)    | **red** aE aE (Cf)    | **red** aE aE (Cf)    | **red** aE aE (Cf)      |
| S6 the pair, then a copy `{a×2}→{a×2,b}`          | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf) | **red** aE aE bE (Cf)   |
| S7 a copy beside a unique Y `{a:X+Y}→{a:X+Y,b:X}` | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aE aE bE (C) | **red** aW aW bE (N)  | **red** aE aW bE (N)  | **red** aW aW bE (N)  | **red** aW aW bE (N)    |

What the identities were: under `main` the cross-file shapes carry `#1` and `#2` (S0 to S3, S7).
Under EP2 no cross-file finding carries a suffix; only the same-file pair does (`#1` in `a`, S5 and
S6).

### Every shape over three files

The shapes above are picked by hand, so every combination was run as well: three files, each
holding nothing, `X`, `X` twice or `Y` (64 states), every `before` that has a finding against every
`after`, 4,096 pairs per list. Each option was compared with `main` holding the FL list written
from the same `before`.

| option                  | FL: green where `main` is red | FL: red where `main` is green | FL: an unreviewed finding `warn` where `main` has it `error` | FQ: green where `main` is red | FQ: red where `main` is green | collision cause with no suffix in the run |
| ----------------------- | ----------------------------- | ----------------------------- | ------------------------------------------------------------ | ----------------------------- | ----------------------------- | ----------------------------------------- |
| blind, match            | 0                             | 0                             | 0                                                            | 0                             | 267                           | **896** (FL and FQ alike)                 |
| per file, match         | **552**                       | 0                             | **810**                                                      | 87                            | 267                           | 0                                         |
| per file, none          | 0                             | **459**                       | 0                                                            | 87                            | 267                           | 0                                         |
| per file, unique        | 0                             | 0                             | 135                                                          | 87                            | 267                           | 0                                         |
| per file, unique-coarse | 0                             | 0                             | 33                                                           | 87                            | 267                           | 0                                         |

The FL columns held the same numbers for a list written under `main` and one written under EP2.
Reading the rest of the table:

- **FQ, green where `main` is red (87, every per-file option).** In every one of them each `warn`
  finding has an entry naming its own file: the count of unreviewed `warn` findings under FQ was 0
  for every option. Example: `{b, c}` reviewed, unchanged; `main` is red only because its guard
  sees `X` twice. This is the one place an option is greener than `main`, and it is the remedy
  working. Under `blind` it never happens: a file-qualified list can never make a cross-file repeat
  green, so the remedy for the copy does not clear it.
- **FQ, red where `main` is green (267, every option).** The bug 0388 shape in a list: `X` reviewed
  in `c`, then fixed, and made in `b`. `main` forgives `b`; a file-qualified entry does not.
- **The 135 and the 33 (`unique`).** Every one is bug 0388's shape with a file-less entry, inside a
  run that is red anyway, which `main` happens to escalate for an unrelated reason. Example, the
  same in both: `X` reviewed in `c`; then `X` in `a` and `Y` in `b` and `c`. `main` is red because
  `Y` repeats across files, so its guard escalates everything, `a` included. `unique` is red because
  `Y` is not in the list, and leaves `a` at `warn`: its file-less entry matches one file only, which
  is exactly what `main` does to `a` once `Y` is fixed. The narrow form's 102 more are the same kind
  beside an ambiguous entry, which the coarse form escalates with it. No case among them is green:
  each one's rule is red under the option too, or it would be counted in the first column.
- **The 896 (`blind`).** In each, the advice says the repair "assigns a POSITIONAL suffix", and no
  identity in the run carries one. That is a false cause (ADR-009 rule 2).
- **The 459 (`none`).** Every list of subjects without a path turns red on upgrade, including an
  unchanged repository (S0 to S4, FL). Its message is false too: it says the findings "are not in
  that list" when the list holds those exact subjects, and its remedy, "extend `accepted`", adds a
  string that matches nothing.

### The pins

- **C13 needs its own pin under every option.** With the guard deleted (`SPIKE_C13=none`), S5's
  same-file pair goes from all `error` (Cf) to `aW aW`, for FL, FQ and MX lists, under `match` and
  `unique`. Under `none` only an FQ or MX list shows it: an FL list is red there either way.
- **The existing cross-file swap test cannot pin C13 under the recommendation.**
  `deferred-warning.test.ts` ·
  `it('the swap, reproduced with a colliding subject: a genuinely new finding is escalated, not silently absorbed')`
  passes with C13 deleted under `unique-coarse` (measured). It **does** pin the ambiguity check: with
  the check deleted (`per file, match`) it fails (measured). Enforcement review's first point is
  confirmed: the test pins whatever escalates a file-less list on a cross-file repeat, and under EP2
  that is no longer C13.
- **The file check on an FQ entry pins itself.** With it deleted, S1's FQ row goes from `aW bE` to
  `aW bW`, S2's from `bW cE` to `bW cW`, and S4's from `bE` to `bW`.

### The suite

`deferred-warning.test.ts` and `an-accepted-list-is-portable.test.ts` hold 47 tests. With the patch
at its defaults all pass. The failures under each option:

| option                  | failing | which                                                                                                                                                                                                                                                                          |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| blind, match            | 1       | `it('two same-named violations across files collide onto bare + "#1"')`: EP2's, known from spike 0394                                                                                                                                                                          |
| per file, match         | 3       | the one above; the swap test; `it('diagnose() names the collision, not "not accepted" — a different, more urgent cause')`                                                                                                                                                      |
| per file, none          | 11      | four of spike 0393's portable-syntax tests and seven `deferred-warning` tests, among them `it('stays warn for accepted findings, escalates the one not accepted')` and `it('checkAll does not throw when every current finding is accepted')`: lists that held before now fail |
| per file, unique        | 2       | the `#1` test above, and the `diagnose()` test, which now gets the ambiguity message instead of the collision one                                                                                                                                                              |
| per file, unique-coarse | 2       | the same two                                                                                                                                                                                                                                                                   |

The whole eess-ts suite under `per file, unique` against the patch at its defaults: 7 failing
against 2. The 2 are in `scan-cardinality-assertions.test.ts` in both runs (the scan reads the
harness file this spike added to `tests/`). The 5 more are those two `deferred-warning` tests and
three `identity-uniqueness.test.ts` rows that spike 0394 already lists as EP2's
(`taken.add`'s guard and the two `beImported` rows). Nothing else in eess-ts reads `accepted`.

### Path-bearing subjects

For `notHaveAliasedImports`, whose identity carries the path, every option gave `main`'s cell, with
a raw list and with a portable one: unchanged, the finding stays `warn`; on bug 0388's shape the
new file is `error`; copied, the old file `warn` and the new one `error`. Such an entry is tied to
one file already, so the question only concerns subjects without a path.

### Question 4: the advice for a file-less entry

Two candidates, applied and re-run under `per file, unique-coarse`:

| advice                                                                                              | on bug 0388's shape (`a` reviewed, `a` fixed, `b` made) | on the copy (`a` reviewed, `b` copied) |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------- |
| A1: print a file-qualified replacement built from where the subject matches now                     | `b` **`warn`**: accepted without review                 | `a` `warn`, `b` **`warn`**             |
| A2: name the files it matches, and tell the author to qualify the entry with the file they reviewed | `b` `error`                                             | `a` `warn`, `b` `error`                |

A1 is the remedy spike 0394 rejected for R13, measured again here. A2's measured text, on the copy:

> "spike/0395" is a deferred warning, and 1 `accepted` entry carries no file but match findings in
> more than one file, so the list cannot say which of them was reviewed:
> parseConfig::parseConfig does not have a name matching /Handler$/ (in &lt;root:acme&gt;/src/a.ts,
> &lt;root:acme&gt;/src/b.ts). Those findings are errors until each entry names the file it was
> written for, as { file, subject }; a finding in a file you did not review is new: fix it, or
> review it and add its own entry.

(The prototype's grammar, "1 entry … match", is a prototype's.) On bug 0388's shape no advice is
printed: the entry matches one file, the rule is green, as on `main`.

### Question 5: one spelling

A string spelling, `<root:NAME>/path::subject`, was built for the aliased-import finding in
`src/a/index.ts`: `<root:acme>/src/a/index.ts` + `::` + `aliased::x::y`. It is the same string as
that finding's own portable subject, `<root:acme>/src/a/index.ts::aliased::x::y` (measured equal).
One string then has two readings: a path-bearing subject, and a file plus a path-less subject.
Spike 0393 found that no string syntax can be made unspellable, since identities and messages are
free text. An object entry has no string to collide with.

## What this answers

1. **The Critical shapes, per option** (the shape tables, and the exhaustive table):
   - **`blind`** is never greener than `main` (0 of 4,096 per list kind), but it gives a false cause
     in 896 of them: it blames a positional suffix that EP2 no longer assigns across files. It also
     keeps a file-qualified list from ever clearing a cross-file repeat, so the remedy for the copy
     does not remediate.
   - **`per file, match`** reproduces enforcement review's Critical finding under EP2: with a
     file-less list, the copy, the swap and "two accepted, then `c`" are all green, and 552 of 4,096
     cases are green where `main` is red. Keying C13 per file is not enough on its own.
   - **`per file, none`** is never greener than `main`, and turns 459 of 4,096 cases red where
     `main` is green, an unchanged repository among them.
   - **`per file, unique`** and **`unique-coarse`** are never green where `main` is red with a
     file-less list, and give no false cause. With a file-qualified list they are green where
     `main` is red in 87 cases, each with every `warn` finding reviewed in its own file.
2. **File-less entries matching, or not:** not matching (`none`) is the only option that closes bug
   0388's hole for a file-less list (S4), and it does so by breaking every such list, unchanged code
   included. Matching only while unambiguous (`unique`) keeps the hole exactly where `main` has it
   (S4 green in both) and closes the copy, the swap and "two accepted, then `c`".
3. **What a file-qualified list cannot tell apart:** two findings with one subject in **one file**
   (S5, S6: all `error` even when every entry is qualified). Across files it tells them apart (S0 to
   S3, S7). So the guard is keyed **per file**, on the key EP2 groups on; a repeat across files is
   no longer a collision. What escalates it for a file-less list is a separate check with its own
   cause: an entry that carries no file and matches in more than one.
4. **The advice:** A2. Name the files the entry matches, and tell the author to qualify it with the
   file they reviewed. Nothing built from where the subject matches now (A1 accepts `b` on both
   shapes, measured).
5. **The spelling:** an object, `{ file: '<root:NAME>/src/a.ts', subject: '…' }`. A string spelling
   is a real finding's portable subject (measured), and spike 0393 showed no string syntax can be
   reserved.

Neither outcome that goes back to the maintainer by rule is met. A C13 keying exists that is no
greener than `main` and free of false causes, **with the ambiguity check beside it**; without that
check, per-file keying is greener (`per file, match`). No measurement here contradicts EP2: every
row ran under it. **One judgement is the coordinator's:** the 87 FQ cases are green where `main` is
red. `main` cannot read a qualified entry, so the comparison is with the file-less list for the
same review; in each case every finding left at `warn` was reviewed in its own file, and none was
not. The spike reads that as the remedy working, not as a looser match.

## Adopter cost

`accepted` lives in rule source, so `--migrate` cannot rewrite it.

- **`unique-coarse` (recommended): no edit.** No file-less list that is green on `main` turns red
  (0 of 4,096, for lists written under `main` and under EP2), and no `accepted` test in this repo
  fails for a list reason. A rule whose subject repeats across files was already red on `main`; it
  stays red, under a cause that is now true and a remedy that now works. Qualified entries are
  opt-in, and the type change is additive: `accepted` takes
  `readonly (string | { readonly file: string; readonly subject: string })[]`.
- **To close bug 0388's hole for a list**, an adopter replaces each string with
  `{ file, subject }` naming the file they reviewed. That is a hand edit from their own review,
  never from the current run: built from where the subject matches now, it accepts the very finding
  bug 0388 is about (A1). Nothing forces the edit.
- **`none`: every list of subjects without a path turns red on upgrade.** No mechanical recipe
  exists: nothing records which file a string was written for, and building the file from the
  current run is A1. Each adopter would re-review every such entry. That accepts a cost on
  adopters' behalf, so `none` would be the maintainer's to decide (Who decides).
- **How many adopters use `accepted` is not known.** This repository's rules use none; no adopter
  record in `work/` mentions one.

**The residual, stated.** Under the recommendation a file-less entry still forgives its subject in a
file it was not written for, when that is the only file holding it (S4; spike 0394's R14). That is
`main`'s behaviour, unchanged, and it closes only for entries that name a file. It is recorded in
bug 0388 when plan 0532 closes it. Whether file-less entries should later stop matching is a
separate decision with the adopter cost above.

## Recommendation

For the coordinating agent to decide:

1. **C13 keyed per file**, on the one group key EP2 groups on (plan 0532, Phase 1's shared
   function), so its docstring's "the same grouping key `disambiguateIdentities()` groups on" is true
   again. Its message says the findings share one subject **in one file** (Cf), with today's remedy:
   qualify the message, or set `identity`.
2. **A file-less entry matches while every finding it matches is in one file.** When its subject is
   found in two or more files (raw findings, before exclusions, like C13), the whole batch is
   escalated, as C13 does: the coarse form. It leaves 33 rather than 135 of the residual cases at
   `warn` inside a red run, and the guard's own argument, that a batch `accepted` cannot reason
   about is not trusted in part, applies to an ambiguous entry too. Its cost is that a qualified
   entry beside an ambiguous one goes red with it (S0, MX) until the ambiguous one is qualified.
3. **A file-qualified entry is an object, `{ file, subject }`.** `file` matches the finding's file
   raw or as `<root:NAME>/path`; `subject` matches raw or portable, as bug 0389's strings do. Spike
   0393's portable-syntax rule applies to `subject` as it does today.
4. **The advice is A2.** The ambiguity message names the entry, the files it matches and the
   `{ file, subject }` form, and prints no ready replacement. Also measured: on S1 with a qualified
   list, `b` gets the "not in that list" message, though its subject is in the list for `a`. The
   build says that instead ("accepted for `src/a.ts`, not this file").
5. **The pins, each to go red with its mechanism reverted:**
   - C13 per file: S5's same-file pair, with a qualified list, all `error` with the per-file message;
     reverted (guard deleted), `aW aW`.
   - the ambiguity check: the existing swap test, kept as it is, and S1's copy with a file-less list,
     all `error` with the ambiguity message; reverted (`match`), `aW bW`.
   - the coarse form: S0 with a mixed list, both `error`; reverted to narrow, `aW`.
   - the file check on a qualified entry: S1 with a qualified list, `aW bE`; reverted, `aW bW`.
   - the advice: A2 on the copy and on bug 0388's shape; following it clears only the reviewed
     finding.
   - `it('diagnose() names the collision, not "not accepted" — a different, more urgent cause')` is
     rewritten to name the ambiguity, and
     `it('two same-named violations across files collide onto bare + "#1"')` to a same-file fixture,
     as plan 0532 already says.

## What this changes in plans 0532 and 0533

- **Plan 0532, Phase 5** becomes the recommendation above, and its Test inventory row "C13 and
  `accepted`" becomes the pins in item 5. Its first ledger box can close once the coordinator has
  decided.
- **Plan 0532, Release:** nothing about `accepted` breaks. The qualified form is additive. A rule
  whose subject repeats across files was red on `main` and stays red, with a different message.
  "And whatever spike 0395 decides for `accepted`" leaves the `**Breaking**` text.
- **Plan 0532, Phase 6:** `hasIdentityCollision`'s docstring is per file, and the `asSeverity`
  TSDoc documents `{ file, subject }` and the residual.
- **Plan 0533, Phase 5:** no recipe for editing rule source is needed, since file-less entries keep
  matching. The migration page and the README's `accepted` section document the qualified form,
  the ambiguity message, and the residual.
- **Bug 0388:** gains the residual above at its close, in plan 0532.

Not measured: sibling dialects (they have no `accepted`), Windows paths, a real `git worktree`, and
an `accepted` list combined with `.excluding()` or `--changed`. The ambiguity count reads the raw
findings, as C13 does, which by construction counts a copy that a filter dropped; no row ran it.

## Appendix A: the prototype patch

On `dc1dbdc`, committed to the unpushed branch `scratch/0395-proto` (`d6d289e`). Never merged.

```diff
diff --git a/packages/core/src/violation.ts b/packages/core/src/violation.ts
index 4d46ede6..268b419c 100644
--- a/packages/core/src/violation.ts
+++ b/packages/core/src/violation.ts
@@ -260,6 +260,8 @@ export function portableSubjectOf(violation: ArchViolation, root?: string): stri
  * subject across their two rule strings would have moved a published entry.
  */
 function groupKeyOf(violation: ArchViolation): string {
+  // SPIKE 0395: EP2 groups per file
+  if (process.env.SPIKE_VARIANT === 'EP2') return `${violation.rule}::${violation.file}::${subjectOf(violation)}`
   return `${violation.rule}::${subjectOf(violation)}`
 }

@@ -417,11 +419,14 @@ export function disambiguateIdentities(violations: ArchViolation[]): ArchViolati
     const subject = subjectOf(violation)
     let suffix = occurrence - 1
     let candidate = `${subject}#${String(suffix)}`
-    while (taken.has(`${violation.rule}::${candidate}`)) {
+    // SPIKE 0395: EP2 reserves per file
+    const reserve = (c: string): string =>
+      process.env.SPIKE_VARIANT === 'EP2' ? `${violation.rule}::${violation.file}::${c}` : `${violation.rule}::${c}`
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
index 80fb3ba3..4f4af209 100644
--- a/packages/ts/src/core/terminal-builder.ts
+++ b/packages/ts/src/core/terminal-builder.ts
@@ -92,9 +92,12 @@ export type { CollectResult }
  * `rule::subject` grouping key `disambiguateIdentities()` itself groups on.
  */
 function hasIdentityCollision(violations: readonly ArchViolation[]): boolean {
+  // SPIKE 0395: SPIKE_C13 = blind (main) | perfile | none
+  const keying = process.env.SPIKE_C13 ?? 'blind'
+  if (keying === 'none') return false
   const seen = new Set<string>()
   for (const v of violations) {
-    const key = `${v.rule}::${subjectOf(v)}`
+    const key = keying === 'perfile' ? `${v.rule}::${v.file}::${subjectOf(v)}` : `${v.rule}::${subjectOf(v)}`
     if (seen.has(key)) return true
     seen.add(key)
   }
@@ -138,21 +141,93 @@ const PORTABLE_MARKER = '<root:'
  * rewritten: scrubbing the accepted side let a raw list written for one file match another.
  */
 function isAccepted(
-  accepted: readonly string[],
+  accepted: readonly AcceptedEntry[],
   v: ArchViolation,
   repo: NamedRepository | undefined,
+  ambiguous: ReadonlySet<string> = new Set(),
 ): boolean {
-  return accepted.includes(subjectOf(v)) || accepted.includes(portableSubject(v, repo))
+  // SPIKE 0395: a file-qualified entry, matched only when SPIKE_FQ is on.
+  if (process.env.SPIKE_FQ === 'on') {
+    for (const e of accepted) {
+      if (typeof e === 'string') continue
+      const fileOk = process.env.SPIKE_FQFILE === 'off' || e.file === v.file || (repo !== undefined && e.file === portableTokens(v.file, repo))
+      if (fileOk && (e.subject === subjectOf(v) || e.subject === portableSubject(v, repo))) return true
+    }
+  }
+  const strings = accepted.filter((e): e is string => typeof e === 'string')
+  const hit = strings.includes(subjectOf(v)) || strings.includes(portableSubject(v, repo))
+  if (!hit) return false
+  // SPIKE 0395: SPIKE_FL = match (main) | none | unique
+  const fl = process.env.SPIKE_FL ?? 'match'
+  if (fl === 'none') return carriesOwnFile(v, repo)
+  if (fl === 'unique' || fl === 'unique-coarse') return !ambiguous.has(subjectOf(v)) && !ambiguous.has(portableSubject(v, repo))
+  return true
+}
+
+/** SPIKE 0395: an accepted entry — a subject, or a subject qualified with its file. */
+export type AcceptedEntry = string | { readonly file: string; readonly subject: string }
+
+/** SPIKE 0395: whether a finding's subject names its own file as a whole token (raw or portable). */
+function carriesOwnFile(v: ArchViolation, repo: NamedRepository | undefined): boolean {
+  if (v.file === '') return false
+  const raw = subjectOf(v).split('::')
+  if (raw.includes(v.file)) return true
+  if (repo === undefined) return false
+  return portableSubject(v, repo).split('::').includes(portableTokens(v.file, repo))
+}
+
+/**
+ * SPIKE 0395: the string entries that match findings in more than one file, keyed by the matched
+ * subject form, with the files each matches. Read from the raw findings, before exclusions.
+ */
+function ambiguousEntries(
+  accepted: readonly AcceptedEntry[],
+  raw: readonly ArchViolation[],
+  repo: NamedRepository | undefined,
+): Map<string, Set<string>> {
+  const strings = new Set(accepted.filter((e): e is string => typeof e === 'string'))
+  const files = new Map<string, Set<string>>()
+  for (const v of raw) {
+    for (const form of new Set([subjectOf(v), portableSubject(v, repo)])) {
+      if (!strings.has(form)) continue
+      const set = files.get(form) ?? new Set<string>()
+      set.add(repo === undefined ? v.file : portableTokens(v.file, repo))
+      files.set(form, set)
+    }
+  }
+  for (const [form, set] of files) if (set.size < 2) files.delete(form)
+  return files
 }

 /** The text `deferredWarningAdvice()` returns, by cause. */
 function deferredWarningMessage(
   name: string,
-  cause: 'collision' | 'portable-syntax' | undefined,
+  cause: 'collision' | 'portable-syntax' | 'ambiguous' | undefined,
   acceptedCount: number,
   subjects: readonly string[],
   spelling: readonly string[] = [],
+  ambiguity: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
 ): string {
+  if (cause === 'ambiguous') {
+    const listed = [...ambiguity].map(([entry, files]) => `${entry} (in ${[...files].sort().join(', ')})`)
+    return (
+      `"${name}" is a deferred warning, and ${String(ambiguity.size)} \`accepted\` ` +
+      `entr${ambiguity.size === 1 ? 'y carries' : 'ies carry'} no file but match findings in more ` +
+      `than one file, so the list cannot say which of them was reviewed: ${listed.join('; ')}. ` +
+      `Those findings are errors until each entry names the file it was written for, as ` +
+      `{ file, subject }; a finding in a file you did not review is new: fix it, or review it and ` +
+      `add its own entry.`
+    )
+  }
+  if (cause === 'collision' && process.env.SPIKE_C13 === 'perfile') {
+    return (
+      `"${name}" is a deferred warning, but its findings are not reliably identifiable: two or ` +
+      `more findings in ONE FILE share one subject (rule + element + message, with no producer-set ` +
+      `\`identity\`), so the repair that keeps them distinct assigns a POSITIONAL "#1"/"#2" suffix ` +
+      `within that file — not stable across runs. Every finding here is escalated to error until ` +
+      `this is fixed: qualify the condition's message, or set ArchViolation.identity explicitly.`
+    )
+  }
   if (cause === 'portable-syntax') {
     return (
       `"${name}" is a deferred warning, and portable matching is off for it: these findings' ` +
@@ -214,7 +289,7 @@ abstract class RuleDeclaration {
    * `warn`; anything not in it escalates to `error` in `violations()` — a new
    * finding this list did not accept. See `asSeverity()`'s own doc comment.
    */
-  protected _acceptedWarnings?: readonly string[]
+  protected _acceptedWarnings?: readonly AcceptedEntry[]
   // `protected`, not `private`. `RuleBuilder` declared these `protected` before
   // the single-root refactor and both classes are public exports, so narrowing
   // them is a compile break for an external subclass — the same argument that
@@ -450,7 +525,7 @@ abstract class RuleDeclaration {
    * `accepted` in the same call, which is not a real use case today.
    */
   asSeverity(level: 'error'): this
-  asSeverity(level: 'warn', options?: { accepted?: readonly string[] }): this
+  asSeverity(level: 'warn', options?: { accepted?: readonly AcceptedEntry[] }): this
   asSeverity(level: 'error' | 'warn'): this
   /**
    * Set this rule's severity, returning a COPY — the held builder is never
@@ -464,7 +539,7 @@ abstract class RuleDeclaration {
    * A configuration finding ignores this entirely (`severityFor`): its severity
    * is not the author's to lower.
    */
-  asSeverity(level: 'error' | 'warn', options?: { accepted?: readonly string[] }): this {
+  asSeverity(level: 'error' | 'warn', options?: { accepted?: readonly AcceptedEntry[] }): this {
     const next = this.copy()
     next._severity = level
     next._acceptedWarnings = level === 'warn' ? options?.accepted : undefined
@@ -933,10 +1008,19 @@ export abstract class TerminalBuilder extends RuleDeclaration {
       deferred && !unsafe && !spellsPortableSyntax(raw)
         ? repositoryOf(this.getProject())
         : undefined
+    const ambiguous =
+      deferred && !unsafe && this._acceptedWarnings !== undefined
+        ? new Set(ambiguousEntries(this._acceptedWarnings, raw, repo).keys())
+        : new Set<string>()
     return collectResult(
       filtered.map((v) => ({
         ...v,
-        severity: severityFor(v, unsafe ? 'error' : this.fallbackSeverityFor(v, sev, repo)),
+        severity: severityFor(
+          v,
+          unsafe || (process.env.SPIKE_FL === 'unique-coarse' && ambiguous.size > 0)
+            ? 'error'
+            : this.fallbackSeverityFor(v, sev, repo, ambiguous),
+        ),
       })),
       evidence,
     )
@@ -955,9 +1039,10 @@ export abstract class TerminalBuilder extends RuleDeclaration {
     v: ArchViolation,
     sev: 'error' | 'warn',
     repo: NamedRepository | undefined,
+    ambiguous: ReadonlySet<string> = new Set(),
   ): 'error' | 'warn' {
     if (sev !== 'warn' || this._acceptedWarnings === undefined) return sev
-    return isAccepted(this._acceptedWarnings, v, repo) ? 'warn' : 'error'
+    return isAccepted(this._acceptedWarnings, v, repo, ambiguous) ? 'warn' : 'error'
   }

   /**
@@ -1013,12 +1098,21 @@ export abstract class TerminalBuilder extends RuleDeclaration {
     const raw = this.collectWithAssertionGuard()
     const portableOff = spellsPortableSyntax(raw)
     const repo = portableOff ? undefined : repositoryOf(this.getProject())
+    const ambiguity =
+      process.env.SPIKE_FL?.startsWith('unique') === true ? ambiguousEntries(this._acceptedWarnings, raw, repo) : new Map<string, Set<string>>()
     return deferredWarningMessage(
       described.id || described.rule || this.constructor.name,
-      hasIdentityCollision(raw) ? 'collision' : portableOff ? 'portable-syntax' : undefined,
+      hasIdentityCollision(raw)
+        ? 'collision'
+        : ambiguity.size > 0
+          ? 'ambiguous'
+          : portableOff
+            ? 'portable-syntax'
+            : undefined,
       this._acceptedWarnings.length,
       breaching.map((v) => portableSubject(v, repo)),
       raw.map((v) => subjectOf(v)).filter((subject) => subject.includes(PORTABLE_MARKER)),
+      ambiguity,
     )
   }

```

## Appendix B: the harness

`packages/ts/tests/spike-0395.test.ts` on the same branch. Run from `packages/ts` with `PROBE_OUT` set; the exhaustive block takes `SPIKE_REC`.

```ts
// Spike 0395 harness (throwaway; never merged). Loops over variants by setting process.env,
// which the prototype reads at call time.
import { afterAll, describe, expect, it } from 'vitest'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { functions, modules, checkAll } from '../src/index.js'
import { subjectOf, portableTokens, discoverNamedRepository } from '@nielspeter/eess/internal'
import type { ArchProject } from '../src/core/project.js'
import type { AcceptedEntry } from '../src/core/terminal-builder.js'

const OUT = process.env.PROBE_OUT ?? '/dev/null'
const dirs: string[] = []
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

const base = mkdtempSync(path.join(tmpdir(), 'eess-0395-'))
dirs.push(base)
const repoDir = path.join(base, 'repo')
mkdirSync(path.join(repoDir, '.git'), { recursive: true })
writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify({ name: 'acme' }))
const repo = discoverNamedRepository(repoDir)!

const FN = 'export function parseConfig() {}\n'
type Files = Record<string, string>

function project(files: Files): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const [rel, text] of Object.entries(files))
    tsm.createSourceFile(path.join(repoDir, rel), text)
  return {
    tsConfigPath: path.join(repoDir, 'tsconfig.json'),
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}
const fnRule = (p: ArchProject) =>
  functions(p)
    .that()
    .areExported()
    .should()
    .haveNameMatching(/Handler$/)
    .rule({ id: 'spike/0395' })
const modRule = (p: ArchProject) =>
  modules(p)
    .that()
    .resideInFolder('**/src/**')
    .should()
    .notHaveAliasedImports()
    .rule({ id: 'spike/0395m' })

const VARIANTS: Record<string, Record<string, string | undefined>> = {
  main: {
    SPIKE_FQFILE: undefined,
    SPIKE_VARIANT: undefined,
    SPIKE_C13: 'blind',
    SPIKE_FL: 'match',
    SPIKE_FQ: 'off',
  },
  'EP2·blind·match': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'blind',
    SPIKE_FL: 'match',
    SPIKE_FQ: 'on',
  },
  'EP2·perfile·match': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'perfile',
    SPIKE_FL: 'match',
    SPIKE_FQ: 'on',
  },
  'EP2·blind·none': { SPIKE_VARIANT: 'EP2', SPIKE_C13: 'blind', SPIKE_FL: 'none', SPIKE_FQ: 'on' },
  'EP2·perfile·none': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'perfile',
    SPIKE_FL: 'none',
    SPIKE_FQ: 'on',
  },
  'EP2·blind·unique': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'blind',
    SPIKE_FL: 'unique',
    SPIKE_FQ: 'on',
  },
  'EP2·perfile·unique': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'perfile',
    SPIKE_FL: 'unique',
    SPIKE_FQ: 'on',
  },
  'EP2·perfile·unique-coarse': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'perfile',
    SPIKE_FL: 'unique-coarse',
    SPIKE_FQ: 'on',
  },
  'EP2·none·unique-coarse': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'none',
    SPIKE_FL: 'unique-coarse',
    SPIKE_FQ: 'on',
  },
  'EP2·perfile·unique-coarse·FQ-file-check-deleted': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'perfile',
    SPIKE_FL: 'unique-coarse',
    SPIKE_FQ: 'on',
    SPIKE_FQFILE: 'off',
  },
  // C13 deleted: is the C13 pin non-vacuous under each file-less policy?
  'EP2·none·match': { SPIKE_VARIANT: 'EP2', SPIKE_C13: 'none', SPIKE_FL: 'match', SPIKE_FQ: 'on' },
  'EP2·none·none': { SPIKE_VARIANT: 'EP2', SPIKE_C13: 'none', SPIKE_FL: 'none', SPIKE_FQ: 'on' },
  'EP2·none·unique': {
    SPIKE_VARIANT: 'EP2',
    SPIKE_C13: 'none',
    SPIKE_FL: 'unique',
    SPIKE_FQ: 'on',
  },
}
function use(v: string): void {
  for (const [k, val] of Object.entries(VARIANTS[v]!)) {
    if (val === undefined) delete process.env[k]
    else process.env[k] = val
  }
}

const short = (f: string) =>
  path
    .relative(repoDir, f)
    .replace(/^src\//, '')
    .replace(/\.ts$/, '')
const fq = (f: string, subject: string): AcceptedEntry => ({
  file: portableTokens(f, repo),
  subject,
})

/** The lists, written from `before` under the given variant (main-written or EP2-written). */
function lists(before: Files, rule = fnRule): Record<string, AcceptedEntry[]> {
  const vs = rule(project(before))
    .violations()
    .slice()
    .sort((x, y) => x.file.localeCompare(y.file))
  const FL = vs.map((v) => subjectOf(v))
  const FQ = vs.map((v) => fq(v.file, subjectOf(v)))
  const MX = vs.map((v, i) => (i === 0 ? fq(v.file, subjectOf(v)) : subjectOf(v)))
  return { FL, FQ, MX }
}

function run(after: Files, accepted: AcceptedEntry[], rule = fnRule) {
  const b = rule(project(after)).asSeverity('warn', { accepted })
  const vs = b
    .violations()
    .slice()
    .sort((x, y) => x.file.localeCompare(y.file) || subjectOf(x).localeCompare(subjectOf(y)))
  const sev = vs.map((v) => `${short(v.file)}:${v.severity === 'warn' ? 'W' : 'E'}`).join(' ')
  const ids = vs.map((v) => /#\d+$/.exec(subjectOf(v))?.[0] ?? '·').join(',')
  let red = false
  try {
    checkAll([b])
  } catch {
    red = true
  }
  const advice = b.deferredWarningAdvice()
  const cause =
    advice === ''
      ? '-'
      : advice.includes('more than one file')
        ? 'ambiguous'
        : advice.includes('ONE FILE')
          ? 'collision/file'
          : advice.includes('not reliably identifiable')
            ? 'collision'
            : advice.includes('not in that list')
              ? 'not-in-list'
              : 'other'
  return { sev, ids, red, cause, advice }
}

const SHAPES: Record<string, { before: Files; after: Files }> = {
  'S0 unchanged {a,b}': {
    before: { 'src/a.ts': FN, 'src/b.ts': FN },
    after: { 'src/a.ts': FN, 'src/b.ts': FN },
  },
  'S1 copy {a}->{a,b}': { before: { 'src/a.ts': FN }, after: { 'src/a.ts': FN, 'src/b.ts': FN } },
  'S2 swap {a,b}->{b,c}': {
    before: { 'src/a.ts': FN, 'src/b.ts': FN },
    after: { 'src/b.ts': FN, 'src/c.ts': FN },
  },
  'S3 two then c {a,b}->{a,b,c}': {
    before: { 'src/a.ts': FN, 'src/b.ts': FN },
    after: { 'src/a.ts': FN, 'src/b.ts': FN, 'src/c.ts': FN },
  },
  'S4 0388 {a}->{b}': { before: { 'src/a.ts': FN }, after: { 'src/b.ts': FN } },
  'S5 same-file pair, unchanged {a×2}': {
    before: { 'src/a.ts': FN + FN },
    after: { 'src/a.ts': FN + '// moved\n' + FN },
  },
  'S7 copy beside a unique Y {a:X+Y}->{a:X+Y,b:X}': {
    before: { 'src/a.ts': FN + 'export function loadThing() {}\n' },
    after: { 'src/a.ts': FN + 'export function loadThing() {}\n', 'src/b.ts': FN },
  },
  'S6 same-file pair + copy {a×2}->{a×2,b}': {
    before: { 'src/a.ts': FN + FN },
    after: { 'src/a.ts': FN + FN, 'src/b.ts': FN },
  },
}

describe('spike 0395', () => {
  it('fixture sanity: duplicate declarations in one file give two findings', () => {
    use('main')
    expect(fnRule(project({ 'src/a.ts': FN + FN })).violations()).toHaveLength(2)
  })

  it('the matrix', () => {
    const rows: string[] = []
    for (const [shape, { before, after }] of Object.entries(SHAPES)) {
      use('main')
      const mainLists = lists(before)
      const mainRes = run(after, mainLists.FL!)
      rows.push(
        JSON.stringify({
          shape,
          variant: 'main',
          list: 'FL(main-written)',
          ...mainRes,
          advice: undefined,
        }),
      )
      for (const variant of Object.keys(VARIANTS)) {
        if (variant === 'main') continue
        use(variant)
        const ep2Lists = lists(before)
        const cases: [string, AcceptedEntry[]][] = [
          ['FL(main-written)', mainLists.FL!],
          ['FL(EP2-written)', ep2Lists.FL!],
          ['FQ', ep2Lists.FQ!],
          ['MX', ep2Lists.MX!],
        ]
        for (const [list, accepted] of cases) {
          const r = run(after, accepted)
          rows.push(JSON.stringify({ shape, variant, list, ...r, advice: r.advice.slice(0, 400) }))
        }
      }
    }
    for (const r of rows) appendFileSync(OUT, r + '\n')
  })

  it('path-bearing subjects (modules, aliased import): unchanged and 0388 shape', () => {
    const A = {
      'src/a/index.ts': "import { x as y } from './b'\nexport const a = y\n",
      'src/a/b.ts': 'export const x = 1\n',
    }
    const B = {
      'src/b/index.ts': "import { x as y } from './b'\nexport const a = y\n",
      'src/b/b.ts': 'export const x = 1\n',
    }
    const rows: string[] = []
    for (const variant of Object.keys(VARIANTS)) {
      use(variant)
      const vs = modRule(project(A)).violations()
      const raw = vs.map((v) => subjectOf(v))
      const portable = vs.map((v) => portableTokens(subjectOf(v), repo))
      for (const [list, accepted] of [
        ['raw', raw],
        ['portable', portable],
      ] as const) {
        for (const [shape, after] of [
          ['P0 unchanged', A],
          ['P4 0388', B],
          ['P1 copy', { ...A, ...B }],
        ] as const) {
          const r = run(after, [...accepted], modRule)
          rows.push(JSON.stringify({ shape, variant, list, ...r, advice: undefined }))
        }
      }
    }
    for (const r of rows) appendFileSync(OUT, r + '\n')
  })

  it('Q5: a string spelling "<file>::<subject>" is also a portable subject', () => {
    use('main')
    const A = {
      'src/a/index.ts': "import { x as y } from './b'\nexport const a = y\n",
      'src/a/b.ts': 'export const x = 1\n',
    }
    const [v] = modRule(project(A)).violations()
    const portable = portableTokens(subjectOf(v!), repo)
    const file = portableTokens(v!.file, repo)
    const rest = portable.slice(file.length + 2)
    const stringFq = `${file}::${rest}`
    appendFileSync(
      OUT,
      JSON.stringify({ q5: { portable, file, rest, stringFq, same: stringFq === portable } }) +
        '\n',
    )
  })

  it('Q4: the advice candidates on the 0388 shape, and on the copy', () => {
    const rows: string[] = []
    use('EP2·perfile·unique')
    // 0388: a reviewed, then fixed; b made. A1 builds a file-qualified replacement from where X matches now.
    const before = { 'src/a.ts': FN }
    const [va] = fnRule(project(before)).violations()
    const X = subjectOf(va!)
    const after0388 = { 'src/b.ts': FN }
    const nowMatches = fnRule(project(after0388))
      .violations()
      .map((v) => fq(v.file, subjectOf(v)))
    rows.push(
      JSON.stringify({
        q4: 'A1 replacement from current matches, 0388',
        list: nowMatches,
        ...run(after0388, nowMatches),
        advice: undefined,
      }),
    )
    // A2: qualify with the file you reviewed (a), the only file the author can name truthfully.
    const reviewed = [fq(va!.file, X)]
    rows.push(
      JSON.stringify({
        q4: 'A2 qualify with reviewed file, 0388',
        ...run(after0388, reviewed),
        advice: undefined,
      }),
    )
    // copy: ambiguous advice; A1 vs A2
    const afterCopy = { 'src/a.ts': FN, 'src/b.ts': FN }
    const amb = run(afterCopy, [X])
    rows.push(
      JSON.stringify({
        q4: 'ambiguous advice text, copy',
        cause: amb.cause,
        sev: amb.sev,
        advice: amb.advice,
      }),
    )
    const a1 = fnRule(project(afterCopy))
      .violations()
      .map((v) => fq(v.file, subjectOf(v)))
    rows.push(JSON.stringify({ q4: 'A1 on copy', ...run(afterCopy, a1), advice: undefined }))
    rows.push(JSON.stringify({ q4: 'A2 on copy', ...run(afterCopy, reviewed), advice: undefined }))
    for (const r of rows) appendFileSync(OUT, r + '\n')
  })
})

describe('spike 0395: exhaustive comparison against main', () => {
  it(
    'every before/after over three files, contents in {none, X, XX, Y}',
    { timeout: 600_000 },
    () => {
      const Y = 'export function loadThing() {}\n'
      const opts = ['', FN, FN + FN, Y]
      const states: Files[] = []
      for (const a of opts)
        for (const b of opts)
          for (const c of opts) {
            const f: Files = {}
            if (a) f['src/a.ts'] = a
            if (b) f['src/b.ts'] = b
            if (c) f['src/c.ts'] = c
            states.push(f)
          }
      const tally: Record<string, number> = {}
      const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1)
      const examples: Record<string, string> = {}
      const REC = process.env.SPIKE_REC ?? 'EP2·perfile·unique'
      for (const before of states) {
        use('main')
        const mainVs = fnRule(project(before)).violations()
        if (mainVs.length === 0) continue
        const mainFL = mainVs.map((v) => subjectOf(v))
        use(REC)
        const recVs = fnRule(project(before)).violations()
        const recFL = recVs.map((v) => subjectOf(v))
        const recFQ = recVs.map((v) => fq(v.file, subjectOf(v)))
        // findings reviewed: (file, raw subject) pairs present before
        const reviewed = new Set(
          recVs.map((v) => `${v.file}\u0000${subjectOf(v).replace(/#\d+$/, '')}`),
        )
        for (const after of states) {
          use('main')
          const m = run(after, mainFL)
          const mainWarn = new Map<string, number>()
          for (const v of fnRule(project(after))
            .asSeverity('warn', { accepted: mainFL })
            .violations())
            if (v.severity === 'warn') {
              const k = `${v.file}\u0000${subjectOf(v).replace(/#\d+$/, '')}`
              mainWarn.set(k, (mainWarn.get(k) ?? 0) + 1)
            }
          use(REC)
          for (const [list, acc] of [
            ['FL(main-written)', mainFL],
            ['FL(rec-written)', recFL],
            ['FQ', recFQ],
          ] as const) {
            bump(`${list} cases`)
            const r = run(after, [...acc])
            const key = JSON.stringify(after)
            if (!r.red && m.red) {
              bump(`${list} rec GREEN where main RED`)
              examples[`${list} rec GREEN where main RED`] ??=
                `${JSON.stringify(Object.keys(before))}->${key.slice(0, 200)} main=${m.sev} rec=${r.sev}`
            }
            if (r.red && !m.red) {
              bump(`${list} rec RED where main GREEN`)
              examples[`${list} rec RED where main GREEN`] ??=
                `${JSON.stringify(before)}->${key} main=${m.sev} rec=${r.sev} cause=${r.cause}`
            }
            // per finding: a warn under rec for a finding not reviewed in its own file
            const b = fnRule(project(after)).asSeverity('warn', { accepted: [...acc] })
            for (const v of b.violations()) {
              if (v.severity !== 'warn') continue
              const pair = `${v.file}\u0000${subjectOf(v).replace(/#\d+$/, '')}`
              if (!reviewed.has(pair) && (mainWarn.get(pair) ?? 0) === 0)
                bump(`${list} unreviewed WARN under rec where main ERRORS it`)
              if (!reviewed.has(pair)) {
                bump(`${list} unreviewed finding WARN under rec`)
                if ((mainWarn.get(pair) ?? 0) === 0)
                  examples[`${list} unreviewed WARN where main ERRORS`] ??=
                    `${JSON.stringify(before)}->${key} main=${m.sev} rec=${r.sev}`
                examples[`${list} unreviewed finding WARN under rec`] ??=
                  `${JSON.stringify(before)}->${key} main=${m.sev} rec=${r.sev}`
              }
            }
            if (
              r.cause === 'collision' &&
              !/#\d+$/.test(
                fnRule(project(after))
                  .violations()
                  .map((v) => subjectOf(v))
                  .join('|')
                  .split('|')
                  .find((s) => /#\d+$/.test(s)) ?? '',
              )
            )
              bump(`${list} collision cause with no suffix (false cause)`)
          }
        }
      }
      appendFileSync(OUT, JSON.stringify({ exhaustive: REC, tally, examples }) + '\n')
    },
  )
})
```
