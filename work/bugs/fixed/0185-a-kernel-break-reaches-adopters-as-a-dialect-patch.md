# Bug 0185: a kernel break reaches adopters as a dialect patch

## Status

- **State:** Fixed — gated, sabotage-verified on the real repo.
- **Deferred:** none
- **Found:** 2026-08-20, adopter review of the bug 0184 fix.
- **Severity:** the silent path 0184 was opened about, one level up. Every gate is
  green along it, and correctly so.

## Symptom

An adopter installs `@nielspeter/eess-ts`. They have never heard of
`@nielspeter/eess` — that is the standalone-sufficiency promise, and `check:family`
exists to keep it true. The kernel is a **direct dependency**, not a peer, so the
adopter holds no version range on it.

Measured in a throwaway worktree: a kernel-only breaking change, **correctly
declared `minor`**, run through the real `changeset version`:

```
@nielspeter/eess                0.4.0
@nielspeter/eess-ts             0.3.1   dep: "@nielspeter/eess": "^0.4.0"
@nielspeter/eess-md             0.4.1   dep: "^0.4.0"
@nielspeter/eess-mermaid        0.2.1   dep: "^0.4.0"
```

`packages/ts/CHANGELOG.md`, verbatim:

```
## 0.3.1
### Patch Changes
- Updated dependencies
  - @nielspeter/eess@0.4.0
```

An adopter on `^0.3.0` takes `0.3.1`. Dependabot auto-merges it. Their changelog
says "Updated dependencies". The break is in there.

`check:release` printed `✓ 1 of 1 changeset(s) declare a break, each bumping past
patch` throughout — and it was right. The changeset was correct.

## Root cause

An undeclared dependent **inherits** the release as a `patch`, and no configuration
changes that. On `0.x`, `^0.3.0` / `~0.3.0` / `0.3.x` all resolve to
`>=0.3.0 <0.4.0`, so a `minor` is a real barrier for the package an adopter
installs directly and a `patch` is not. Declaring the dependent is the only lever
there is.

**The first version of this record blamed `updateInternalDependencies: "patch"`,
and that was a mechanism which does not exist.** It was asserted in four places.
Review read the changesets source: `assemble-release-plan` hard-codes the
inherited type — `if (type !== 'major' && type !== 'minor') type = 'patch'` — and
never reads that setting at all; it is consumed only by `apply-release-plan` as
`minReleaseType`, the threshold for rewriting the dependency RANGE string.
Measured: flipping it to `"minor"` leaves `eess-ts` at `0.3.1`, unchanged.

The error mattered twice. It invented a cause, and it made a rejected alternative
look like a real option with a stated cost ("version inflation") when it in fact
does nothing.

## The repo already knows, and applies the fix by hand

`.changeset/assertion-less-rules-fail.md` names all six packages deliberately:

> **Every dialect is named deliberately.** … an adopter installs `eess-ts` … and
> reads _that_ package's changelog. Declaring only the kernel would route this
> text to a package they may not know exists, while their own changelog said
> "Updated dependencies" — the standalone-sufficiency failure `check:family`
> exists to prevent, in documentation rather than code.

That paragraph is the missing rule, written as prose and enforced by nobody.

## Fix

`release/break-names-dependents`, in `scripts/release-gate.mjs`'s pure core: a
break declared on a package must name every workspace package that lists it in
`dependencies`, **at `minor` or `major`**.

`minor`, not merely "named". Three reviewers converged on this independently and
it is what the measurement supports. With the dependent at `patch`, `eess-ts`
releases as `0.3.1` and the rendered entry reads `**Breaking:** …` under a heading
saying `### Patch Changes` — an adopter's caret range still takes it without
asking. At `minor` it releases as `0.4.0`, with the text under `### Minor
Changes`. Both measured with the real `changeset version`.

An earlier version of this rule accepted any bump except `none`, and this record
claimed that "fixes both halves at once". It did not — it fixed the information
half and left the barrier exactly as the bug found it. That claim was wrong twice:
once when written, and once when corrected to "information half only" while the
remedy printed to contributors still said "any bump will do".

**The cost is one pending changeset.** `assertion-less-rules-fail.md` declared its
five dialects at `patch`; they are now `minor`, which is what its own body says it
wants. This does change how the family versions on a marked break — every
dependent moves a minor — and that is the deliberate trade: a break that reaches
an adopter silently is the thing the bug is about.

**Regular dependencies only — and the first reason given for that was false.**
This said requiring a peer dependent to be declared would fight
`onlyUpdatePeerDependentsWhenOutOfRange`, the countermeasure for the `1.0.0`
escalation. Measured against the real `changeset version` with this repo's own
config: a peer dependent declared `minor` releases as a **minor**, no escalation,
with the changeset's text in its changelog. That setting governs automatic bumping
of an _undeclared_ peer dependent.

What survives is weaker — a peer is a range the consumer resolves — and weaker
still here, because `eess-crossvalidate` peers at `>=0.1.1`, unbounded.

**The live cost, stated because it is larger than "a residual".** Of the breaking
changesets currently pending, most break a DIALECT, and a dialect's only workspace
carrier is `eess-crossvalidate` — excluded. So the rule constrains the kernel edge
and abstains on the rest. **Widening it to peers is an OPEN decision**, not a
closed one: it would require crossvalidate to be declared `minor` on several
pending changesets, which is a second versioning-policy change and belongs to
whoever owns the release.

The graph keeps the rule narrow: only `@nielspeter/eess` has regular dependents,
so in practice it says "a kernel break names its five dialects at minor".

## Corrections from review

- **The causal model was false** — see Root cause. Four places corrected.
- **"Fixes both halves" was false** when the rule accepted `patch`. It is true now
  that the rule requires `minor`, and it is stated as a measured outcome rather
  than an argument.
