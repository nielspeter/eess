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

The two variants are spike code, not the design to ship. A is 4 changed lines in the kernel. E
is about 40 lines across both baselines, the kernel's group key and `terminal-builder.ts`'s
collision check. All builds took about 5 seconds.

Three instruments:

1. **The probe.** The 12 cross-file cases from bug 0388. Each runs three scenarios:
   - **cross-file:** baseline the finding in `a/`, fix `a/`, make the same finding in `b/`;
   - **unchanged:** re-run the same code against its own baseline;
   - **rename:** move `a/` to `z/`, where the fixture allows it.

   It also covers the `accepted` warning-list path. About 7 seconds per tree.

2. **The suites.** The whole-repo vitest run in each tree, about 40 seconds each, compared
   against the control's run in the same environment. The worktrees lack the gitignored root
   `tsconfig.json`, so about 41 tests fail in all three trees alike; only the difference from
   the control counts.
3. **Movement.** A baseline written by the control's code from 400 findings over
   `packages/ts/src` (six rules, chosen to produce many identity-less findings), then read by
   each tree's code with the source unchanged. Every finding a tree reports as new is an entry
   that tree moved. The control reading its own baseline must report 0, and it does. An
   earlier run reported 400 for the control too: vitest overwrites `process.env.MODE`, so the
   baseline was never written. The control caught that instrument fault before any number was
   used.

## What was measured

### 1. Both close the class; neither forgives a different file

| scenario                          | M (today)                   | A                        | E                                     |
| --------------------------------- | --------------------------- | ------------------------ | ------------------------------------- |
| cross-file, 12 conditions         | **0 of 12 reported**        | 12 of 12 reported        | 12 of 12 reported                     |
| unchanged code                    | 0 new                       | 0 new                    | 0 new                                 |
| file renamed, 9 conditions        | 0 new (still accepted)      | 1 new each               | 1 new each                            |
| `accepted` list, `b` replaces `a` | `b` stays `warn` (forgiven) | `b` escalates to `error` | **`b` stays `warn` (still forgiven)** |

The `accepted` subject under A is `/proj/src/a/x.ts::handle::handle is not exported`: it now
holds the author's absolute path, which is bug 0389's defect widened to every finding.

### 2. The suites: test churn, no false green

Failures beyond the control's: **15 under A, 9 under E.** They fall in three groups:

- **Expected under both:** tests that pin today's cross-file collision and its `#1` suffix
  (`deferred-warning.test.ts`, `identity-uniqueness.test.ts`). Also 0159's KNOWN-GAP test,
  which flips as designed.
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
one needs the migration. E moves 4: the entries today's code had suffixed **across files**. Those
are exactly the positional slots 0388 says may already be inheriting. Reporting them on upgrade is
the fail-closed behaviour Phase 3 was trying to build by hand.

The ratio is structural, not a property of this sample. A rehashes everything without an
identity; E rehashes only what today's grouping suffixed across files.

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

## Recommendation

**E for the baseline matcher, plus A's derivation for `accepted` only** (behind bug 0389's portable
subject). The measured reason is the movement table: E reaches the same 12/12 with 4 entries
moved rather than 315, and the 4 are the suspect ones. A's single-string cleanliness costs a
full-file migration that review found hard to make fail-closed. That decision is the
maintainer's.

The record does not decide two things:

- **The spike's E groups per file inside `disambiguateIdentities`.** That changes the grouping
  key the kernel and `terminal-builder.ts` share. A version that leaves grouping alone moves 0
  entries but keeps cross-file positional suffixes. It was not measured.
- **The sibling dialects.** Only eess-ts suites and baselines were measured. The kernel baseline
  got the same E change and its suites ran (no extra failures in md, mermaid, gherkin or
  crossvalidate), but no sibling cross-file probe was run.

## Reproducing

The variant patches, the probe and the movement test were written for this spike and were not
kept in the repo; the red tests plan 0346 builds replace them. Every change is described in
"Method" above, and the probe fixtures are bug 0388's table.
