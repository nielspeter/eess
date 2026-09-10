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

## A migration names its import line (bug 0273)

If a changeset tells an adopter to call something different, **put the import
line in the fence.** `check:docs-code` compiles the import statements of every
`ts` fence under `.changeset/`, so the specifier and every named member are
resolved against the built packages.

**What is gated and what is not.** Nothing checks that you wrote an import line.
A migration written purely in prose, or with a fence that has no import, passes
free — it is a fragment, and no mechanism reads English. What is gated is that
the line you DID write resolves. So this section is a convention held by review,
not by the build, and the build's job is to make the convention worth following:
the moment you state where a symbol lives, that statement becomes falsifiable.

```ts
import { finishPreset } from '@nielspeter/eess-ts/presets'

finishPreset(violations, { report: 'throw' })
```

The reason is a defect that shipped to a release-ready PR. Plan 0263 Phase 5
wrote, in prose, that the replacement symbol "is exported from the same three
places the alias was". It was not — the `/presets` subpath did not carry it, and
an adopter following the migration verbatim would have got a link-time error.
Three reviewers found it and no gate could, because **a claim about where a
symbol lives is not checkable until it is written as an import.** Writing the
import line is what converts the claim from prose into something that fails the
build.

Only the import lines are compiled, not the whole snippet. A migration reads
`finishPreset(violations, …)` where `violations` is the reader's variable, and
demanding a runnable example would push authors toward ceremony or toward the
skip directive — a gate people route around is worth less than none (ADR-009
rule 1). A fence with no import claims nothing checkable and is counted as a
fragment, which is also what makes the "before" half of a migration free: a bare
`throwIfViolations(violations)` asserts nothing about where anything is exported.

**Two things the gate does about being routed around.** A changeset fence that
carries an import but is not tagged `ts`/`typescript` is counted and named in the
summary — the three-character retag that would silence it leaves a trace, the way
the skip directive does. And a failure in a changeset prints a remedy saying the
import line is a claim about where a symbol is exported, rather than offering the
skip directive as an equal option.

**Running it.** `check:docs-code` is late in `npm run validate` and is not in
`check:fast`, because it needs a built `dist`. Once built, run it directly —
`npm run check:docs-code`, about a second — rather than waiting for the full
chain or for CI.

**A rename in a later PR can red a changeset that PR did not touch.** Pending
changesets are checked on every run, so renaming or moving a symbol reds any
pending migration naming it, and the author of the rename has to edit someone
else's unreleased document or mark it skipped. That is the intended behaviour —
shipping a dead migration is the thing being prevented — but it is a real cost
while a release train is long, and it is better met knowingly than as a surprise.

**Showing a "before" that no longer resolves.** If the before-side genuinely
needs its old import line, put `<!-- eess-docs-code-skip: pre-migration example -->`
immediately above the fence. The gate counts skipped fences in its summary, so
this is visible rather than silent. Note that `changeset version` copies the body
verbatim, comment included — it will not render, but it does reach the published
`CHANGELOG.md`.

## A release with several breaks gets a migration page

`changeset version` writes each package's changelog in changeset order, so a
train carrying many breaks scatters them through a long list an adopter has to
reassemble. The v0.5 train carries thirty changesets with eleven breaks in them —
one lands around line 393 of the kernel's changelog. No gate can fix that, and
nothing in this file used to ask anyone to.

So: **when a release carries three or more breaking changesets, write a migration
page before cutting it.** [`docs/migrating-to-0.5.md`](./docs/migrating-to-0.5.md)
is the worked example.

**Where it goes**, so the next one does not re-litigate this:

- The file is `docs/migrating-to-<kernel version>.md`. The name is load-bearing —
  `check:docs-code` reads any `docs/migrating-*.md` as import claims by pattern,
  so naming it that way is what gets its import lines compiled.
- A **"Releases & migration"** group in `docs/.vitepress/config.ts`, newest first.
  Not "Introduction": that is what a new reader walks top to bottom, and a
  migration page is useless to someone installing fresh.
- A **banner above `## Packages`** in `README.md`. **One at a time** — the next
  release carrying breaks replaces it, it does not stack.
- The **GitHub Release**, which needs a manual step; see the release sequence.

What made the worked example worth writing:

- It is ordered by **what the reader has to do**, not by package or by changeset.
- It separates changes needing a code edit from ones where a passing build simply
  goes red — that second group is invisible in a changelog and is what actually
  surprises people.
- Its fences are checked, and you do not have to wire that up: any
  `docs/migrating-*.md` is read as import claims by pattern, so its import lines
  compile against the built packages. Name the file that way and it is covered.

**The cost, which is bounded but not zero.** A migration page pins the build to
whatever it imports, forever, and a page naming `/internal` symbols pins the
build to internal stability — which inverts what that entry point is for. A
changeset has the same cost and escapes it because `changeset version` deletes
it. A page does not. So when the release after next makes a page historical,
either drop the import fences to prose or rename it out of the pattern. Do not
leave a frozen document holding the engine still.

## Signalling a breaking change (bug 0184)

A break must be **marked in the body** and bumped past `patch`. `check:release`
reads the marker, not your prose.

| what you write                                        | also accepted                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| a line starting `**Breaking …**` — the house spelling | `__Breaking …__`, and behind a list marker (`- **Breaking …**`) |
| a `## Breaking` heading                               | any heading level, `#` to `######`                              |
| `BREAKING CHANGE:` at the start of a line             | `BREAKING-CHANGE:`, and the plural `BREAKING CHANGES:`          |