- **The gate contradicted a skill.** `.claude/skills/release/SKILL.md` — the
  document an agent loads when told to cut a release — says "Don't pad the
  changeset with untouched packages … That fakes a change that didn't happen."
  This rule requires exactly that for a break. Two authorities in one repo giving
  opposite instructions is the drift this project exists to catch. The skill now
  carries the carve-out.
- **A reviewer read the rule as firing where no harm occurs.** Stripping the five
  dialect rows and running `changeset version` leaves `eess-ts` at `0.4.0` anyway,
  because an unrelated pending changeset declares it `minor` — so the _version_
  looked fine. Re-measured: `eess-ts`'s changelog then contains the other
  changesets' text and **nothing** about this break, which appears only in the
  kernel's. The barrier can be raised by accident; the missing text cannot be. The
  question is therefore per-FILE, not per-release: whether some other changeset
  happens to bump the dependent is incidental, and the pending set is not stable.

## The attestation had no break class, twice

Two independent mutation matrices (28 and 37 mutations, neither reusing this
record's) agreed on the pass/fail behaviour: **every mutation that makes the real
gate miss a genuine violation is caught by a fixture.** Both then found the same
weakness somewhere else — in what a GREEN run says about itself.

The honest-zero line could be replaced with a fabricated
`✓ N of N changeset(s) declare a break, each bumping past patch` in one edit, and
both fixtures stayed green. That is the same sentence, verbatim, that bug 0184's
review caught lying over a severed rule. The earlier fix pinned
`stats.breakingExamined` — the value, where the bug was diagnosed — and left the
sentence, where it was seen, unasserted. No scenario ever entered that branch under
assertion.

Three more of the same shape: a red run's `✗` count could be forced to zero and
print a ✓ over its own finding; the loose-check qualifier — added specifically to
disclose a residue — could be silenced silently; and the new rule shipped with **no
denominator at all**, one commit after this file argued a denominator from the
wrong source is worse than none. All four are now asserted as SENTENCES in the
end-to-end fixture, and each was re-verified by re-running its mutation.

The general lesson, which is now the third variation of it on this branch: pinning
a value does not pin the claim made about it, and the claim is what a reader acts
on.

## Verification

- [x] A kernel break naming only the kernel fails. Sabotage-verified on the real
      repo, naming all five missing packages; `check:release` exits 1.
- [x] Naming the dependents at `patch` **also** fails — pinned end to end, because
      that is the state the bug is actually about.
- [x] Naming them at `minor` passes, and the adopter is protected: measured with
      the real `changeset version`, `eess-ts` lands on `0.4.0` and its changelog
      carries the break text. Previously `0.3.1` under "Patch Changes".
- [x] `none` does not count. Pinned; without that row the bump condition was
      unexercised and survived deletion.
- [x] **The shell wiring is covered** — the mistake bug 0184 made twice. The pure
      fixture passes `dependentsOf` in as a literal, so the code reading
      `dependencies` out of each `package.json` is reachable only end to end. Five
      mutations run, five caught.
- [x] `check:nonvacuity` is 43 fixtures; the gate-coverage meta-check claims the
      rule under `check:release`.
- [x] Documented in `RELEASING.md`, `.changeset/README.md`, `CLAUDE.md`, and the
      release skill.
- [x] `npm run validate` exits 0.

## Not fixed, and why

`updateInternalDependencies` stays `"patch"` — not as a decision, but because it
has no bearing on this. Changing it moves nothing.

What remains uncovered is a break that is never MARKED as one: both rules run only
on changesets the detector recognises. That residue is inherited from bug 0184 —
**and it has a live instance on this very tree**, which review found and this
record originally obscured by saying the rule "reddens nothing on the current
tree" as though that showed good scoping.

`.changeset/baseline-records-what-it-measured.md` declares `@nielspeter/eess:
minor` and `@nielspeter/eess-ts: minor` and carries **no marker**. Its body says a
baselined ceiling could silently stop meaning what it meant — by the standard
`ledger-inherits-the-evidence-gate.md` applies to itself ("a corpus that
previously passed can now fail on upgrade with no code change of its own" →
marked `**Breaking**`), that is the same class. So the kernel minor ships and the
four unnamed dialects publish patches reading "Updated dependencies", carrying it.
That is this bug's mechanism, live, green, in the same directory as its fix.

Keying on the marker is still right — inferring a break from prose is the
unfalsifiable alternative. But "reddens nothing today" is a fact about what is
marked, not evidence that nothing is breaking.

**That instance is now marked**, and marking it exercised the owner form on the
real repo for the first time. It reads
`**Breaking (@nielspeter/eess-ts)**` rather than a bare lead, because the
mechanism lives in the kernel's baseline while only `eess-ts` produces findings
carrying a `measured` value — verified: `eess-md`, `-mermaid`, `-gherkin` and
`-crossvalidate` produce none, so their adopters hold no baselined measurement
that could stop comparing. Naming them would announce a change their users cannot
observe, which is the padding `.claude/skills/release/SKILL.md` warns against.

The owner is load-bearing, not decorative: flipping `eess-ts` to `patch` fires
`release/breaking-needs-minor` **even though the kernel is still `minor`**.
Without the owner, "at least one past patch" would have been satisfied by the
kernel and the rule would have stayed silent — the multi-package hole this record
describes, closed on a real changeset rather than only in a fixture.

The reasoning has a stated expiry: if a dialect ever gains a metric finding, that
changeset's owner list is wrong. Nothing checks it — the metric census scans
`packages/ts` only, which is the gap already filed as
[bug 0175](../0175-kernel-configuration-findings-sit-outside-every-census.md).
