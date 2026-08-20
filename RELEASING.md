# Releasing

eess publishes its six packages to npm from a **version tag**, via a GitHub
Actions workflow ([`.github/workflows/publish.yml`](.github/workflows/publish.yml))
that authenticates with npm through **OIDC trusted publishing** — no `NPM_TOKEN`,
no `npm login`, no OTP in CI — and attaches **build provenance** (SLSA). The
packages are versioned with [changesets](https://github.com/changesets/changesets).

The whole loop is: describe the change → bump versions → tag → push. The tag does
the rest.

## The changeset is not optional (bug 0106)

`npm run check:release` fails any PR that changes a package without declaring a
release for it. "Changes a package" means **any file under `packages/<name>/`** —
tests and package-local docs included. That is changesets' own definition, and
sharing it is deliberate: a second, private notion of "a change that doesn't
count" would live in the tool where nobody can review it.

Three ways to satisfy it, all of them declarations:

| situation                        | declare it with                                   |
| -------------------------------- | ------------------------------------------------- |
| the change ships something       | `npm run changeset` — pick the package and a bump |
| it ships nothing a consumer sees | `'@nielspeter/eess-<x>': none` in a changeset     |
| nothing in the PR ships, at all  | `npx changeset add --empty`                       |

`none` is a real changesets bump type: recorded, no version change. Prefer it
over `--empty` in a mixed PR — `--empty` waives the whole run, and the gate says
which packages it therefore left unchecked.

## Signalling a breaking change (bug 0184)

A break must be **marked in the body** and bumped past `patch`. `check:release`
reads the marker, not your prose.

| what you write                        | what it means                                           |
| ------------------------------------- | ------------------------------------------------------- |
| a line starting `**Breaking …**`      | the house spelling — 4 of the pending changesets use it |
| a `## Breaking` heading               | also read                                               |
| `BREAKING CHANGE` / `BREAKING-CHANGE` | the conventional-commits spelling, also read            |

On a `0.x` package a break is a **`minor`**, never `major` — `major` takes the
package to `1.0.0`, which is a permanent stability claim, and never `patch`,
which is the bump an adopter takes without reading anything.

**Name the owning package when the changeset touches several.**
`**Breaking (@nielspeter/eess-ts):**` makes ownership machine-readable, and the
rule then requires _that_ package past `patch`.

Without an owner it can only ask that **at least one** package is past `patch`,
because a break is owned by one package while its siblings take a dependency
patch — `assertion-less-rules-fail.md` is kernel `minor` plus five dialects on
`patch`, and demanding all of them would redden a correct changeset.

That weaker form has a real hole, and the gate says so out loud rather than
hiding it: kernel `minor` with the break actually in a dialect on `patch` passes.
A green run prints how many changesets were checked loosely for exactly this
reason. If your changeset names more than one package, name the owner.

**A break in the kernel must name the dialects.** `@nielspeter/eess` is a regular
dependency of all five dialects, and `updateInternalDependencies: "patch"` turns a
kernel `minor` into a dialect `patch`. An adopter installs `eess-ts`, holds no
range on the kernel at all, and their `^0.3.0` takes that patch silently — with a
changelog reading only "Updated dependencies" (bug 0185).

Naming each dialect in the same changeset fixes both halves: each gets its own
bump, and each gets the changeset's TEXT in its own changelog.
`release/break-names-dependents` enforces it. Any bump will do — but not `none`,
which records no changelog entry, which is the half that matters.

Peer dependents are deliberately NOT required. `eess-crossvalidate` peers on the
four dialects with `>=0.1.1`, and `onlyUpdatePeerDependentsWhenOutOfRange` leaves
it unbumped on purpose — that is the countermeasure for the `1.0.0` escalation.
The cost is that crossvalidate's changelog cannot record a sibling break.

**The limit, stated because it is load-bearing:** an unmarked break is not
caught. This gate exists to stop a changeset that SAYS "Breaking" from shipping
as a patch — it does not infer intent from prose, and no gate does. If you are
breaking something, write the marker.

`none` is not a way out. It means "no release, recorded", and a body declaring a
break alongside it is still wrong; the rule fires and says so.

The gate reads a **base ref** (`EESS_RELEASE_BASE`, else the PR's target, else
`origin/main`, else `main`) and hard-errors if none resolves, so CI checks out
with `fetch-depth: 0`. It runs on pull requests only: after a merge there is no
diff left to read.

**On a release commit it stays green by design.** `changeset version` deletes the
changesets it applies, so step 4 below looks like "packages bumped, nothing
pending". The gate reads the consumed files back out of the base ref and credits
them — but it still fails if `changeset version` bumped a package no changeset
named.

## Release steps

From a clean `main`:

```bash
# 1. Describe what changed (interactive: pick packages, bump type, write a summary)
npm run changeset

# 2. Apply the bumps — updates package.json versions, writes per-package
#    CHANGELOG.md, and bumps internal dependency ranges
npm run version-packages

# 3. Sync the lockfile — changeset does NOT touch package-lock.json, and a stale
#    lock breaks `npm ci` in CI (see Gotchas). This step is mandatory.
npm install

# 4. Sanity-check locally
npm run validate

# 5. Commit everything the bump touched (package.json, CHANGELOGs, package-lock.json)
git commit -am "release: v0.1.2"

# 6. Push main, then push the tag (see Gotchas — the tag needs its own push)
git tag v0.1.2
git push origin main
git push origin v0.1.2
```

That's it. The tag push triggers `publish.yml`, which:

1. installs, builds (dependency-ordered), and runs the release gates —
   `typecheck` · `lint` · `format:check` · `test`;
2. publishes every package **not already on npm** at its current version, in
   dependency order (kernel → dialects → crossvalidate), with `--provenance`;
3. creates a GitHub Release from the tag.

Watch it: `gh run watch $(gh run list --workflow=publish.yml --limit 1 --json databaseId -q '.[0].databaseId')`.

The publish step is **idempotent** — it skips any `name@version` already on the
registry, so a re-run after a partial failure is safe, and re-tagging is fine.

## Gotchas (learned the hard way)

- **Commit the lockfile.** `changeset version` bumps `package.json` but not
  `package-lock.json`. If you commit the mismatch, CI's `npm ci` sets up the
  workspace in a degraded state and the build/bins break. Always run
  `npm install` after `version-packages` and commit the updated lock.
- **Lightweight tags need their own push.** `git push --follow-tags` only pushes
  _annotated_ tags. `git tag vX.Y.Z` makes a lightweight tag, so push it
  explicitly: `git push origin vX.Y.Z`. Without it, the workflow never fires.
- **The build is dependency-ordered on purpose.** The root `build` script builds
  the kernel, then the dialects, then `crossvalidate` — because `crossvalidate`
  imports every other dialect's built declarations. Don't switch it back to
  `--workspaces` (alphabetical order builds `crossvalidate` too early).
- **The release path runs standard gates, not the dogfood chain.** `publish.yml`
  runs `build`/`typecheck`/`lint`/`format:check`/`test`, **not** `npm run
validate`'s `check:*` gates. Those are eess's PR-time self-validation (run by
  `ci.yml`); they pull in the dialect CLIs and a non-vacuity meta-check that
  don't belong in the release path.

## One-time setup per package (already done for the current six)

npm trusted publishing is configured **per package**, and a package must exist on
npm before you can configure it — so a brand-new package needs a first publish
by another means (chicken-and-egg).

For each **new** `@nielspeter/eess-*` package:

1. **First publish manually**, once, from a machine logged in to npm
   (`npm login`, then `npm publish --workspace packages/<dir> --access public`).
   This will prompt for your 2FA/OTP in a real terminal.
2. On **npmjs.com → the package → Settings → Trusted Publisher → GitHub
   Actions**, add:
   - **Organization or user:** `nielspeter`
   - **Repository:** `eess`
   - **Workflow filename:** `publish.yml`
   - **Environment:** _(leave blank)_
   - **Allowed actions:** check **Allow `npm publish`**

   (Each save requires a 2FA code.)

After that, the package releases tokenlessly through the workflow like the rest.

## Versioning

Packages version independently via changesets (`.changeset/config.json`), but in
practice we bump the family together so the six stay in lockstep at a common
version. Internal dependency ranges are bumped automatically
(`updateInternalDependencies: patch`).
