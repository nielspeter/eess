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
that reddens correct work is one that gets suppressed (ADR-009 rule 1 — cited as
rule 3 until review caught it; rule 3 is the say-there-is-no-escape-hatch rule,
and only its by-construction corollary applies here).

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
motivating case.** `eess-crossvalidate` really did escalate to `1.0.0`, and that
escalation came from `changeset version` resolving `peerDependencies` ranges at
version time — not from any changeset declaring `major`. A rule reading declared
bumps is blind to it.

**Two citations here were wrong and are corrected.** The first draft attributed
the escalation to `RELEASING.md`, and then offered "`RELEASING.md`'s instruction
to print every package's before→after" as the compensating human control.
`RELEASING.md` contains neither: no `1.0.0`, no `peerDependencies`, and step 4 of
its release sequence is a bare `npm run validate`. The escalation is recorded in
commit `762c3f3` and in the `/release` skill. That misattribution mattered more
than an ordinary one — the invented instruction was the control being offered _in
place of_ the gate being declined.

The substance survives, and was re-verified: `packages/crossvalidate/package.json`
carries `>=0.1.1` peer ranges and `.changeset/config.json` sets
`onlyUpdatePeerDependentsWhenOutOfRange: true`, so the countermeasure for that
case did ship. Building a declared-`major` gate would still have added a
mechanism that looks like coverage for a failure it cannot see.

**Known-open, recorded rather than closed:** `minor || major` _accepts_ a
declared `major`, which the message itself warns against, and the family is
released together — so an accidental `major` takes packages to `1.0.0`, a
permanent claim protected by the same "cannot be taken back" clause this rule
cites. n=0 today and it is a deliberate act, not a slip, so no gate; but it is an
open edge, not a solved one.

## Corrections from review

Six reviewers ran against the first version of this fix. Four findings were real
defects in it; the two most important are corrections to claims made here.

**The gate was disableable by three one-line edits, and one of them made the
denominator lie.** Removing `breakingMarker` from `declarationsIn`, removing the
push in `readPendingChangesets`, or dropping `breakingFiles` from the
`releaseViolations` call each let a genuine break-on-patch exit 0 — while
`check:nonvacuity` reported 42/42 green. The third also printed
`✓ 4 of 9 changeset(s) declare a break, each bumping past patch` over a rule that
examined nothing, because the summary read the SHELL's variable while the rule
read the argument. A denominator sourced from anywhere but the rule attests a
check that may not have run, which is worse than no denominator.

Closed: the count is now `stats.breakingExamined`, returned by the rule and pinned
in `EXPECTED_STATS`; `declarationsIn`'s field is pinned in the parser cases; and
two end-to-end scenarios in `bad-release-e2e.mjs` walk the whole chain from a real
file. All eleven mutations the reviewers ran are now caught.

**The headline verification claim was false as stated.** "A changeset saying
'Breaking' while declaring `patch` fails the gate" is true only when EVERY package
it names takes patch or none. Measured: kernel `minor` with the break in a dialect
on `patch` passes — and that is this repo's most common multi-package shape, not an
exotic edge. Two things followed: the marker can now name its owner
(`**Breaking (@nielspeter/eess-ts):**`), and the rule then checks that package
specifically; and a green run states how many changesets were checked only in the
weak form, so the residue is visible rather than implied.

**An `--empty` changeset declaring a break was fail-open.** It produced zero
violations — and worse, `--empty` sets `waived`, which suppresses
`release/changed-package-needs-changeset` for every changed package. So the
loudest marker the detector knows, in that one file shape, turned off the
strongest rule in the gate. This record originally called that out of scope on the
reasoning "there is no bump here to be wrong"; the premise was wrong. It is a
finding now.

**The same defect, committed twice more while fixing it.** Re-running the
reviewers' mutation matrix against the repaired tree found that BOTH fixes added
in response to review — the empty-changeset finding and the consumed-changeset
path — were themselves covered only at the pure-core level. Their shell wiring
had no break class: deleting either collection line left both fixtures green. Two
more end-to-end scenarios close them, and all three `breakingFiles.push` sites are
now individually sabotage-verified.

That is worth recording rather than quietly fixing. The lesson the reviewers
taught was "the pure fixture cannot see the wiring", and the first response to it
reproduced the same gap on two new paths. A fixture that injects its input past
the seam proves the rule and nothing about how the rule is fed.

**Smaller, all measured by reviewers:** the detector matched a bolded span
anywhere (`a **Breaking** change but did not make one` fired — a false positive,
the direction that gets gates suppressed), and missed `## Breaking changes`,
`BREAKING CHANGES` plural and `__Breaking__`. Anchoring fixed those; a later pass
measured three MORE false positives, of which one — the conventional marker
matching prose _about_ the marker, including a changeset describing this very rule
— is fixed by anchoring it as the line-leading footer token the spec defines. The
other two (`**Breaking changes:** none`, `**Breaking change avoided**`) are
accepted and pinned as fixture cases with the reason: detecting them needs a
negation test inside the bolded span, which would trade a loud false positive for
a silent false negative on an irreversible path. The line-anchored form fixes the
first and the others are added. The consumed-changeset path discarded the marker,
so the release-time flow `RELEASING.md` documents — author at step 1, consume at
step 2, `validate` at step 4 — was blind. And the counts in the source comments
said 3 where the record and the gate said 4; the record was right and the comments
were stale, in the paragraph headed "measured, not guessed".

**Documented where a contributor reads it**, which no reviewer could find before:
`RELEASING.md` gains a "Signalling a breaking change" section, `.changeset/README.md`
gains the house convention beside the files being edited, and `CLAUDE.md`'s
`check:release` bullet now describes this rule.

**Filed, not absorbed:** [bug 0185](../0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)
— a correctly-declared kernel `minor` reaches adopters as a dialect `patch` saying
"Updated dependencies", with every gate green along the way. That is the same
silent path this bug is about, one level up, and fixing it is a release-practice
decision rather than a gate defect.

## Verification

- [x] A changeset saying "Breaking" while EVERY package it names takes
      `patch`/`none` fails the gate. **Qualified after review** — the unqualified
      form was false: with several packages and no owner named, one sibling on
      `minor` satisfies it even when the break is elsewhere. Name the owner in the
      marker and the rule checks that package.
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
