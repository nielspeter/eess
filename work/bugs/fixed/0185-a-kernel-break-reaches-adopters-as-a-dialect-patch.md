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

`.changeset/config.json` sets `updateInternalDependencies: "patch"`. That converts
a correctly-declared kernel `minor` into a `patch` on every dialect. On `0.x`,
`^0.3.0` / `~0.3.0` / `0.3.x` all resolve to `>=0.3.0 <0.4.0`, so a `minor` is a
real barrier for the package an adopter installs directly — and a `patch` is not.

So the break is announced on a package the adopter does not depend on, in a
version they never see, while the package they DO depend on says "Updated
dependencies".

## The repo already knows, and applies the fix by hand

`.changeset/assertion-less-rules-fail.md` names all six packages deliberately:

> **Every dialect is named deliberately.** … an adopter installs `eess-ts` … and
> reads _that_ package's changelog. Declaring only the kernel would route this
> text to a package they may not know exists, while their own changelog said
> "Updated dependencies" — the standalone-sufficiency failure `check:family`
> exists to prevent, in documentation rather than code.

That paragraph is the missing rule, written as prose and enforced by nobody. It is
the same situation bug 0184 was opened to fix, one level up: a convention that
holds only while whoever writes the changeset remembers it.

## Fix

`release/break-names-dependents`, in `scripts/release-gate.mjs`'s pure core.

**Option 1 of the two the draft offered — gate it — and the reason for choosing
it over changing propagation is that it fixes both halves.**
`updateInternalDependencies: "minor"` would raise a version barrier but leave the
dialect's changelog still saying "Updated dependencies"; the adopter would be
stopped without being told why. Naming the dependent in the same changeset gets it
its own bump AND the changeset's text in its own changelog. It is also what the
repo already does by hand — `assertion-less-rules-fail.md` names all six packages
and explains why in a paragraph — so this makes an existing convention
enforceable rather than inventing one.

A break declared on a package must name every workspace package that lists it in
`dependencies`. Any bump satisfies it except `none`, which records no changelog
entry — the half that matters here.

**Regular dependencies only, deliberately.** `eess-crossvalidate` peers on the
four dialects at `>=0.1.1`, and `onlyUpdatePeerDependentsWhenOutOfRange: true`
leaves a peer dependent unbumped on purpose — it is the countermeasure for the
`1.0.0` escalation. Requiring a peer dependent to be declared would fight that.
The residual cost (crossvalidate's changelog cannot record a sibling break) is
documented in `RELEASING.md` rather than gated.

The dependency graph makes the rule narrow: only `@nielspeter/eess` has regular
dependents, so in practice this says "a kernel break names its five dialects".
Measured — it reddens nothing on the current tree.

## Verification

- [x] A kernel break naming only the kernel fails. Sabotage-verified **on the real
      repo**: stripping the five dialect declarations from
      `.changeset/assertion-less-rules-fail.md` produces
      `release/break-names-dependents` naming all five missing packages, and
      `check:release` exits 1. Restored, exits 0.
- [x] Naming the dependents satisfies it — pinned in both fixtures, so a rule that
      fired on every breaking changeset could not pass.
- [x] `none` does not count as named. Pinned; without that row the `!== 'none'`
      condition was unexercised and survived deletion — found by running the
      mutation matrix rather than assumed.
- [x] **The shell wiring is covered, which is the mistake bug 0184 made twice.**
      The pure fixture passes `dependentsOf` in as a literal, so the code reading
      `dependencies` out of each `package.json` and inverting it is reachable only
      end to end. Two `bad-release-e2e.mjs` scenarios walk it. Five mutations run,
      five caught: rule returns nothing · dropped from the violations array · shell
      stops reading `dependencies` · argument severed at the call site · `none`
      counts as named.
- [x] Registered: `check:nonvacuity` is 43 fixtures (was 42), and the gate-coverage
      meta-check claims the rule under `check:release`.
- [x] Documented where a contributor reads it — `RELEASING.md` and `CLAUDE.md`.
- [x] `npm run validate` exits 0.

## Corrected in review

**The `because` over-claimed, and the record repeated it.** Both said naming the
dependent "fixes both halves at once". It fixes the INFORMATION half: the
dependent's changelog carries the changeset's real text instead of "Updated
dependencies". It does not raise a version barrier. Requiring "any bump except
`none`" is satisfied by `patch`, and `^0.3.0` still takes a patch silently —
review measured the rendered result on the very changeset this rule was modelled
on, where the **Breaking** paragraph lands under a `### Patch Changes` heading.
The rationale now claims only what the rule delivers.

**A third option nobody had considered.** The draft weighed gating against
flipping `updateInternalDependencies` globally, and rejected the latter as version
inflation. The targeted form — require dependents at `minor`, but **only on a
marked break** — inflates nothing on ordinary kernel minors and would close the
barrier half too.

It is not built, and the reason is that it changes the family's versioning policy
rather than enforcing an existing one. It would redden
`.changeset/assertion-less-rules-fail.md`, which declares its five dialects at
`patch` by deliberate hand and explains why in its own body. Taking that decision
as a side effect of a gate is the wrong way round. It is a live option, recorded
here so the weaker form does not calcify into "the convention" by default.

**The gate contradicted a skill.** `.claude/skills/release/SKILL.md` — the
document an agent loads when told to cut a release — says "Don't pad the changeset
with untouched packages … That fakes a change that didn't happen." The new rule
requires exactly that for a break. Two authorities in one repo giving opposite
instructions on the same file is the drift this project exists to catch, committed
by this project. The skill now carries the carve-out, and states why a propagating
break is not padding.

## Not fixed, and why

`updateInternalDependencies` stays `"patch"`. With the gate in place a kernel
break now reaches an adopter as a dialect release carrying real changelog text, so
the propagation setting is no longer the thing standing between them and the
information. Changing it would move every dialect's minor on every kernel minor,
breaking-or-not, which is version inflation bought for a case the gate now covers.

What remains uncovered is a kernel break that is never MARKED as one — the same
residue bug 0184 records, inherited here: this rule only runs on changesets the
detector recognises as breaking.