This table states no count on purpose. Its first version said "4 of the pending
changesets use it" and was wrong one commit later; `check:release` prints the live
number on every run, which is the copy that cannot drift.

**Two spellings that DO fire and should not**, accepted deliberately:
`**Breaking changes:** none` and `**Breaking change avoided**`. The gate reads the
marker, not the sentence after it. Detecting those needs a negation test inside
the bolded span, and `**Breaking:** none of the old exports remain` contains
"none" while being a real break — so that would trade a loud false positive for a
silent false negative on a path that cannot be undone. Write a bolded `**Breaking
…**` lead only when something actually broke; if you hit this, the remedy the gate
prints (delete the marker) is the right one.

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

**A break in the kernel must name the dialects, at `minor`.** `@nielspeter/eess`
is a regular dependency of all five dialects. An adopter installs `eess-ts`, holds
no range on the kernel at all, and an undeclared dialect inherits the kernel's
release as a **patch** — a version their `^0.3.0` takes without asking, under a
changelog reading only "Updated dependencies" (bug 0185).

**There is no configuration that changes this.** `updateInternalDependencies` is
not it: changesets hard-codes the inherited type to `patch` in
`assemble-release-plan`, and reads that setting only in `apply-release-plan`, as
the threshold for rewriting the dependency RANGE string. Declaring the dialect is
the only lever.

Declaring each dialect at `minor` in the same changeset does both things: the
dialect ships on a version an adopter will not silently take, and the changeset's
TEXT lands in that dialect's own changelog instead of "Updated dependencies".
`release/break-names-dependents` enforces it.

`patch` is not enough and the gate says so. Measured on this repo's own model
changeset: with the dialects at `patch`, `eess-ts` releases as `0.3.1` and the
rendered entry reads `**Breaking:** …` under a heading that says
`### Patch Changes`. At `minor` it releases as `0.4.0` with the text under
`### Minor Changes`.

Peer dependents are NOT required — but not for the reason first written here.
Declaring a peer dependent does **not** trigger the `1.0.0` escalation: measured,
that setting governs automatic bumping of an _undeclared_ peer dependent, and an
explicit declaration is honoured unchanged. The argument that survives is weaker:
a peer is a range the consumer resolves. `onlyUpdatePeerDependentsWhenOutOfRange`
leaves crossvalidate unbumped on purpose — that is the countermeasure for the
`1.0.0` escalation. The cost is that crossvalidate's changelog cannot record a
sibling break.

**Keep the floors at the shipped versions.** They were `>=0.1.1` until 2026-08-24,
which admitted any dialect ever published. That was harmless only while every
package sat on the same kernel range; the kernel split (ADR-011) ended that, and
a consumer on the newest crossvalidate plus a floor-old dialect would have
resolved **two copies of `@nielspeter/eess`** — which holds module-level mutable
state (edge-coverage counters, comment-suppression counters, identity
collisions, the cache registry), so the state silently splits. Raise each floor
to the version this release ships. A `>=X` range never goes out of range upward,
so doing so cannot trigger the escalation.

**Do it in the `changeset version` commit, not before it.** Raising a floor to a
version that is not published yet makes `npm install` fail with `ETARGET` for every
fresh clone — and CI does not notice, because `npm ci` builds from
`package-lock.json` and npm's lockfile validation compares names and versions only,
never `peerDependencies`. Green build, broken clone. Measured on this repo when the
floors were raised one commit early.

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

# 3a. Raise eess-crossvalidate's peerDependencies floors to the versions this
#     release ships. `changeset version` does NOT touch them, so they sit at the
#     PREVIOUS release's numbers and admit a dialect built against the previous
#     kernel — two kernels in one tree, with the counters and registries inside
#     them split. Measured on the 0.5 train, where the kernel's surface actually
#     differed between the two. This was documented in prose below and not in
#     these steps, so the documented sequence produced the wrong artifact.
$EDITOR packages/crossvalidate/package.json

# 3b. Update the README Packages table's version column. It is gated against the
#     real versions, so `check:spec` reds in step 4 on every release that moves a
#     major or minor — six violations on the 0.5 train. Expected, not a defect.
$EDITOR README.md

# 4. Sanity-check locally
npm run validate

# 5. Commit everything the bump touched (package.json, CHANGELOGs, package-lock.json)
git commit -am "release: v0.1.2"

# 6. Push main, then push the tag (see Gotchas — the tag needs its own push)
git tag v0.1.2
git push origin main
git push origin v0.1.2
```

**The tag is the KERNEL's version.** The six packages do not share a number —
this release ships `@nielspeter/eess` at 0.5.0 and `@nielspeter/eess-md` at
0.6.0 — and `publish.yml` fires on any `v*`, so nothing decides this for you. The
"Versioning" section below still says the family stays "in lockstep at a common
version"; that has been false since `v0.4.0`, which was cut while md was at
0.5.0.

**A release carrying a migration page needs a step nothing automates.**
`publish.yml` creates the GitHub Release with `generate_release_notes: true` and
no body, so the notes are machine-made from PR titles and no authoring moment
exists. After the tag push, edit the Release to link the migration page —
`gh release edit v<kernel-version> --notes-file …` — or the page you wrote is
reachable only by someone already browsing the docs.

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
version. Internal dependency RANGES are rewritten automatically
(`updateInternalDependencies: patch` is the threshold for that rewrite — it does
**not** control how strongly a dependent's version is bumped, which changesets
hard-codes to `patch`; see "Signalling a breaking change").
