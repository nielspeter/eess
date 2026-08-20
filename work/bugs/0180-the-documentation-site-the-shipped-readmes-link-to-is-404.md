# Bug 0180: the documentation site the shipped READMEs link to is 404

## Status

- **State:** Draft — measured; fix is a deploy decision.
- **Found:** 2026-08-20, adopter review of the bug 0179 fix.
- **Severity:** the first three links an adopter clicks are dead, and the
  deprecated predecessor's site is live.

## Symptom

`packages/ts/README.md` ships in the npm tarball. Its masthead is:

```
[Documentation](https://nielspeter.github.io/eess/) ·
[Getting Started](https://nielspeter.github.io/eess/getting-started) ·
[What Can It Check?](https://nielspeter.github.io/eess/what-to-check)
```

Measured:

```
404  https://nielspeter.github.io/eess/
404  https://nielspeter.github.io/eess/getting-started
200  https://nielspeter.github.io/ts-archunit/     <- the OLD project's site is live
```

Ten `nielspeter.github.io/eess/*` URLs appear across the shipped READMEs. None
resolves.

## Root cause

There is no Pages deploy. `.github/workflows/` contains `ci.yml` and
`publish.yml` and nothing else; `grep -rl "pages\|gh-pages\|deploy-pages"` over
the workflows returns nothing. `docs:build` is a local script.

So this is not a transient outage — nothing has ever published the site.

## Why it matters more than a normal dead link

The README's own job is the first five minutes of an adopter's experience, and
`packages/ts/README.md` is simultaneously telling them to migrate:

> Formerly published as `@nielspeter/ts-archunit` … New projects should prefer
> `@nielspeter/eess-ts`.

A reader who follows that advice finds the new project's docs 404 and the old
project's docs working. That is the worst possible signal during a rename.

## Not introduced by bug 0179's fix, but adjacent to it

The 0179 fix repaired two **relative** links in the same file and its changeset
said "The published README's links work from the published package." That
sentence over-claimed: it was true of the two links the commit touched and false
of the ten beside them, which `shipped-links.test.ts` does not check because it
validates only the `github.com/nielspeter/eess/blob/main/` prefix. The changeset
wording has been corrected; this record carries the actual defect.

## Fix

Not built — it is a deploy decision, and either answer is defensible:

1. **Add the Pages deploy workflow.** The site content exists
   (`docs/.vitepress/`), so this is CI wiring, and it makes ten shipped links
   correct at once.
2. **Repoint the READMEs at `github.com/nielspeter/eess/blob/main/docs/*.md`**
   until the site is live. Cheap, immediate, and survives the site never being
   deployed.

Do not do both halfway. If (1), the links stay as they are and this closes when
the workflow lands.

## Verification

- [ ] Every `nielspeter.github.io/eess/*` URL in a shipped README resolves, or
      no shipped README contains one.
- [ ] `shipped-links.test.ts` checks the docs-site prefix too, by mapping each
      route back to `docs/<slug>.md` — otherwise this rots again silently, which
      is the same "checked by nothing" hazard that file's own docstring names.
