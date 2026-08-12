# Bug 0106: nothing requires a changeset, so a feature can merge green and be unreleasable — `gherkin-ts` is the live instance

## Status

- **State:** Fixed — `check:release` gates both directions, proven non-vacuous by
  `scripts/nonvacuity/bad-release.mjs`; the `gherkin-ts` changeset is written.
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

Confirmed by survey: **no gate in `scripts/` or `kit/scripts/` reads git today.**
So this bug is not merely a missing check — it is the first concrete instance of
a capability the manifesto specifies and nobody has built. That framing is
recorded here as evidence, not acted on: generalising "changed since a base ref"
into a reusable kernel-side `Selection` is a design question with its own
tradeoffs, and it belongs in a proposal, not smuggled into a bug fix. This record
builds the one-off and says so.

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

Two claims, because one of them holds even when the diff is empty:

| rule                                      | direction       | holds when                        |
| ----------------------------------------- | --------------- | --------------------------------- |
| `release/changed-package-needs-changeset` | `right-to-left` | a changed package declares a bump |
| `release/changeset-names-real-package`    | `left-to-right` | every changeset names a real one  |

The second is pure Drift and needs no base ref, so the gate is never a no-op: a
typo'd package name in a changeset is a declaration that silently publishes
nothing — the same failure class one layer over, and it would sail past
`changeset status`.

The base ref is required, not optional: `EESS_RELEASE_BASE`, else
`GITHUB_BASE_REF`, else `origin/main`, else `main`, and a hard error when none
resolves. `ci.yml:13` checks out at the default depth 1, where `origin/main` does
not exist — so `fetch-depth: 0` is part of this fix, and the hard error is what
makes a future regression of it loud instead of silently green.

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

## Verification

- [x] Red first: a changed package with no changeset produces
      `release/changed-package-needs-changeset`; a changeset naming a package
      that does not exist produces `release/changeset-names-real-package`. Both
      proven by `scripts/nonvacuity/bad-release.mjs`, which also proves the clean
      direction stays silent.
- [x] No exemption table — the gate shares changesets' definition of a changed
      package, and `--empty` is an accepted declaration. (The filed clause
      demanding path exemptions is retained above as a correction, not
      implemented.)
- [x] The base ref is required and named in the summary line, so "nothing
      changed" and "I could not resolve a base" are not the same output
      ([0120](../0120-no-state-and-cannot-find-it-are-the-same-answer.md)'s lesson,
      applied before the bug instead of after it). `ci.yml` gets `fetch-depth: 0`.
- [x] Both rules carry a gate row in `scripts/check-nonvacuity.mjs`, so
      `gateCoverage` claims `check:release` and neither row can be deleted
      silently.
- [x] `npx changeset status` reports `@nielspeter/eess-crossvalidate` pending a
      minor bump — true before this fix by accident (PRs #42, #43); the changeset
      added here is what makes `gherkin-ts` appear in the changelog.
- [x] `npm run validate` green.

**What the gate rows prove, and what they do not.** The fixture drives the pure
core — the path→package mapping and the two correspondences — with synthetic
inputs, so it needs no git and no fake repository. The `git diff` invocation
itself is the one uncovered line; it is a single shell-out whose failure mode is
a hard error, not a false green, which is why it is stated here rather than
worked around with a throwaway repo fixture.

Deferred:

- **The actual release, and the adopter-facing checks that only a release can
  satisfy** (`npm view` lists the new version, a clean project can import
  `@nielspeter/eess-crossvalidate/gherkin-ts`, the published README documents
  every shipped subpath including `md-gherkin`) — deferred→plan
  [0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md) Phase 1.
- **Generalising "changed since a base ref" into a reusable Diff-mode
  primitive** — deferred→a proposal not yet written; see _What this evidences_
  above. The one-off built here is deliberate.
