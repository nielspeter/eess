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

**Regular dependencies only.** `eess-crossvalidate` peers on the four dialects at
`>=0.1.1`, and `onlyUpdatePeerDependentsWhenOutOfRange: true` leaves a peer
dependent unbumped on purpose — the countermeasure for the `1.0.0` escalation.
Requiring a peer dependent to be declared would fight it. The residual cost
(crossvalidate's changelog cannot record a sibling break) is in `RELEASING.md`.

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
on changesets the detector recognises. That residue is inherited from bug 0184 and
recorded there.
