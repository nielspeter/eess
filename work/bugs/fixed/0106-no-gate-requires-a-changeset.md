# Bug 0106: nothing requires a changeset, so a feature can merge green and be unreleasable — `gherkin-ts` is the live instance

## Status

- **State:** Fixed — `check:release` gates three rules, proven non-vacuous by
  `scripts/nonvacuity/bad-release.mjs` (pure core) and `bad-release-e2e.mjs` (the
  real script against real repositories); the `gherkin-ts` changeset is written.
  A six-persona review found four blockers in the first version and four false
  claims in this record; both are recorded below rather than edited away.
- **Severity:** High — an adopter's first run is broken. A whole public binding
  is on `main`, gated in CI, documented in the package README, and unreachable
  from any published version. (The releasability half decayed to Medium between
  filing and fix, by accident — see _Fix_ part 1. The missing gate did not.)
- **Origin:** **inbound** — filed by an agent in an external project during its
  first downstream consumption of `@nielspeter/eess-crossvalidate@0.1.2`, and
  adopted here on 2026-08-12 after verification. **Split on intake:** as filed it
  bundled the missing gate with the act of publishing, which cannot land in a PR
  — see _Scope_.
- **Reported:** 2026-08-12

## Symptom

`packages/crossvalidate/src/gherkin-ts.ts` is on `main` — 244 lines, with tests,
an `exports` entry, and its own README section. It is in no published version.
`0.1.2` is `latest` and does not carry it:

```bash
$ npm view @nielspeter/eess-crossvalidate versions
[ '0.1.0', '0.1.1', '0.1.2' ]

$ npm view @nielspeter/eess-crossvalidate@0.1.2 exports
./mermaid-ts  ./md-ts  ./md-mermaid  ./files  ./md-gherkin  ./md-mermaid-er
#  ← no ./gherkin-ts; local main declares seven subpaths, published has six
```

An adopter importing the documented path gets a hard resolution failure:

```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './gherkin-ts' is not
defined by "exports" in …/node_modules/@nielspeter/eess-crossvalidate/package.json
```

The same lag hit the README: `./md-gherkin` **is** exported and shipped in
`0.1.2`, but the section documenting it landed in the later commit, so the
published package also ships one binding no reader of its README can discover.

## Reproduction

```bash
ls .changeset/                # → config.json, README.md — no pending changesets
npx changeset status          # → NO packages to be bumped at patch/minor/major
git show --stat a7b36ae       # → src/gherkin-ts.ts (+244), package.json exports,
                              #   README, tests … and no .changeset/ entry
```

`npm run release` (`changeset publish`) is therefore a no-op for this package,
today and on any future run, until a changeset exists.

## Root cause

Releases run on Changesets (`.changeset/config.json`; root scripts
`version-packages` → `changeset version`, `release` → `changeset publish`). Under
that model a package's `version` field legitimately stays at the **last released
value** until `changeset version` runs — so `packages/crossvalidate/package.json`
reading `0.1.2` while `main` holds post-0.1.2 code is correct behaviour, not the
defect. All six packages currently match their published versions exactly, which
is the model working as designed.

