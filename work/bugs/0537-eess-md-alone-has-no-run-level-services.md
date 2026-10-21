# Bug 0537: eess-md alone has no run-level services

## Status

- **State:** Draft — measured by reading the exports and call sites on 2026-10-21; no red test yet.
- **Severity:** Medium — **an adopter who installs eess-md alone cannot use three things eess-md's
  own findings and README rely on**: it cannot apply the fixes eess-md's conditions emit, cannot
  make a baseline, and is not told what an in-file waiver suppressed. The first two fail loudly (a
  missing import); the third is silent, which is the fail-open half.
- **Origin:** self-found, 2026-10-21, by the product and enforcement reviews of
  [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md), whose adoption path
  rests on all three. The defect predates that proposal.
- **Reported:** 2026-10-21

## Symptom

Each run-level service lives in the kernel and is reached only through eess-ts:

| service                  | where it is                                                                                         | reachable from eess-md alone?                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| apply a fix (`ArchFix`)  | `applyFixes`, exported from `@nielspeter/eess/internal` only (`packages/core/src/internal.ts:24`)   | no: eess-md has no `bin`, and the only caller is `eess-ts check --fix --apply` (`packages/ts/src/cli/commands/check.ts:2`) |
| make or read a baseline  | `withBaseline`, `generateBaseline`, exported from the kernel root (`packages/core/src/index.ts:87`) | no: `packages/md/src/index.ts` re-exports neither, so an eess-md user needs a direct `@nielspeter/eess` install            |
| disclose waived findings | `commentSuppressionNotice()`, from `/internal` (`packages/core/src/internal.ts:85`)                 | no: called only by eess-ts (`packages/ts/src/core/check-all.ts:163`, `packages/ts/src/cli/commands/check.ts:283`)          |

eess-md's conditions emit fixes today (`movedLinkFix`, `packages/md/src/model/resolve-link.ts:257`),
and its README says baseline mode works "unchanged" (`packages/md/README.md:41`).

`check:family` (plan 0089) does not catch the baseline gap: it requires a dialect to re-export the
kernel symbols its own source imports, and eess-md's source imports none of these.

The waiver half is the one that matters most. A rule run from a script or a test, as this
repository's own `scripts/check-corpus.mjs` runs eess-md, applies a reason-bearing
`<!-- eess-exclude … -->` and prints nothing about what it hid, so a region waiver over a whole
file reads exactly like a clean file.

## Root cause

The services were built for eess-ts's runner, where the CLI and `checkAll` own a run; the kernel
exposes the pieces, and eess-md was never given a door to them. Whether eess-md should gain its
own door, re-export the kernel's, or document a second install is the decision.

## Fix

Undecided. A shape is not chosen here; the three halves may close separately, and the waiver
disclosure first, since it is the silent one.

## Verification

- [ ] A red test: an eess-md rule with a waiver that suppresses a finding, run through eess-md's
      own door, says what it suppressed.
- [ ] An adopter with eess-md alone can make a baseline, or the README says it cannot.
- [ ] An adopter with eess-md alone can apply eess-md's fixes, or the README names the second
      install.
