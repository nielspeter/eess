# Bug 0184: nothing checks that a breaking changeset bumps minor

## Status

- **State:** Fixed — gated, sabotage-verified on the real repo.
- **Deferred:** none
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

`release/breaking-needs-minor`, in `scripts/release-gate.mjs`'s pure core, wired
through `scripts/check-release.mjs`.

A changeset whose body declares a break must bump **at least one** package past
`patch`. At least one, not all — a break is owned by one package while its
siblings legitimately take a dependency patch. `assertion-less-rules-fail.md` is
exactly that shape (kernel `minor`, five dialects `patch`), and requiring every
row to be `minor` would have reddened a correct changeset on day one.

### Decision 1 — the keyword set

Measured rather than guessed, which mattered: the record proposed
`Breaking` **or** `**Migration:**`, and `Migration` turns out to be the wrong
signal. Of the 9 pending changesets, 5 carry a `**Migration:**` section and 4
declare a break, and **the two sets differ** — migration guidance accompanies
plenty of non-breaking minors. Keying on it would redden correct work, and a gate
that reddens correct work is one that gets suppressed (ADR-009 rule 3).

What counts is the bolded `**Breaking…**` lead this repo actually writes, plus
the conventional-commits `BREAKING CHANGE` / `BREAKING-CHANGE` marker. Requiring
the bold or the all-caps form makes the false positives the record warned about
impossible **by construction** rather than by a negative lookaround nobody can
read: "this is not a breaking change" and "avoids breaking the baseline" cannot
match either form. Both are pinned as fixture cases.

The cost is stated in the source rather than hidden: a break announced in
unadorned prose is not caught. This gate exists to catch the case where someone
wrote "Breaking" and still typed `patch`.

### Decision 2 — `major` on a 0.x package: NOT built, and the reason matters

The record asked whether a declared `major` should be refused on a `0.x` package.
It should not be gated here, because **such a gate would not catch its own
motivating case.** `RELEASING.md` records `eess-crossvalidate` escalating to
`1.0.0` — and that escalation came from `changeset version` resolving
`peerDependencies` ranges at version time, not from any changeset declaring
`major`. A rule reading declared bumps is blind to it.

The real countermeasure for that case already shipped: the peer ranges were
widened to `>=0.1.1` and `onlyUpdatePeerDependentsWhenOutOfRange` was set. The
remaining human check is `RELEASING.md`'s instruction to print every package's
before→after and read them, which is a Tier-3 operational step and honest as
such. Building a declared-`major` gate would have added a mechanism that looks
like coverage for a failure it cannot see.

## Verification

- [x] A changeset saying "Breaking" while declaring `patch` fails the gate.
      Sabotage-verified **on the real repo**, not only on fixtures: flipping
      `.changeset/smell-builder-examined-units.md` to `patch` produces
      `release/breaking-needs-minor` at `:2` with the remedy and the rationale,
      and `check:release` **exits 1**. Restored, exits 0.
- [x] The existing pending changesets pass unchanged — 4 of 9 declare a break,
      each already bumping past patch, including the mixed kernel-minor /
      dialects-patch shape.
- [x] Prose containing a negated form does not fire. Eight detector cases are
      pinned in `scripts/nonvacuity/bad-release.mjs`, four that must match and
      four that must not — including `**Migration:**` alone, "not a breaking
      change", and "avoids breaking the baseline".
- [x] The break class is registered: `check:nonvacuity` is 42 fixtures (was 41),
      and the gate-coverage meta-check claims the new rule under `check:release`.
      That meta-check caught the missing claim on the first run.
- [x] The gate reports its own denominator, whether or not it fires:
      `breaking ✓ 4 of 9 changeset(s) declare a break, each bumping past patch`.
      A rule that examined zero changesets and one that examined nine otherwise
      print the same "0 findings", and only one of those is evidence (ADR-010).
- [x] `npm run validate` exits 0.
