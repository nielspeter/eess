# Plan 0100: Publish the fold and retire ts-archunit

## Status

- **State:** Draft — created 2026-08-12 by splitting the unmergeable tail off
  [plan 0088](./completed/0088-fold-ts-archunit-into-eess.md). 0088 had nine phases ending
  in "Retire ts-archunit" (work in **another repository**) and "Version, release,
  and the adopter migration story" (an act that completes at `npm publish`, not at
  merge). Neither can land in 0088's PR, so 0088 could not close — the failure
  mode plan 0067 is the standing evidence for. This plan owns exactly the part
  that happens **after** the folding PRs merge.
- **Priority:** High — it is what makes the fold's central claim true. Until the
  fork is deprecated, "the fork is retired" is an assertion; eess ADR-009's
  enforcement row cannot flip to `gated` while `@nielspeter/ts-archunit` still
  resolves as a live package.
- **Effort:** Small — no engine work. One coordinated version bump, one publish,
  one deprecation, one enforcement-row flip. The judgement (which packages, which
  versions, what the migration says) is **already made and merged** by 0088 Phase
  7; this plan executes it.
- **Created:** 2026-08-12

## Problem

The fold ([0088](./completed/0088-fold-ts-archunit-into-eess.md)) and its family
consequences ([0089](./completed/0089-family-standalone-sufficiency.md) +
[0101](./completed/0101-sibling-gates-go-fail-closed.md)) are code changes:
they merge. Three things in the same story are **not** code changes, and mixing
them into either plan makes that plan unclosable:

1. **The coordinated publish.** `@nielspeter/eess` 0.2 → 0.3 is a contract break
   at 0.x, and every sibling declares `^0.2.0` — i.e. `>=0.2.0 <0.3.0`. A 0.3
   kernel breaks every sibling range on the registry unless all six publish
   together. There must be **no published window** in which a consumer can
   resolve `eess-ts@0.3` alongside `eess-md@0.2`, which would install two kernel
   copies — and, with the folded honest-gate seam, split the unforgeable
   registries across two `WeakSet` instances. That constraint is about the
   registry, not the repo, and it spans two plans' merges.
2. **The deprecation.** `npm deprecate @nielspeter/ts-archunit` is a registry
   act in another package's namespace. No commit performs it.
3. **The archival.** Marking the ts-archunit repository archived happens in that
   repository.

