---
name: release
description: "Drive the eess monorepo npm release — changeset version bump, lockfile sync, validate, commit, tag, and the tag push that triggers publish.yml (OIDC trusted publishing + provenance). Use this whenever the user says release, publish, cut a release, ship it, new version, bump the version, or wants to get the eess packages onto npm. This is the eess-specific release (changesets + six workspace packages + publish.yml) — NOT the ts-archunit single-package release skill; if you're in the eess repo, use this one."
argument-hint: '[patch|minor|major hint, optional]'
---

# Releasing eess

The authoritative, human-facing description lives in **[`RELEASING.md`](../../../RELEASING.md)** at the repo root — read it first (it carries the current command list and the "learned the hard way" gotchas). This skill is the _executable_ companion: it walks the same flow, turns the gotchas into active checks, and stops at the two moments where a human must decide. Keep the two in sync — if the process changes, `RELEASING.md` is the source of truth and this skill follows it.

**Why a skill and not just docs:** the release is periodic, gotcha-laden, and **irreversible** (it publishes to npm with provenance). The failure modes — a stale lockfile, a tag that never triggers the workflow, an out-of-order build — are silent and only surface in clean CI. Running the same guarded sequence every time is what keeps a release from becoming a five-attempt debugging session.

## Preflight — before touching versions

Run these and stop if any is wrong:

- `git branch --show-current` → must be **`main`**. Releases cut from `main` only.
- `git status --short` → must be **clean**. A dirty tree means uncommitted work would ride along or the release commit would be muddied.
- `git pull --ff-only origin main` → local `main` must match origin.
- `ls .changeset/*.md | grep -v README` → there must be **at least one pending changeset**. No changeset = nothing to release; if the user wants a release with no changeset, they first need `npm run changeset` to describe what changed.
- Confirm CI on the current `main` is green (`gh run list --branch main --limit 1`). Don't cut a release on top of a red `main`.

## Versioning — let changesets decide

**Default: don't pick versions, and never hand-edit one.** The changeset says which packages changed and how; `changeset version` computes the rest. Mixed versions across the family are the normal, correct outcome — the packages that actually changed take the feature bump, the others take a patch for the dependency update. `.changeset/config.json` has no `fixed`/`linked` groups, so packages version independently by design.

Resist two tempting mistakes:

- **Don't pad the changeset** with untouched packages just to force every version to match. That fakes a change that didn't happen, and it's the wrong reflex even though `RELEASING.md` mentions a lockstep habit. If the user genuinely wants lockstep, that's a `fixed` group in the config — a deliberate config decision, not a per-release hack.
- **Don't edit a version in `package.json` after the bump.** If the computed version looks wrong, the cause is upstream (a changeset entry or a dependency range) — fix the cause and re-run. `git reset --hard` + re-run is cheap and safe up until the tag push.

If the user asks for "the latest version" without naming one, that means: run the tool, report what it computed, don't editorialize.

## After the bump — check for a surprise major

`changeset version` can escalate a package to **major** on its own when a dependency bump falls outside a declared range. For a `0.x` package, major means **`1.0.0`** — a loud, permanent "this is stable now" claim you cannot retract once published.

This bit us for real: `eess-crossvalidate` is the only package with `peerDependencies` on the sibling dialects. They were pinned `^0.1.1`, which on a `0.x` package admits only `0.1.x`, so any family minor fell out of range and changesets escalated crossvalidate to `1.0.0`. The fix (already applied) was to widen those peer ranges to `>=0.1.1` and set `onlyUpdatePeerDependentsWhenOutOfRange` in the config — so the bridge package now tracks the family instead of claiming stability.

So after running the bump, **print every package's before → after and read them.** Anything that jumped a major, or moved when you expected it not to, stop and explain it to the user before continuing. A surprise major is nearly always a range problem upstream, not an intended release decision.

## The release sequence

Run these in order. Each line matters — the comments are the gotchas RELEASING.md warns about, made active.

```bash
# 1. Apply the changeset: bumps package.json versions, writes CHANGELOGs,
#    bumps internal dependency ranges.
npm run version-packages

# 2. GOTCHA — sync the lockfile. `changeset version` does NOT touch
#    package-lock.json; a stale lock makes CI's `npm ci` set up a degraded
#    workspace and the build/bins break. This step is mandatory.
npm install

# 3. Sanity gate locally BEFORE tagging — build order, typecheck, lint,
#    format, every check:* gate, full test suite. EXPECT check:spec to fail
#    here on a major/minor bump (see the note under this block) — fix and
#    re-run until this exits 0.
npm run validate

# 4. Commit everything the bump touched: package.json(s), CHANGELOG.md(s),
#    AND package-lock.json (step 2). Verify the lockfile is staged.
git add -A && git status --short   # confirm package-lock.json is listed
git commit -m "release: vX.Y.Z"

# 5. Tag + push. GOTCHA — a lightweight tag needs its OWN push;
#    `git push --follow-tags` only pushes annotated tags, so push the tag
#    explicitly or publish.yml never fires.
git tag vX.Y.Z
git push origin main
```

After step 5, **stop.** The next command is the irreversible one.

### Expect `check:spec` to fail on a major/minor bump

The README **Packages table has a Status column gated against the real package versions** (`spec.rules.ts`), so the moment a package's `major.minor` changes, the old `0.1.x` cell becomes a lie and `check:spec` fails with a `Fix:` naming the package and the expected `0.2.x`. This is the spec-code binding working, not a bug.

Fix it by editing the Status cell for each package whose `major.minor` moved (packages taking only a patch keep their cell), then re-run `npm run validate`. Do this **before** the commit so the release lands in one clean commit.

Also note: `.claude/` is tracked, so `format:check` covers skill files too — if you edit this skill, run prettier on it.

## Decision 2 — the publish trigger (mandatory pause)

`git push origin vX.Y.Z` is what triggers `publish.yml` to **publish to npm** (tokenless OIDC + provenance) and cut a GitHub Release. This is not reversible — npm does not allow re-publishing a version, and provenance is attached.

**Never push the version tag without an explicit, fresh "yes" from the user** for this specific release. State the exact versions about to go public and the tag, then wait. Approval to "do the release" earlier in the conversation is not approval to push the tag — confirm again here.

```bash
git push origin vX.Y.Z   # ← only after explicit user confirmation
```

## Watch it land

```bash
gh run watch "$(gh run list --workflow=publish.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

The publish step is **idempotent** — it skips any `name@version` already on the registry, so a re-run after a partial failure is safe. When it's green, confirm the packages are live (`npm view @nielspeter/eess version`, etc.) and that the GitHub Release was created.

## If something fails mid-release

- **Validate fails at step 3** — fix the code, amend/extend the release commit; nothing is public yet, no harm done.
- **The workflow fails after the tag push** — read the run log. Because publish is idempotent, fixing the cause and re-running (or re-pushing the tag) is safe; already-published packages are skipped.
- **Wrong version bumped** — before the tag push it's all local; reset and redo. After the tag push, the version is public — bump forward to a new version rather than trying to unpublish.

## New package added since last release?

A brand-new `@nielspeter/eess-*` package needs a one-time manual first publish + trusted-publisher setup before the workflow can publish it tokenlessly. Those steps are in `RELEASING.md` under "One-time setup per package" — follow them there, don't reinvent them here.
