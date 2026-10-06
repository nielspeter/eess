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
regenerate that must be reviewed. E0, measured later, moves none (see "Review, and E0").

The mechanism is structural: A rehashes everything without an identity; E rehashes only what
today's grouping suffixed across files. The ratio is this sample's: it depends on how often a
codebase repeats names.

## What this changes in the decision (as first written; superseded by the sections below)

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
  option it costs a reviewed regenerate (eess-ts cannot accept one entry). That is the price of the fix, and it is the same price.

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

## Edits, and E+

Method review then reasoned a cost of E0 that the "unchanged code" movement row cannot see:
with grouping unchanged, a duplicate across files is accepted as `subject#1`, so editing its
siblings shifts it. Measured at `169a591` in four fresh trees (today, E per-file, E0, and **E+**:
E per-file plus `accepted` comparing `file::subject` plus an entry with no recorded `file`
failing closed). Each tree's kernel resolution was proven as before. The baseline holds the same
finding in `a` and `b`:

| edit                                               | today                                  | E (per-file)    | E0                               | E+              |
| -------------------------------------------------- | -------------------------------------- | --------------- | -------------------------------- | --------------- |
| fix `a`; `b` reviewed and unchanged                | nothing                                | nothing         | **`b` reported** + meta          | nothing         |
| fix `b`                                            | nothing                                | nothing         | nothing                          | nothing         |
| add the same finding in an earlier-sorted `0/x.ts` | **`b` reported; the new `0` forgiven** | `0` only + meta | `0`, `a` and `b` reported + meta | `0` only + meta |

And E+ against the paths that made per-file E greener than today:

| case                                                 | today        | E (per-file)    | E+                                  |
| ---------------------------------------------------- | ------------ | --------------- | ----------------------------------- |
| the 12 cross-file cases                              | 0 of 12      | 12 of 12        | 12 of 12                            |
| `accepted` from `a`; `a` stays, `b` added            | both `error` | **both `warn`** | `a` `warn`, `b` `error`             |
| `accepted` from `a`; `a` fixed, `b` added (0388)     | `b` `warn`   | `b` `warn`      | **`b` `error`**: the hole closes    |
| entry with no `file`; `a` stays, `b` added           | `b` reported | **nothing**     | `a` and `b` reported (fails closed) |
| baseline with no recorded root; `a` stays, `b` added | `b` reported | `a` and `b`     | `a` and `b` (see below)             |

Suites, E+ against a fresh control (about 40 s each): 13 extra failures, every one fail-closed or
a format change: in `deferred-warning.test.ts`, 7 (4 because `accepted` lists written in the old
string form now escalate, 3 because the cross-file collision tests no longer collide), the old cross-file `#1` pins (3 in `identity-uniqueness.test.ts`,
including the `taken.add` mutation guard, whose fixtures no longer collide), 0159's KNOWN-GAP
test, and the two `baseline-compat.test.ts` root cases. None is a test that expected red and got
green.

"+ meta" is the description-change meta-finding, "the rule was edited", whose Fix is
"regenerate"; it fires on a new duplicate in another file under every E variant, so no variant is
yet exact on edits.

**The no-root row does not measure a no-root rule.** The probe deleted `root` and loaded the
baseline from a directory where root discovery did not find the in-memory `/proj`, so every file
mismatched by accident. None of these variants has a no-root rule. "Turn the check off" is ruled
out under per-file grouping: that is the C2 path enforcement measured greener than today. The
other options were not measured.

**E+ was then measured greener than today on three more paths** (enforcement review of this
record, against a fresh control at `e1b2909`):

| path                                                                                   | today               | E+          |
| -------------------------------------------------------------------------------------- | ------------------- | ----------- |
| metric finding whose identity omits the file; baseline `a`=3, `b`=10; `a` worsens to 9 | `a` reported        | **nothing** |
| a finding with `file: ''`, same rule and subject as a baselined file finding           | reported            | **nothing** |
| regenerate summary when `a` stays and `b` duplicates it                                | `+1`, "now accepts" | **`+0`**    |

All three have one cause: under per-file grouping the same hash can legitimately appear more than
once, and each consumer keyed by hash alone (the accepted-measurement map, the cross-file
collision that gave `''` its own `#1`, the regenerate delta) changes meaning.

## Where this leaves the decision

No variant is recommended here. Three review rounds each found another path where the variant
then specified forgives something today's code reports, so the maintainer chose (2026-10-06) to
record what is proven and settle the rest in a time-boxed spike at the start of plan 0346's
Phase 2.

**Proven:**

- Checking the file each entry records closes the 12 cases (E, E0, E+).
- A list of `accepted` subjects forgives a fixed-and-replaced finding in another file unless it
  compares the file too (open under today's code, E and E0; closed under E+, measured with
  absolute paths — the portable form is bug 0389's and unmeasured).
- Under per-file grouping, an entry with no recorded `file` must not match a finding that has one
  (under E0 that is a policy choice, not a proof).
- The current diagnosis blames an edited rule and says "regenerate" when a hash matches in
  another file; it must name the file.
- A renamed file is reported again under every E variant (measured for findings without an
  identity).

**Open, for that spike:** E0 (never greener by construction, false reds on edits) against
per-file grouping (right files on edits, still the misattributed meta-finding on a new duplicate,
and every consumer keyed by hash alone must be re-keyed, which nobody has yet listed); the no-root rule; the attribution's discriminator;
identity-bearing and metric findings that move file. (Sibling dialects colliding within one
file is plan 0188's: the kernel `applyFilters` does not disambiguate at all.)

## Reproducing

The variant patches, the probes and the movement test were written for this spike and are **not
in the repo**. Section 1's cases are bug 0388's table, and plan 0346's red tests reproduce them.
**Section 3's movement counts cannot be re-run from the repo**; the rules and filters that
produced them are listed in "Method" so a re-measure can be built. E0 is E's matcher change
alone: `isKnown` and `hasEntry` in both baselines also require the entry's recorded `file`
to equal the finding's (portable form in eess-ts, baseline-relative in the kernel), and an
entry recorded without a file is let through. That last detail is the spike's; plan 0346 makes
it fail closed instead. E+ is the first E (per-file grouping in the kernel's group key and
`terminal-builder.ts`'s collision check) plus two changes: `accepted` compares
`${file}::${subject}`, and an entry with no recorded file does not match.