Keeping these inside 0088 meant 0088 closed only when the packages were on npm —
a plan held open pending a deploy, which is the one thing
[`BUGS.md`](../bugs/BUGS.md#when-is-a-bug-fixed) forbids.

## Approach

Run after both 0088 and 0089 have merged, in one session, in this order: publish,
then deprecate, then make the retirement claim mechanically true in a closing PR.

**Publish before deprecating, and the order is a constraint rather than a
preference.** A deprecation notice sends every remaining ts-archunit user looking
for the successor. Until `eess-ts` publishes, npm `latest` is a version that
predates the fixes the migration page assumes — the preset-default trap
([0199](../bugs/fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)),
the silent zero-rules green
([0204](../bugs/fixed/0204-check-blessed-a-rule-file-that-enforced-nothing.md)) and
the double print
([0203](../bugs/fixed/0203-a-preset-at-module-scope-prints-its-findings-twice.md)).
Deprecating first would route people onto exactly the failures the guide tells them
how to avoid. Deferred here from
[bug 0198](../bugs/fixed/0198-no-migration-path-from-ts-archunit.md).

**The deprecation message must name the migration guide**, since that page is the
whole answer to "what do I do now" — and it must name a URL that **resolves**.

**It must NOT be the docs site.** Measured 2026-08-22: `https://nielspeter.github.io/eess/`
returns **404**, the repo has `has_pages: false`, and `.github/workflows/` contains
no Pages deploy. Meanwhile `https://nielspeter.github.io/ts-archunit/` returns
**200** — so during the rename the OLD project's docs work and the NEW project's do
not, which
[bug 0180](../bugs/0180-the-documentation-site-the-shipped-readmes-link-to-is-404.md)
names as "the worst possible signal during a rename". An `npm deprecate` notice is
the highest-traffic pointer this project will ever emit and it cannot be edited out
of an adopter's install log.

Use the GitHub blob URL, which is live the moment the guide merges:
`https://github.com/nielspeter/eess/blob/main/docs/migrating-from-ts-archunit.md`.
Switch to the docs site only once
[bug 0180](../bugs/0180-the-documentation-site-the-shipped-readmes-link-to-is-404.md)
ships a Pages deploy — note `npm run docs:build` currently FAILS and nothing gates
it, so "we have a docs site" is not yet true even locally.

### The precondition, as something you can run

Before `npm deprecate`, all three must hold:

```bash
# 1. the WHOLE six-package release is on the registry, not just eess-ts —
#    crossvalidate publishes last, and a partial window is the hazard Phase 1 exists for
for p in eess eess-ts eess-md eess-mermaid eess-gherkin eess-crossvalidate; do
  echo "$p $(npm view @nielspeter/$p version)"
done

# 2. the guide resolves
curl -sfo /dev/null https://github.com/nielspeter/eess/blob/main/docs/migrating-from-ts-archunit.md && echo 'guide OK'

# 3. the published eess-ts actually has what the guide tells people to write
npm view @nielspeter/eess-ts@latest --json | grep -q . && echo 'check crossProject is exported'
```

The third matters more than it looks: `@nielspeter/eess-ts@0.2.1` — today's `latest`
— exports **neither** `crossProject` nor `correspondence`, so the guide's §3 tells a
switcher to write an import that does not resolve on the version they would install.
The guide is written against the version this plan publishes, throughout.
The plan closes with that PR — not with a later observation that the packages
work in the wild. If they turn out not to, that is a new bug.

## Implementation phases

### Phase 1 — The coordinated release

Execute the release 0088 Phase 7 authored. The changesets, version decisions,
breaking-changelog entries, and migration text are already merged; this phase
runs them.

- `/release` — changeset version bump, lockfile sync, `npm run validate`, commit,
  tag, push the tag (`publish.yml` publishes via OIDC trusted publishing with
  provenance).
- **All six packages in one release.** `@nielspeter/eess` 0.2 → 0.3+,
  `@nielspeter/eess-ts` → its 0.59-equivalent major, and the four sibling
  dialects at **at least** `minor` with their kernel ranges bumped in lockstep.
- **Verify the window never opened:** after publish, resolve a fresh install of
  each sibling and assert exactly one `@nielspeter/eess` version in the tree.
- **Carries bug [0106](../bugs/fixed/0106-no-gate-requires-a-changeset.md)'s deferral.**
  `gherkin-ts` merged without a changeset and is on `main` but in no published
  version — an adopter importing the documented `./gherkin-ts` subpath gets
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. 0106 adds the changeset and the gate that
  stops it recurring; this phase is what consumes that changeset. Its
  release-only checks land here: `npm view` lists the new version, a clean
  project imports `@nielspeter/eess-crossvalidate/gherkin-ts` without a
  resolution error, and the published README documents every shipped subpath
  (`md-gherkin` is undocumented in `0.1.2`).

**Definition of done:** all six packages published at compatible ranges; a clean
install of any dialect yields a single kernel copy; the `./gherkin-ts` subpath
resolves from the registry.

### Phase 2 — Deprecate and archive the fork

- `npm deprecate @nielspeter/ts-archunit 'retired — folded into @nielspeter/eess-ts. Migration guide: https://github.com/nielspeter/eess/blob/main/docs/migrating-from-ts-archunit.md'`
  — **the message above is the one to run, verbatim.** The Approach section's
  requirement that it name the guide is stated there; this is the line that gets
  copy-pasted, and an earlier version of this plan carried a message with no URL in
  it at all.
- Mark the ts-archunit repository archived. It is **not deleted**: it stays the
  canonical provenance source for the corpus that
  [0090](./0090-adopt-ts-archunit-work-corpus.md) migrates. Archiving does not
  wait on 0090 — an archived repo is still readable, so the two are independent.
  (Stated explicitly so this does not re-acquire a phantom blocker.)

**Definition of done:** the package is deprecated on the registry and the repo is
archived, with the provenance link to 0090 recorded rather than assumed.

### Phase 3 — Make "retired" mechanically true

The claim is only honest if something checks it. In the closing PR:

- Write and wire the retirement test: `@nielspeter/ts-archunit` no longer
  resolves as this package, or its deprecation notice is present. The test lives
  here rather than in 0088 by necessity — it can only pass after Phase 2's
  registry act, so authoring it in 0088 would leave that plan's `validate` red
  through no fault of its own.
- Flip **eess ADR-009**'s enforcement row for the retirement clause from
  `pending` to `gated`, citing that test — the fork is provably gone.
- Correct any remaining "eess is ahead of ts-archunit" phrasing that survived the
  fold (0088 corrects plan 0081's claim; this catches anything the publish made
  newly stale).

**Definition of done:** `npm run validate` green with the retirement test live and
ADR-009's row `gated`.

## Files changed

- `adr/009-*.md` — the retirement clause's enforcement row flips to `gated`.
- The retirement test — new here (see Phase 3 for why it cannot live in 0088).
- `work/plans/ROADMAP.md` — board row; 0088/0089 move to `completed/` under their
  own closes, not this one.
- CHANGELOGs and `package.json` versions — written by `changeset version`, not by
  hand.

## Test inventory

- Phase 1: a post-publish resolution check — install each dialect fresh, assert a
  single `@nielspeter/eess` in the tree. Non-vacuity: the check must fail if two
  kernel copies are present, proven against a deliberately mismatched fixture
  before the real run.
- Phase 2: no test — a registry act and a repo setting. Phase 3 is what makes it
  checkable.
- Phase 3: the retirement test, wired into `validate`, red before the deprecation
  and green after.

## Out of scope

- **The fold itself** — [0088](./completed/0088-fold-ts-archunit-into-eess.md).
- **Family reconciliation** — [0089](./completed/0089-family-standalone-sufficiency.md)
  (standalone sufficiency) and [0101](./completed/0101-sibling-gates-go-fail-closed.md)
  (the sibling gates going fail-closed).
- **The work-corpus migration** — [0090](./0090-adopt-ts-archunit-work-corpus.md).
  This plan archives the repo; 0090 moves its plans, bugs, ADRs, and docs.
- **Deciding versions or writing the migration story** — 0088 Phase 7 owns the
  judgement and merges it as changesets and changelog entries. This plan executes
  what is already written; if it finds the decision wrong, that is a change to
  0088's merged output, not a decision made here.
- **Post-release observation.** Whether adopters upgrade cleanly is not a hold on
  this plan. A real upgrade failure is a new bug with its own number.

## Success definition

- Six packages published in one coordinated release, no window in which a
  consumer can resolve two kernel versions.
- `@nielspeter/ts-archunit` deprecated on npm; its repository archived and still
  readable as 0090's provenance source.
- The retirement claim is **mechanically checked**, and eess ADR-009's row says
  `gated` because of that check — not because someone asserted it.
- The plan closes with the Phase 3 PR. Nothing waits on a later observation.

## Progress ledger

- [ ] Phase 1 — coordinated release of all six packages
- [ ] Phase 2 — deprecate `@nielspeter/ts-archunit`, archive the repo
- [ ] Phase 3 — retirement test live, ADR-009 row flipped to `gated`
