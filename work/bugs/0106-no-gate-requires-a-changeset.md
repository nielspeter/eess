# Bug 0106: nothing requires a changeset, so a feature can merge green and be unreleasable — `gherkin-ts` is the live instance

## Status

- **State:** Draft — confirmed against git history, `.changeset/`, and the
  published registry metadata. No red test written yet.
- **Severity:** High — an adopter's first run is broken. A whole public binding
  is on `main`, gated in CI, documented in the package README, and unreachable
  from any published version.
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

## Fix

Both parts are files, and files merge.

**1 — Add the missing changeset.** A `minor` for `@nielspeter/eess-crossvalidate`
(`gherkin-ts` is additive). This makes the binding releasable; it does not
release it (see _Scope_).

**2 — Gate it, so it cannot recur.** Changesets ships the check:

```bash
npx changeset status --since=origin/main   # non-zero when a changed package has no changeset
```

Run it in CI for any PR touching `packages/*/src/**`. This repo already keeps a
family of gates in `scripts/` (`check-workspace-integrity.mjs`,
`check-corpus.mjs`, `check-nonvacuity.mjs`, …); this is the same shape — a
mechanical claim about the repo, checked. Docs-only and test-only PRs must be
exempt, so the gate does not train anyone to add empty changesets.

Worth considering alongside, and close to what
[0092](./0092-integrity-gate-misses-three-packages.md) already edits: assert that
every subpath in a package's `exports` resolves to a file the `files` field will
actually publish. That would have caught this at the packaging layer too.

## Scope

**Publishing is not part of this bug.** As filed, the fix ended in
`npm run version-packages && npm run release` and the verification asked for
`npm view` to list a new version — a post-merge rung that
[BUGS.md](./BUGS.md#when-is-a-bug-fixed) forbids, and which would hold this
record open indefinitely.

The publish is re-homed to plan
[0100](../plans/0100-publish-the-fold-retire-ts-archunit.md), which already owns
the acts that cannot land in a PR and whose Phase 1 is the coordinated
six-package release. The changeset this bug adds is what that phase will
consume.

## Verification

- [ ] Red test written first: on a branch that edits `packages/*/src/**` with no
      changeset, the new CI step fails; adding a changeset turns it green.
- [ ] The exempt cases behave — a docs-only and a tests-only PR do not demand a
      changeset.
- [ ] `npx changeset status` reports `@nielspeter/eess-crossvalidate` pending a
      minor bump, where it currently reports nothing to release.
- [ ] `npm run validate` green.

Deferred:

- **The actual release, and the adopter-facing checks that only a release can
  satisfy** (`npm view` lists the new version, a clean project can import
  `@nielspeter/eess-crossvalidate/gherkin-ts`, the published README documents
  every shipped subpath including `md-gherkin`) — deferred→plan
  [0100](../plans/0100-publish-the-fold-retire-ts-archunit.md) Phase 1.
