# Bug 0185: a kernel break reaches adopters as a dialect patch

## Status

- **State:** Draft — measured end to end with the real `changeset version`.
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

Not built — it is a release-practice decision, and the two answers differ in what
they claim.

1. **Gate it.** When a pending changeset declares a break and names
   `@nielspeter/eess`, require every dialect depending on the kernel to be named
   in that same changeset. All inputs are already in `releaseViolations`:
   `workspacePackages` plus each `package.json`'s `dependencies`. It would redden
   nothing today — `assertion-less-rules-fail.md` already names all six.
2. **Change the propagation.** `updateInternalDependencies: "minor"` would carry a
   kernel minor to the dialects as a minor, making the barrier real without
   anyone remembering anything. Bigger blast radius: every kernel minor then moves
   every dialect's minor, and the family's version numbers drift faster.

(1) is cheaper and matches how the repo already behaves. (2) is the one that
protects an adopter who never reads a changelog.

Related and out of scope here: `@nielspeter/eess-crossvalidate` declares peers
`>=0.1.1` on all four dialects, so a dialect breaking minor produces no bump and
no changelog line for it, and its unbounded range admits the broken version. That
is `onlyUpdatePeerDependentsWhenOutOfRange: true` working as designed — the
countermeasure for the `1.0.0` escalation — and the cost is that crossvalidate's
changelog can never record a sibling break. Worth a line in `RELEASING.md`.

## Verification

- [ ] A kernel break either names its dependent dialects, or propagates to them as
      something an adopter's range will not silently take.
- [ ] Whichever is chosen, an adopter reading only `@nielspeter/eess-ts`'s
      CHANGELOG learns that something broke.
- [ ] The gate states which form it checked, as `release/breaking-needs-minor`
      now does — a green must not read the same for both.