The defect is that commit `a7b36ae` ("feat(crossvalidate): gherkin↔ts
scenario-test binding + live gate", #15) added a feature **without adding a
changeset**. With no changeset, `changeset version` never bumps the package and
`changeset publish` never publishes it. The work is complete and invisible to the
release pipeline at the same time.

This is a deviation from practice, not the norm — earlier feature commits carried
theirs (`2f219de feat(ts): ts-archunit parity…` touched `.changeset/*.md`).
Nothing enforced it, so the one time it was forgotten, nothing said so.
`crossvalidate` is the only package with src changes since the last release, so
the gap is a single instance rather than a backlog.

## Why it matters

Changesets deliberately decouples the working tree's version from what is
published. That is a good trade, but it removes the most obvious signal that a
feature has not shipped: **the source looks released.** A reader of `main` —
human or agent — sees `version: 0.1.2` beside `gherkin-ts.ts` and reasonably
concludes that `npm i @nielspeter/eess-crossvalidate@0.1.2` delivers it. That
inference is what happened downstream, and the build failed at the first import.

This repo's premise is that a green gate means something. A PR that adds a public
API, passes every gate, merges, and can never reach a consumer is that premise
failing at the release boundary rather than the code boundary — the one boundary
none of our gates watch.

## Correction — this record's own exemption clause was wrong

As filed, the Fix below carried the clause: _"Docs-only and test-only PRs must be
exempt, so the gate does not train anyone to add empty changesets."_ That is
**contrary to the manifesto's load-bearing move**, and it is recorded here rather
than quietly deleted.

[`docs/manifesto.md:418`](../../../docs/manifesto.md) — _Declare the tier, gate on
the declaration_:

> The gate fails on a MISSING declaration — not on low hardness. […] It converts
> the unchecked surface from unknown into a queryable list.

A changeset **is** a declaration: this package changed, at this level, for this
reason. A path-based exemption makes the _tool_ decide which changes are
releasable, and buries that judgment where no reader can audit it — the unchecked
surface stays unknown, which is the thing the principle exists to prevent. It is
also wrong the first time a fixture lands under `packages/*/src`.

`changeset add --empty` is not the ritual to avoid. It is the exact analogue of a
Tier-5 clause declaring `mechanism: governance` — declining hardness, _declared_,
in a file, auditable. So the gate demands a declaration for every changed package
and takes "nothing to release here" as a valid one.

Measured before deciding, on a throwaway worktree off `main`
(`changeset status --since=main`):

| change                                 | exit | wanted under the filed clause | wanted under the principle |
| -------------------------------------- | ---- | ----------------------------- | -------------------------- |
| `packages/core/src/index.ts`           | 1    | 1                             | 1                          |
| `docs/manifesto.md`                    | 0    | 0                             | 0                          |
| `packages/core/tests/*.test.ts`        | 1    | **0**                         | 1                          |
| root `README.md` / root `package.json` | 0    | 0                             | 0                          |

Changesets counts any file under a package directory as a change to that package.
The filed clause could not be implemented without a second, private definition of
"changed package" sitting beside the one changesets uses. The gate now shares
changesets' definition exactly, and has no exemption table.

## What this evidences — the repo's first Diff-mode gate

Every gate in `scripts/` today asks the **Drift** question, and the manifesto
names it as such ([`docs/manifesto.md:567`](../../../docs/manifesto.md)):

> **Drift — reactive.** Do current spec and current code agree? Trigger: CI run,
> post-merge. Output: pass or fail. _This is the gate._

"Every **changed** package has a changeset" is not that question. It is the other
one ([`docs/manifesto.md:577`](../../../docs/manifesto.md)):

> **Diff — proactive.** If I make this change, what else must change? […] One
> engine, two invocations: Drift: `validator(current) → violations`; Diff:
> `validator(proposed) − validator(current) → required follow-ups`.

No gate in `scripts/` or `kit/scripts/` reads git today, so this is the first
**gate** to ask a diff-shaped question. It is not, as the first version of this
record claimed, a capability nobody has built — `packages/core/src/diff-aware.ts`
already shells out to git for it, with the opposite failure posture; see
_Corrections_ (3). Nor is it the manifesto's Diff mode in the strict sense: that
is `validator(proposed) − validator(current)`, two runs differenced, whereas this
is a Drift correspondence whose right-hand **selection** is derived from a diff.
Recorded as evidence, not acted on: generalising "changed since a base ref"
belongs in a proposal that reconciles with `diffAware`, not smuggled into a bug
fix. This record builds the one-off and says so.

## Fix

Both parts are files, and files merge.

**1 — Add the missing changeset.** A `minor` for `@nielspeter/eess-crossvalidate`
(`gherkin-ts` is additive).

Its purpose has narrowed since filing, and the record should say so. PRs #42 and
#43 each left a changeset for `@nielspeter/eess-crossvalidate`, so the package is
now pending a minor bump and `gherkin-ts` **will** ship on the next release
regardless. That is luck, not a fix. What remains is changelog honesty: without
this entry a whole public binding enters the registry described only by two notes
about title-grammar bugs. The releasability half of the symptom is closed by
accident; the "the changelog looks complete" half is not.

**2 — Gate it, so it cannot recur** — as a rule, in the house form.

The gate is a `correspondence()`, and there is exact precedent for its shape:
[`spec.rules.ts:72`](../../../spec.rules.ts) already binds a set of markdown
documents making claims about packages to the workspace itself, in both
directions, with per-side `suggest`. `.changeset/*.md` ↔ packages is the same
correspondence with different sides. It runs from a thin script that owns
reporting and prints its own denominator, exactly as
[`scripts/check-ledger.mjs`](../../../scripts/check-ledger.mjs) does over
`honestyAtClose` + `ledgerStats` — the pattern the gated `check:*` scripts share,
and the one the ungated ones (`check:integrity`, `check:docs-code`) do not.

Three rules. The last two need no base ref, so a run with no diff still checks
something and says which half it skipped:

| rule                                      | direction       | holds when                          |
| ----------------------------------------- | --------------- | ----------------------------------- |
| `release/changed-package-needs-changeset` | `right-to-left` | a changed package declares a bump   |
| `release/changeset-names-real-package`    | `left-to-right` | every changeset names a real one    |
| `release/unparseable-changeset`           | —               | every file in `.changeset/` is read |

The third exists because of how the first version failed: it hand-rolled a
frontmatter regex, and any file that regex could not read was promoted to a
`--empty` waiver. Inability to read a declaration was treated as the _strongest_
declaration. The parse now delegates to `@changesets/parse` — the same parser
`changeset version` uses, so there is one definition of a changeset — and a file
it rejects is a finding, never a waiver.

**Waivers.** An empty changeset is the author declaring "this ships nothing", and
it is honoured — but only when the file is in this diff, and the summary names
the packages left unchecked rather than printing a ✓ over them. For a mixed
change the precise tool is `'@pkg': none`, which declares per package instead of
blanketing the run.

**Release commits.** `changeset version` deletes the changesets it applies, so a
release commit is a diff full of bumped packages with nothing pending. The gate
reads the consumed files back out of the base ref and credits them; without that
it reddened `npm run release`, which is `validate && changeset publish`, and the
publish could never be reached.

The base ref is required, not optional: `EESS_RELEASE_BASE` (a hard error if set
and unresolvable — an explicit override is a promise, not a hint), else
`GITHUB_BASE_REF`, else `origin/main`, else `main`. `actions/checkout` defaulted
to depth 1, where `origin/main` does not exist, so `fetch-depth: 0` is part of
this fix, and the hard error is what makes a future regression of it loud instead
of silently green.

Worth considering alongside, and close to what
[0092](../0092-integrity-gate-misses-three-packages.md) already edits: assert that
every subpath in a package's `exports` resolves to a file the `files` field will
actually publish. Recorded, not done here — it would not have caught this bug
(the local `exports` was correct; only the published one lagged), so it is a
separate claim rather than part of this one.

## Scope

**Publishing is not part of this bug.** As filed, the fix ended in
`npm run version-packages && npm run release` and the verification asked for
`npm view` to list a new version — a post-merge rung that
[BUGS.md](../BUGS.md#when-is-a-bug-fixed) forbids, and which would hold this
record open indefinitely.

The publish is re-homed to plan
[0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md), which already owns
the acts that cannot land in a PR and whose Phase 1 is the coordinated
six-package release. The changeset this bug adds is what that phase will
consume.

**Open question the review raised, and this record does not settle.** 0100 runs
"after both 0088 and 0089 have merged", and its Phase 1 is a _six-package_
release because kernel 0.2 → 0.3 is a contract break at 0.x. Nothing about
`gherkin-ts` needs that coupling — measured: `packages/crossvalidate` depends on
`@nielspeter/eess: ^0.2.0`, satisfied by the **published** 0.2.1, and its peers
are all `>=0.1.1` and published. A crossvalidate-only `changeset version &&
changeset publish` would ship `0.2.0` today and touch nothing the fold owns.

So the adopter who filed this bug stays broken until a release gated on a fork
retirement in another repository, and this record says `Fixed`. The gate half is
genuinely fixed and closes here; whether to cut a standalone crossvalidate
release now is a release-cadence decision, which is not a bug's to make. Stated
so it is visible rather than buried in a deferral.

## Verification

- [x] Red first: all three rules proven by `scripts/nonvacuity/bad-release.mjs`
      as an exact (rule, element) set, plus the clean direction staying silent
      and the printed denominator being right.
- [x] The impure shell is proven too — `scripts/nonvacuity/bad-release-e2e.mjs`
      runs the real script against nine throwaway repositories: a rename out of a
      package, a non-ASCII path, a deleted package, a stale waiver, a waiver in
      the diff, a release commit, and a release commit bumping something no
      changeset named. 21 of 21 mutations rejected across both halves.
- [x] No exemption table — the gate shares changesets' definition of a changed
      package, and `--empty` is an accepted declaration. (The filed clause
      demanding path exemptions is retained above as a correction, not
      implemented.)
- [x] The base ref is required and named in the summary line, so "nothing
      changed" and "I could not resolve a base" are not the same output
      ([0120](../0120-no-state-and-cannot-find-it-are-the-same-answer.md)'s lesson,
      applied before the bug instead of after it). `ci.yml` gets `fetch-depth: 0`.
- [x] Four gate rows in `scripts/check-nonvacuity.mjs` — one per rule, one for
      the shell — so `gateCoverage` claims `check:release` and no row can be
      deleted silently.
- [x] `npx changeset status` reports `@nielspeter/eess-crossvalidate` pending a
      minor bump — true before this fix by accident (PRs #42, #43); the changeset
      added here is what makes `gherkin-ts` appear in the changelog.
- [x] `npm run validate` green.

**What the gate rows prove.** `bad-release.mjs` drives the pure core with
synthetic data — parser shapes, the path→package mapping, the three rules as an
exact (rule, element) set, and the printed denominator.
`bad-release-e2e.mjs` runs the **real script** against nine throwaway git
repositories and asserts its exit code and what it named. Measured: 21 of 21
mutations rejected, 11 in the core and 10 in the shell.

## Corrections — four claims in the first version of this record were false

The first version of this fix shipped a review round's worth of over-claiming,
recorded here rather than edited away, because the record is the artifact that
persists.

1. **"The `git diff` invocation itself is the one uncovered line."** It was not.
   The whole 192-line shell was uncovered — declaration parsing, waiver
   detection, workspace discovery, base resolution, and the exit code. A mutation
   matrix put the pure core at 11 of 11 caught and the shell at **0 of 7**,
   including deleting the `process.exit(1)` on the last line, which leaves a gate
   that reports every violation and fails no build. `gateCoverage` printed "every
   `check:*` accounted for" over that. The split into pure and impure halves was
   made precisely so the logic could be fixtured, and then the quality of the
   tested half was allowed to stand for coverage of the whole — stated as a
   _limit_, which reads as rigour. That is this project's own failure mode,
   committed inside the gate built to prevent it. Fixed by `bad-release-e2e.mjs`
   and a fourth gate row.

2. **"The gate is never a no-op."** True of the ghost-declaration rule, false of
   the changed-package rule: when `merge-base` equals `HEAD` there is no diff to
   read, which is the shape of **every push to `main`**. It printed
   `0 packages — nothing to declare`, the same sentence a genuinely empty diff
   prints — [0120](../0120-no-state-and-cannot-find-it-are-the-same-answer.md)'s
   exact collision, in the record that cites 0120 for having learned it. The gate
   now says `base is HEAD — the changed-package rule did not run`, and CI runs it
   on `pull_request` only, where it has something to read.

3. **"No gate in `scripts/` or `kit/scripts/` reads git today. So this is the
   first concrete instance of a capability the manifesto specifies and nobody has
   built."** The first sentence holds; the conclusion does not.
   `packages/core/src/diff-aware.ts` ships `diffAware()`, publicly exported, and
   it shells out to `git diff --name-only <base>...HEAD` for this same question.
   It matters behaviourally, not just editorially: `diffAware` warns and reports
   **everything** when git fails, this gate hard-errors — two git-diff semantics
   with opposite failure postures in one repo, neither citing the other. The
   deferred proposal below is therefore scoped "reconcile with `diffAware`", not
   "build from scratch".

4. **"A waiver is a file in the diff, and the summary names it, so it is
   countable rather than silent."** The first half was false: `blanketWaivers`
   came from a disk scan of `.changeset/` with no relation to the diff. Because
   pending changesets accumulate until `changeset version`, one `--empty` merged
   by any PR silenced the changed-package rule for **every subsequent PR** until
   the next release — weeks — and never appeared in the diffs it was silencing.
   The gate now honours a waiver only when the file is in this diff, and prints
   the packages it left unchecked instead of "every changed package is declared".

5. **Found after merge, in the shipped gate: an uncommitted change was invisible
   when the base was `HEAD`.** The diff side short-circuited on
   `merge-base === HEAD` and reported `0 changed packages`. But
   `git diff <mergeBase>` compares against the **working tree**, so it still sees
   uncommitted work — and `merge-base === HEAD` is the shape of every local run
   on a fresh branch before the first commit, which is precisely when the
   reminder is wanted. It surfaced on this gate's own follow-up branch: the gate
   printed `0 changed of 6` while `packages/core/src/execute-rule.ts` sat
   modified in the tree. `changedFiles` is now always computed, and "nothing to
   read" is claimed only when the base is HEAD **and** the tree is clean. Two
   end-to-end scenarios cover both halves. Fixed in #47.

Two further defects the round found, both fixed and neither previously claimed:
`changeset version` consumes the changesets it applies, so a release commit
showed bumped packages with zero declarations — **the gate blocked the release it
exists to enable**, and `npm run release` could never have reached
`changeset publish`. And the hand-rolled frontmatter regex diverged from
changesets' own parser on five shapes, each of which was then promoted to a
blanket waiver; `'@pkg': none` — a valid bump type meaning "no release,
recorded" — meant the most honest changeset a contributor can write switched the
gate off. Both now covered by end-to-end scenarios.

Deferred:

- **The actual release, and the adopter-facing checks that only a release can
  satisfy** (`npm view` lists the new version, a clean project can import
  `@nielspeter/eess-crossvalidate/gherkin-ts`, the published README documents
  every shipped subpath including `md-gherkin`) — deferred→plan
  [0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md) Phase 1.
- **Generalising "changed since a base ref" into a reusable Diff-mode
  primitive** — deferred→a proposal not yet written; see _What this evidences_
  above. The one-off built here is deliberate.
