# Releasing

eess publishes its six packages to npm from a **version tag**, via a GitHub
Actions workflow ([`.github/workflows/publish.yml`](.github/workflows/publish.yml))
that authenticates with npm through **OIDC trusted publishing** — no `NPM_TOKEN`,
no `npm login`, no OTP in CI — and attaches **build provenance** (SLSA). The
packages are versioned with [changesets](https://github.com/changesets/changesets).

The whole loop is: describe the change → bump versions → tag → push. The tag does
the rest.

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
