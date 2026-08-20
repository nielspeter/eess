# Bug 0184: nothing checks that a breaking changeset bumps minor

## Status

- **State:** Draft — a gap in an irreversible path.
- **Found:** 2026-08-20, devops review of the bug 0179 fix.

## Symptom

`check:release` enforces that every changed package is **named** in a changeset.
It does not read the bump **type**. `scripts/check-release.mjs` parses the
declaration and never compares it against the changeset's content.

So a changeset whose body says "Breaking" while declaring `patch` passes every
gate, and `publish.yml` then publishes to npm with `--provenance` — which cannot
be unpublished after 72 hours.

## Why it is live rather than theoretical

This repo already applies the countermeasure **by hand and by convention**.
Pending changesets on this branch carry, verbatim:

> **Breaking (0.x — minor signals it, not a 1.0 stability claim)**

and `.changeset/smell-builder-examined-units.md` declares `minor` for a change
whose first line is "**Breaking for subclasses of `SmellBuilder`**". The
convention is right and is being followed. Nothing enforces it.

## How it surfaced

Bug 0179 deleted `version-bump-guard.test.ts`, correctly: it tested
`.github/scripts/assert-version-bump-is-safe.sh`, which eess never ported, and
with the script absent the test was **fail-open** — `execFileSync` throws, so
every "REFUSES…" row passed vacuously while only the "ALLOWS…" rows went red.
Deleting it was the right disposition.

But the record justified the deletion by saying `check:release` "already enforces
that every changed package declares its bump." That is a different property:
`check:release` checks that a bump is _declared_, not that it is _right_. Under
the changesets model the failure mode moved rather than vanished — from "wrong
version arithmetic" to "a changeset declaring `patch` while carrying a contract
break." No record tracked it, which is why this one exists.

## Fix

Not built. A mechanical form is available and cheap: a changeset whose body
matches `Breaking` or `**Migration:**` must declare `minor` or `major`, never
`patch`.

Decide two things while building it:

- Whether the keyword set is right. `Breaking` and `Migration:` are what this
  repo actually writes; a broader regex will produce false positives on prose
  like "not a breaking change", which under ADR-009 rule 3 is how a gate gets
  suppressed.
- Whether `major` should be refused outright on a `0.x` package unless
  explicitly acknowledged. `changeset version` can escalate to `1.0.0` on its
  own — `RELEASING.md` records that happening to `eess-crossvalidate` — and a
  `1.0.0` is a permanent stability claim.

## Verification

- [ ] A changeset saying "Breaking" while declaring `patch` fails the gate.
- [ ] The existing pending changesets pass unchanged.
- [ ] Prose containing a negated form ("not a breaking change") does not fire.
