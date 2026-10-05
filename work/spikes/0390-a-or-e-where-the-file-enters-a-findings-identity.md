# Spike 0390: A or E — where the file enters a finding's baseline identity

Measured 2026-10-05 for [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s
Phase 2 and [bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md), at
the maintainer's request ("let's not handwave — investigate or spike") after four reviews split
between the two options.

## The question

A finding with no `identity` is baselined as `rule::element::message`, and the file is not in it,
so a baseline forgives the same finding in any file. Two kernel-level fixes survived review:

- **A — the file enters the fallback subject.** `subjectOf` returns `file::element::message`
  when no `identity` is set (today's form when `file` is empty). Both `hashViolation` copies use
  `subjectOf`.
- **E — the matcher checks the file the entry already stores.** The hash does not change;
  `isKnown`/`hasEntry` also require the entry's recorded `file` to equal the finding's, and
  `disambiguateIdentities` groups per file, so two findings in different files no longer
  collide.

Which one closes the class, what does each break, and what does each cost an adopter's
baseline?

## Method

Three worktrees of `d90ecec`: an unchanged control (M), A, and E. Each has its own
`node_modules` built entry by entry, with the `@nielspeter/*` workspace links copied as
relative links, so each tree resolves **its own** kernel. That was proven before measuring:
each tree's `@nielspeter/eess` realpath is its own `packages/core`, and each built
`dist/violation.js` carries its own variant marker. A whole-directory symlink would have
resolved every tree's kernel to the main checkout and measured nothing.

The two variants are spike code, not the design to ship. A is +7/−6 lines in two kernel files.
E is +42/−6 across both baselines, the kernel's group key and `terminal-builder.ts`'s collision
check. Builds were not timed.

Three instruments:

1. **The probe.** The 12 cross-file cases from bug 0388. Each runs three scenarios:
   - **cross-file:** baseline the finding in `a/`, fix `a/`, make the same finding in `b/`;
   - **unchanged:** re-run the same code against its own baseline;
   - **rename:** move `a/` to `z/`, where the fixture allows it.

   It also covers the `accepted` warning-list path. About 2 seconds of vitest time per tree.

2. **The suites.** The whole-repo vitest run in each tree, about 40 seconds each, compared
   against the control's run in the same environment. The worktrees lack the gitignored root
   `tsconfig.json`, so 22 test files never load in any tree (about 241 tests, some of them on
   the baseline path) and 17 to 19 tests fail in the control, depending on the run. Only the difference from the control
   counts, and **a file that never loads cannot show a difference**: those 22 were not compared.
   The control's tree also held the probe file (4567 tests against A's and E's 4554).
3. **Movement.** A baseline written by the control's code from 400 findings over
   `packages/ts/src` (six rules declared, chosen to produce many identity-less findings; four produced findings:
   `beExported` 291, `extend` 24, `haveMaxExports(2)` 79, `notContain(call('push'))` 6. Files with
   an empty `file` are left out of the reported-new count), then read by
   each tree's code with the source unchanged. Every finding a tree reports as new is an entry
   that tree moved. The control reading its own baseline must report 0, and it does. An
   earlier run reported 400 for the control too: vitest overwrites `process.env.MODE`, so the
   baseline was never written. The control caught that instrument fault before any number was
   used.

## What was measured

### 1. Both close the 12 cases; under both, an `accepted` list still forgives

| scenario                          | M (today)                   | A                        | E                                     |
| --------------------------------- | --------------------------- | ------------------------ | ------------------------------------- |
| cross-file, 12 conditions         | **0 of 12 reported**        | 12 of 12 reported        | 12 of 12 reported                     |
| unchanged code                    | 0 new                       | 0 new                    | 0 new                                 |
| file renamed, 9 conditions        | 0 new (still accepted)      | 1 new each               | 1 new each                            |
| `accepted` list, `b` replaces `a` | `b` stays `warn` (forgiven) | `b` escalates to `error` | **`b` stays `warn` (still forgiven)** |

The `accepted` subject under A is `/proj/src/a/x.ts::handle::handle is not exported`: it now
holds the author's absolute path, which is bug 0389's defect widened to every finding.

### 2. The suites: test churn, and one misread guard

Failures beyond the control's: **15 under A, 9 under E.** They fall in three groups:

- **Expected under both:** tests that pin today's cross-file collision and its `#1` suffix
  (`deferred-warning.test.ts`, `identity-uniqueness.test.ts`). Also 0159's KNOWN-GAP test,
  which flips as designed. **Misread, corrected after review:** under E,
  `deferred-warning.test.ts` · `it('the swap, reproduced with a colliding subject: a genuinely new finding is escalated, not silently absorbed')`
  failed because the new finding was **absorbed** — a false green, not churn. Under A the same
  test fails as churn. Three of A's `identity-uniqueness` failures are within one file and
  belong in the next group: they fail because A changes the subject string.
- **A only — the file now matters to the hash:**
  - `rule-builder-options.test.ts` (4) and `rule-builder-exclusions.test.ts` (1) hand-build a
    baseline with no root and check it under `/project`. A root mismatch that was harmless
    for a path-free finding now reds.
  - This is the portability cost architecture review predicted. It fails closed.
- **E only — the stored file must be in the form E compares:**
  - `baseline-compat.test.ts` · `it('stays green when its entries match, despite the older format')`
    writes a pre-root baseline whose entry `file` is `src/order.ts` for a finding at
    `/anywhere/src/order.ts`. E rejects an entry that still matches.
  - That is a false red on existing baselines whose recorded `file` predates root-relative
    paths, or points outside the root. It fails closed.
- **Both:** `baseline-compat.test.ts` · `it('an explicit root still overrides the recorded one')`.
  An overriding root now changes the answer for a finding that used to be path-free.

### 3. Movement: A moves every identity-less entry; E moves the positional ones

| tree | findings | without `identity` | suffixed `#n` | reported new against the old baseline |
| ---- | -------- | ------------------ | ------------- | ------------------------------------- |
| M    | 400      | 311                | 10            | **0**                                 |
| A    | 400      | 315                | 6             | **315**                               |
| E    | 400      | 315                | 6             | **4**                                 |

A moves 315 of 315 by construction: every entry without an `identity` changes hash, so every
one needs the migration. E (per-file grouping) moves 4: the entries today's code had suffixed
**across files**. They were correct entries on unchanged code, so reporting them costs a
re-accept, not a review. E0, measured later, moves none (see "Review, and E0").

The mechanism is structural: A rehashes everything without an identity; E rehashes only what
today's grouping suffixed across files. The ratio is this sample's: it depends on how often a
codebase repeats names.

## What this changes in the decision

- **E removes most of Phase 3 for this class.** Under A, the migration must replay the old
  grouping, rewrite every entry in both baseline formats, version the kernel baseline and
  refuse regeneration (enforcement's Critical and the four Phase 3 findings). Under E, no hash
  moves except the cross-file positional ones, and those are reported on upgrade with no step to
  get wrong. Phase 1 (0338) still changes identities, so a migration ships either way, but a
  smaller one.
- **E does not close the `accepted` hole.** A list of subjects carries no file, so under E it
  still forgives the same finding in another file. Fixing that means putting the file into what
  `accepted` compares: A's derivation, applied to one consumer. Bug 0389's portable subject is
  the precondition in both cases.
- **E's matching depends on how `file` was recorded.** Older baselines and files outside the root
  give false reds. The file check must be keyed to the baseline's format version, or skipped
  where the recorded form cannot be compared, and the skip must be visible.
- **Both report a renamed file again.** Today a rename is silently still accepted. Under either
  option it costs one re-accept. That is the price of the fix, and it is the same price.

## Review, and E0

Enforcement review of this record (2026-10-06) measured two paths where the E above is
**greener than today**, both caused by its per-file grouping. Grouping per file removes today's
cross-file `#1` suffix, and that suffix is what catches:

- an `accepted` list built from `a` alone, when `b` adds the same finding while `a` stays;
- a baseline entry with no recorded `file`, when `b` adds the same finding.

So **E0** was measured: E's file check in both matchers, with grouping and the collision check
left exactly as today. Same three-tree method, against a fresh control at `a86f9fc`:

| case                                                      | today        | E (per-file grouping) | E0                                      |
| --------------------------------------------------------- | ------------ | --------------------- | --------------------------------------- |
| the 12 cross-file cases                                   | 0 of 12      | 12 of 12              | 12 of 12                                |
| `accepted` from `a`; `a` stays, `b` added                 | both `error` | **both `warn`**       | both `error`                            |
| entry with no `file`; `a` stays, `b` added                | `b` reported | **nothing reported**  | `b` reported                            |
| baseline with no recorded root; `a` stays, `b` added      | `b` reported | `a` and `b` reported  | `a` and `b` reported (false red on `a`) |
| `accepted` from `a`; `a` fixed, `b` added (the 0388 case) | `b` `warn`   | `b` `warn`            | `b` `warn`                              |
| entries moved, 400 findings, unchanged code               | 0            | 4                     | **0**                                   |
| failures beyond the control's                             | —            | 9                     | **3**                                   |

E0's three extra failures are 0159's KNOWN-GAP test (flips as designed) and two in
`baseline-compat.test.ts`: the no-root baseline, and an explicit `root` override. Both are false
reds, and both are settled by deciding which recorded file the matcher can compare, against which
root. The guard tests the per-file version broke pass under E0.

**What these tables do not show.** Every probe here called `isKnown`. Driven through
`filterNew`, E0 also emits a meta-finding in the 0388 case and on a rename that blames an
edited rule and tells the author to regenerate, which forgives the new finding again.
Enforcement review measured it; plan 0346's Phase 2 now requires the diagnosis to name the file.

## Recommendation

**E0 for the baseline matcher, plus A's derivation for `accepted` only** (behind bug 0389's
portable subject). E0 closes the 12, is never greener than today on any path measured, and moves
no entry. The `accepted` change is still needed: under every variant a list of subjects
forgives a fixed-and-replaced finding in another file. The maintainer chose E; E0 is E without
the spike's grouping change.

Not decided here:

- **The no-root baseline's finding.** E0 is not greener than today on it, but it false-reds, and
  whether the finding that says so fails the build is open.
- **Identity-bearing findings that move file.** The check applies to them too; the rename row was
  measured only for findings without an identity.
- **The sibling dialects.** Their suites ran with no extra failures, but no sibling cross-file
  probe was run.

## Reproducing

The variant patches, the probes and the movement test were written for this spike and are **not
in the repo**. Section 1's cases are bug 0388's table, and plan 0346's red tests reproduce them.
**Section 3's movement counts cannot be re-run from the repo**; the rules and filters that
produced them are listed in "Method" so a re-measure can be built. E0 is E's matcher change
alone: `isKnown` and `hasEntry` in both baselines also require the entry's recorded `file`
to equal the finding's (portable form in eess-ts, baseline-relative in the kernel), and an
entry recorded without a file is let through. That last detail is the spike's; plan 0346 makes
it fail closed instead.
