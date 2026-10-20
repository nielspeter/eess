# Plan 0532: a baseline entry matches only the file it was written for

## Status

- **State:** Draft — written 2026-10-20 as the third record of
  [plan 0346](./0346-a-finding-is-identified-by-the-code-it-matched.md)'s split ("The split", item 3):
  its Phase 2 build, from [spike 0394](../spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md)'s
  Decision. **It cannot go Ready until [spike 0395](../spikes/0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md)
  has run and decided** what an `accepted` entry without a file does, and how the collision guard
  (census C13) is keyed. Spike 0395 ran on 2026-10-20 and recommends a design (its Recommendation:
  C13 per file, a file-less entry that matches in more than one file escalates the batch, and a
  `{ file, subject }` entry); the coordinating agent has not decided it yet. Everything else here
  is decided, and each decision cites where it was made.
- **Priority:** High — a baseline forgives a finding nobody reviewed. Fix the file you baselined,
  make the same mistake in another file, and the build stays green
  ([bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md), twelve
  conditions measured, one of them `recommended`'s `no-empty-bodies`).
- **Effort:** Large, one PR. The file check in two baselines, per-file grouping and the
  census consumers it re-keys, the no-root finding, the attribution note, and the `accepted` change
  spike 0395 decides. No new public API; several behaviour breaks in two packages.
- **Created:** 2026-10-20
- **Parent:** [plan 0346](./0346-a-finding-is-identified-by-the-code-it-matched.md), which closes
  when its children do.
- **Builds after:** spike 0395. **Before** [plan 0533](./0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md),
  whose migration joins on what this plan defines as a match (plan 0346, "The split", item 3). Both
  merge into the integration branch `release/0346-phase2`, this one first, and the branch reaches
  `main` once (spike 0394, decision 3).
- **Receives:** [bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md),
  which this plan fixes and closes, and **collision 3** of
  [bug 0159](../bugs/0159-violation-identities-collide-across-distinct-findings.md) (the `beImported`
  orphans, one row of 0388), whose KNOWN-GAP test flips. Bug 0159 stays open for collisions 1 and 2.

## Problem

A baseline entry is a hash of `rule::subjectOf(v)`, and for a finding with no `identity` the
subject is `element::message`. The file is not in it, and `isKnown` matches on the hash alone. So
an entry written for `src/a/index.ts` forgives the same finding in `src/b/index.ts`, and the same
holds for any finding whose element and message repeat across files (bug 0388's twelve conditions,
measured 2026-10-05). The `accepted` list of a deferred warning has the same hole, because it is
keyed by subject too (spike 0394, census C16 and row R14).

The maintainer decided on 2026-10-06 that **the baseline matcher checks the file each entry
records** (option E, [spike 0390](../spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md)).
Spike 0394 laid out what that touches and decided the rest. This plan builds it.

## Decisions carried, not re-made

Each is quoted from where it was decided. A builder who finds one wrong against the code records
why in Build notes; this plan does not reopen any of them.

1. **E: the matcher checks the recorded file**, in both the kernel and the eess-ts baselines, for a
   finding whose `file` is not empty (plan 0346, Phase 2; maintainer, 2026-10-06).
2. **Grouping is per file, as EP2** (spike 0394, decision 1): `disambiguateIdentities` groups per
   file (C12), the suffix reservation `taken` is per file (C12a), and every census consumer except
   the collision guard C13 is keyed by `(hash, file)`: the accepted-measurement maps (C3, C10), the
   stale-measurement diagnosis (C4), the description-change diagnosis (C5), the "matched nothing"
   count (C6), the regenerate summary (C7) and `Baseline.size` (C8a). C14, `identityCollisions()`,
   reports a same-file collision with the subject it is grouped on.
3. **C13 and `accepted` wait for spike 0395** (spike 0394, decision 4, reopened 2026-10-07). If 0395
   finds no C13 keying that is both no greener than `main` and free of false causes under EP2,
   decision 1 goes back to the maintainer, and this plan waits with it.
4. **An eess-ts baseline with no recorded root matches nothing** (spike 0394, decision 2; its risk
   accepted by the maintainer, 2026-10-07). The run reports **one** finding per such baseline: an
   `error`, unsuppressable, kept by every filter (no regenerate records it, and neither
   `.excluding()` nor `--changed` drops it; ADR-016, one finding per instrument failure). It names
   the baseline and says to run `--migrate`, which plan 0533 adds.
   - The kernel baseline records no root. Its file check compares `file` relative to the baseline's
     own directory, so it needs none. **Measured first, by this plan:** decision 2's reasoned shape
     (the root is `r` at write, `r/pkg` later gets its own `.git`, and a new finding scrubs to the
     token the old file had). If it forgives, the kernel baseline also records its root and gets
     decision 2, and the break table under Release changes.
   - A kernel-written file read by eess-ts records no root, so decision 2 applies to it.
   - A rootless file read with an explicit `options.root`: this plan decides it, from a
     measurement. Until then decision 2 applies.
   - A recorded root overridden by an explicit `options.root` fails by the file check, which is
     correct (measured under EP2). `baseline-compat.test.ts` ·
     `it('an explicit root still overrides the recorded one')` is rewritten to the rule adopted, and
     its assertion is not weakened to make it pass.
5. **One behaviour for the 0388 case** (spike 0394, Decision). A finding whose hash an entry holds
   for another file is not a match, and C6 does not count it as unmatched. The diagnosis still sees
   the hash hit and reports an attribution note naming both files. It does not report the "matched
   nothing" note, whose first cause is "you upgraded" and whose remedy, regenerate, forgives `b`
   without review (R13). No remedy this plan prints is an unqualified regenerate (plan 0346, Phase 2,
   "Proven").
6. **The attribution** (spike 0394, "What this answers", 4): it reads the findings **before**
   filters, states exactly one cause per finding, and says when a file was not examined (under
   `--changed` or `.excluding()`) instead of calling it "fixed". The prototype's two false-cause
   shapes (a clean new file at a moved file's old path; two copies of which one moved) give their
   true cause. Its "copied" branch exists only under per-file grouping.
7. **Separators** (spike 0394, Decision): `file` is normalised to `/` on write and on read. Not a
   format change.
8. **A finding with an empty `file` keeps `element::message`** and is not checked against a file
   (plan 0346, Phase 2, Preconditions). An entry with no recorded `file` does not match a finding
   that has one (plan 0346, Phase 2, "Proven", under per-file grouping).
9. **`element` stays as it is** (plan 0346, Phase 2): `.excluding()` matches on it, so this plan
   changes what a baseline matches, not what an exclusion sees. That is bug 0387's.
10. **Every red test drives `filterNew` or `check({ baseline })`**, never `isKnown` alone (plan
    0346, Phase 2, "Proven": the spike's first probes called `isKnown` and missed the
    description-change finding).
11. **The guard is structural, not a list** (plan 0346, Phase 2): a property test that two findings
    differing only in `file` are distinct to the matcher **across runs** (baseline one, present only
    the other, require it reported), plus a check that a producer-set identity for a finding about a
    file names it. Each pin also asserts zero `identityCollisions()` for its rule, with plan 0346's
    three conditions (its own denominator; filtered on `rule`; within-run only).
12. **The `--migrate` the advice names is plan 0533's.** Between the two merges the branch's
    no-root finding and the attribution name a command that does not exist yet; this plan's ledger
    records that `deferred→` plan 0533, not as done (spike 0394, decision 3).

## Phases

All in one PR, into `release/0346-phase2`.

**Phase 0: the integration branch, and its tag guard.** Create `release/0346-phase2` from `main`.
Spike 0394's decision 3 notes that `publish.yml` publishes any `v*` tag from any branch and that
nothing gates "no tag from the integration branch", and says the build _may_ gate it cheaply. **This
plan does:** `publish.yml` refuses a tag whose commit is not an ancestor of `origin/main`. Decided
here (2026-10-20) under ADR-009 rule 1: the window opens when this plan merges into the branch, and
a rule nothing gates is the hold decision 3 replaced because it was not gated.

**Phase 1: the file check.** Both matchers (C1 `Baseline.isKnown` in eess-ts, C9 in the kernel)
compare the entry's recorded `file` with the finding's, after separator normalisation. The kernel
loader reads `file` (today it reads `hash` and `measured` only). `hashViolation` and the grouping
key share one definition: `terminal-builder.ts`'s re-spelled group key moves to the kernel's shared
function (plan 0346, Phase 2, Preconditions).

**Phase 2: per-file grouping and the re-keyed consumers.** C12 and C12a per file; C3, C4, C5, C6,
C7, C8a and C10 keyed by `(hash, file)`; C14's subject. The `taken.add` guard and the bug-0065 pins
move to same-file fixtures (spike 0394, "Review, and EP2": the reservation test must hold three
colliding findings in one file, or it goes vacuous).

**Phase 3: the no-root rule.** Decision 4 above, with its kernel measurement first and the
`options.root` measurement.

**Phase 4: the diagnosis.** The attribution note (decisions 5 and 6), and `renamedRuleFor`'s lookup
keyed by `(subject, file)` so a hash match in another file no longer reads as "the rule was
renamed".

**Phase 5: `accepted` and C13, as spike 0395 decides.** Including one spelling for a
file-qualified entry, aligned with bug 0389's `<root:NAME>/path` portable form, and the
`asSeverity` TSDoc that documents it.

**Phase 6: the docstrings and comments EP2 makes false** (spike 0394, Decision):
`hasIdentityCollision`'s (its text waits for 0395); `disambiguateIdentities`' "theorem" that no
existing entry moves; the `identity` contract in `packages/core/src/violation.ts`, which becomes
unique per rule **and file**; and the two "rule + file" comments in
`packages/ts/src/helpers/baseline.ts` and `packages/core/src/baseline.ts`, which say what the hash
covers.

**Phase 7: the non-vacuity row.** A new row in `scripts/check-nonvacuity.mjs`, the first for the
baseline **filter** (plan 0346, Success): baseline finding X in file `a`, remove it, plant the same
finding in file `b`, and require `b` reported. Delete the file check and the fixture reds. Plan 0533
adds the same-file case for its shape identity.

## Files Changed

| file                                                                                                             | change                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `.github/workflows/publish.yml`                                                                                  | refuse a tag whose commit is not an ancestor of `origin/main`                  |
| `packages/core/src/baseline.ts`                                                                                  | the file check (C9), `file` loaded, per-file ceilings (C10), the comment       |
| `packages/core/src/violation.ts`                                                                                 | per-file grouping (C12, C12a), C14's subject, the `identity` contract, theorem |
| `packages/ts/src/helpers/baseline.ts`                                                                            | the file check (C1), C3, C4, C6, C7, C8a, the no-root finding, the comment     |
| `packages/ts/src/helpers/baseline-diagnostics.ts`                                                                | `renamedRuleFor` (C5), the attribution note, C6's note not firing on a hit     |
| `packages/ts/src/core/terminal-builder.ts`                                                                       | the shared group key; `accepted` and C13 as spike 0395 decides; TSDoc          |
| `packages/ts/tests/core/deferred-warning.test.ts`, `identity-uniqueness.test.ts`, `a-baselined-orphan-*.test.ts` | rewritten or flipped as the Test inventory says                                |
| `packages/ts/tests/helpers/baseline-compat.test.ts`                                                              | the `options.root` row, rewritten to the adopted rule                          |
| new test files under `packages/ts/tests/helpers/` and `packages/core/tests/`                                     | the rows below                                                                 |
| `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/`                                                            | the baseline-filter row and its fixture                                        |
| `.changeset/*.md`                                                                                                | two, marked `**Breaking**` (Release)                                           |

## Test inventory

Spike 0394's harness rows are ported into the suites, through the public baseline API on a real
repository on disk. Each row names the way to fail it exists for (its break class); each is
planned as a sabotage row whose mutant must turn it red.

| break class (mechanism)                  | the test that must go red                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the file check, eess-ts (C1)             | R1: each of bug 0388's twelve conditions, fix `a`, the same finding in `b`, `b` reported, through `check({ baseline })`                                                                          |
| the file check, kernel (C9)              | R1's kernel half (R15), through the kernel's `withBaseline().filterNew`; covers C11 by the baseline it generates                                                                                 |
| the structural guard                     | two findings differing only in `file`, baselined one, the other presented alone in a second run: reported; and a producer-set identity for a finding about a file names it                       |
| per-file reservation (C12a)              | `it('a generated suffix never lands on a subject a producer already emits')`, rewritten to three colliding findings in one file; mutant deletes `taken.add`                                      |
| per-file grouping (C12)                  | R3 and R4: `b` stays forgiven when `a` is fixed; adding the same finding in an earlier-sorted file reports only the new one                                                                      |
| per-file ceilings (C3, C10)              | R5's shape: a metric ceiling that worsened in `b` is reported against `b`'s ceiling; mutant reverts the map to hash keys                                                                         |
| stale measurement (C4)                   | `a`'s own change of unit is reported stale, and `b`, which shares its hash, is not                                                                                                               |
| description change (C5)                  | the same subject in two files, one renamed: only that one is diagnosed                                                                                                                           |
| "matched nothing" (C6)                   | R13's shape: the note does not fire; with every entry stale and no hash hit anywhere, it does                                                                                                    |
| regenerate summary (C7)                  | R7: `+1`, not `+0`                                                                                                                                                                               |
| `Baseline.size` (C8a)                    | two entries sharing a hash count as two                                                                                                                                                          |
| C14's subject                            | a same-file collision is reported with the subject it is grouped on                                                                                                                              |
| the no-root rule                         | a rootless baseline, unchanged code, two or more entries: no entry matches, exactly one `error` names `--migrate`; it survives `.excluding()` and `--changed`; regenerate omits it; two give two |
| the 0388 note                            | R13's shape: a note is present, names the recorded file and the current one, and neither lists "you upgraded" nor advises regenerating                                                           |
| the attribution                          | the three plain shapes each attributed; review's two false-cause shapes give the true cause; one cause per finding; a file not examined is called that; each remedy, applied, clears it          |
| separators                               | a baseline written with `\` in `file` matches the same finding on POSIX                                                                                                                          |
| an entry with no `file`                  | R8: it matches neither `a` nor `b`                                                                                                                                                               |
| an empty `file` finding                  | R6: reported against a file's entry                                                                                                                                                              |
| renames (R12)                            | a renamed file's plain, identity-bearing and metric findings are each reported again                                                                                                             |
| 0159 collision 3                         | `a-baselined-orphan-forgives-the-next-one.test.ts` flips from KNOWN GAP to a pin that the next orphan is reported; flipped, not deleted                                                          |
| C13 and `accepted`                       | named by spike 0395                                                                                                                                                                              |
| the publish guard                        | a dry run of the guard's step on a commit not reachable from `origin/main` exits non-zero (Build notes record the run)                                                                           |
| the baseline filter (`check:nonvacuity`) | Phase 7's row reds with the file check deleted                                                                                                                                                   |

**Rewritten, not routine** (spike 0394, "Review, and EP2"): `identity-uniqueness.test.ts`'s two
`beImported` rows pinned the cross-file `#1` suffix that per-file grouping removes; they are
rewritten to the per-file values. `deferred-warning.test.ts` ·
`it('two same-named violations across files collide onto bare + "#1"')` is rewritten to a same-file
fixture, or replaced as spike 0395 decides for C13.

**Sabotage matrix.** One row per line of the table above, each mutant reverting that mechanism
alone, run once in a worktree after the commit (never `git stash`), with results recorded here.
Census items C2, C8 and C11 have no row of their own: C2 is read only through C5 and C6, C8 through
every row, C11 through R1's kernel half (spike 0394, Decision).

## Release

On `0.x` a break is a `minor`, marked `**Breaking**`, and a break in a package others depend on
names them (bugs 0184, 0185). From spike 0394's break table; **the text is not frozen until spike
0395 rules:**

| package               | breaks                                                                                                                                                                                                             | names                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nielspeter/eess`    | the kernel baseline stops forgiving a finding in another file; `disambiguateIdentities` groups per file; `identity` may repeat across files for one rule; `Baseline.size` counts entries, not distinct hashes      | `eess-ts`, `eess-mermaid`, `eess-md`, `eess-gherkin`, `eess-crossvalidate`: "unchanged unless you pass a baseline to `check`, or use the kernel's `withBaseline` directly" |
| `@nielspeter/eess-ts` | cross-file forgiveness stops; entries suffixed across files move (`--migrate`, plan 0533, carries them); a rootless baseline matches nothing; `Baseline.size` as above; and what spike 0395 decides for `accepted` | —                                                                                                                                                                          |

The release's migration page belongs to plan 0533 (spike 0394, Decision), and covers what this
plan changes too.

## Out of scope

- **`--migrate`, the `HASH_VERSION` bump and the refusal to regenerate over an older version**:
  plan 0533.
- **The shape identity for an unnamed match**: plan 0533 (bug 0338).
- **Sibling dialects merging collisions within one file** (C15): the kernel `applyFilters` never
  runs `disambiguateIdentities`. [Plan 0188](./0188-unify-the-duplicated-engine-modules.md)'s
  (spike 0394, census).
- **Collisions 1 and 2 of bug 0159**: positional across runs in producers this plan does not touch;
  they stay in bug 0159.
- **What `.excluding()` matches**: bug 0387 and spike 0386.
- **The root scrub inside a path**: bug 0391. The file check separates bug 0391's headline pair
  (two files, one scrubbed identity), because `BaselineEntry.file` is written by `toPortablePath`
  and not by the scrub; reasoned from the code on 2026-10-20, not measured. A same-file pair whose
  messages differ only inside a path stays open there.
- **Windows paths and a real `git worktree`**: not measured by spike 0394; separator normalisation
  is the only Windows claim this plan makes.

## Progress ledger

- [ ] spike 0395 has decided C13 and `accepted`, and this plan's Phase 5 and Release text are
      written from it, before Ready — the spike ran 2026-10-20; its recommendation and what it
      changes here are in its sections "Recommendation" and "What this changes in plans 0532 and
      0533". Open until the coordinating agent records a Decision there
- [ ] Phase 0 — `release/0346-phase2` created; the publish guard and its dry run
- [ ] Phase 1 — the file check in both baselines; one shared group key
- [ ] Phase 2 — per-file grouping; every census consumer but C13 keyed by `(hash, file)`; the
      `taken.add` and bug-0065 pins on same-file fixtures
- [ ] Phase 3 — the no-root finding; the kernel `rediscover` shape measured, and the decision it
      forces recorded; the rootless `options.root` case measured and decided
- [ ] Phase 4 — the attribution note, one cause per finding, and no "matched nothing" note on a
      hash hit
- [ ] Phase 5 — `accepted` and C13 as spike 0395 decides
- [ ] Phase 6 — the three docstrings and two comments say what the code does
- [ ] Phase 7 — the baseline-filter row in `check:nonvacuity`
- [ ] the sabotage matrix run, every row red, recorded here
- [ ] bug 0388 closed, with the no-root rule's residual named in it; bug 0159's collision 3 recorded
      as fixed, its KNOWN-GAP test flipped, and its pointer narrowed to this plan for that collision
- [ ] `--migrate` named by the no-root finding and the attribution exists — deferred→ plan 0533
- [ ] two changesets, `**Breaking**`, the kernel's naming its dependents
- [ ] `npm run validate` green at the PR's head

Deferred: `--migrate` → plan 0533.
