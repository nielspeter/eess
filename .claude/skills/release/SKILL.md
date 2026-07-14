---
name: release
description: "Drive the eess monorepo npm release — changeset version bump, lockfile sync, validate, commit, tag, and the tag push that triggers publish.yml (OIDC trusted publishing + provenance). Use this whenever the user says release, publish, cut a release, ship it, new version, bump the version, or wants to get the eess packages onto npm. This is the eess-specific release (changesets + six workspace packages + publish.yml) — NOT the ts-archunit single-package release skill; if you're in the eess repo, use this one."
argument-hint: "[patch|minor|major hint, optional]"
---

# Releasing eess

The authoritative, human-facing description lives in **[`RELEASING.md`](../../../RELEASING.md)** at the repo root — read it first (it carries the current command list and the "learned the hard way" gotchas). This skill is the *executable* companion: it walks the same flow, turns the gotchas into active checks, and stops at the two moments where a human must decide. Keep the two in sync — if the process changes, `RELEASING.md` is the source of truth and this skill follows it.

**Why a skill and not just docs:** the release is periodic, gotcha-laden, and **irreversible** (it publishes to npm with provenance). The failure modes — a stale lockfile, a tag that never triggers the workflow, an out-of-order build — are silent and only surface in clean CI. Running the same guarded sequence every time is what keeps a release from becoming a five-attempt debugging session.

## Preflight — before touching versions

Run these and stop if any is wrong:

- `git branch --show-current` → must be **`main`**. Releases cut from `main` only.
- `git status --short` → must be **clean**. A dirty tree means uncommitted work would ride along or the release commit would be muddied.
- `git pull --ff-only origin main` → local `main` must match origin.
- `ls .changeset/*.md | grep -v README` → there must be **at least one pending changeset**. No changeset = nothing to release; if the user wants a release with no changeset, they first need `npm run changeset` to describe what changed.
- Confirm CI on the current `main` is green (`gh run list --branch main --limit 1`). Don't cut a release on top of a red `main`.

## Decision 1 — version lockstep (ask the user)

`.changeset/config.json` uses `updateInternalDependencies: patch` with no `fixed`/`linked` groups, so **packages version independently**. A changeset that marks only some packages (say `@nielspeter/eess` + `@nielspeter/eess-ts` as `minor`) will bump the rest only by a **patch** (their internal dependency range moved), leaving the family at mixed versions.

`RELEASING.md`'s convention is to **keep the six in lockstep at one version**. So before bumping, surface the choice:

- **A — lockstep (usually preferred):** if the changeset doesn't already cover all six, add the untouched packages to it at the same bump level so every package lands on the same version. Cleanest; matches the documented convention and makes the tag name unambiguous.
- **B — semver-strict:** leave the changeset as-is; only changed packages take the feature bump, the rest take the dependency patch. More literally honest, but the family versions diverge.

Show the user which packages the current changeset(s) bump and to what, name the resulting versions under each option, recommend A unless there's a reason not to, and let them pick. Don't proceed until they choose.

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
#    format, every check:* gate, full test suite.
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
