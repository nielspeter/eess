# Bug 0220: `check:docs-code` compiles the fences that exist and requires none

## Status

- **State:** Draft — the gate is built and blocks on the kernel root (all 85 root exports
  documented as of 2026-08-24); the 89 dialect-side exports and the denominator holes are
  reported, not required, and are what keeps this record open.
- **Priority:** Medium — no live incorrectness, but it is the gate-shaped half of a defect
  this repo has now hit twice, and the second time it went ten days unnoticed.
- **Origin:** self-found — closing [bug 0219](./fixed/0219-corpus-listing-surface-is-undocumented.md),
  which documented three symbols that had shipped undocumented since they were written.
  0219's own ledger asked what stops that recurring. Nothing does.

## Symptom

`check:docs-code` compiles every import-bearing TypeScript fence in `docs/` and the package
READMEs — 51 of them, and it is a genuinely good gate: the fence in 0219's fix
dereferences four properties of `GherkinScenario`, so `tsc` would have failed it had any
been wrong about the shipped type.

**It requires no fence to exist.** Deleting a documented section is silent. Adding a public
export with no documentation is silent. The gate proves that what is written is _true_,
never that anything is _written_.

Measured 2026-08-23, over named exports in each dialect's `src/index.ts`, against every file
in `docs/` and `packages/*/README.md`. **Split by kind, because it changes what the fix can
be:**

| kind           | exported | undocumented | share |
| -------------- | -------- | ------------ | ----- |
| runtime values | 486      | 169          | 35%   |
| types only     | 210      | 121          | 58%   |
| **total**      | **696**  | **290**      | 42%   |

**The instrument, sanity-checked.** Widening the doc corpus to include `adr/` moves the
runtime figure only 169 → 160, so the number is not an artefact of where it looked. But it
is still a **word-boundary grep**, which cannot tell a documented concept from an incidental
mention and counts every exported type including ones that only appear inside a signature.
Read it as a ceiling. One spot-check shows the residual error is real and small:
`reportViolations` reads as undocumented against `docs/` + READMEs and **is** discussed at
length in `adr/008` — so a consumer reading the docs site would not find it, which is
arguably still the gap, but the grep cannot make that judgement.

## Repro

Delete the "What did the corpus actually load?" section from `packages/md/README.md` — the
one [bug 0219](./fixed/0219-corpus-listing-surface-is-undocumented.md) just added — and run
`npm run validate`. It is green. The gate that "covers documentation" cannot see the
deletion, because it only ever visits fences that are present.

## Root cause

`scripts/check-docs-code.mjs` iterates fences found in the corpus. Its denominator is
therefore _supply_, not _demand_: it answers "is every fence correct?" and the question
nobody asks is "does every public symbol have one?". That is the exact asymmetry
[ADR-009](../../adr/009-agent-first-failure-surfaces.md) is about — a check whose green is
constructed from what happens to be there.

It is also the second instance of one pattern in one week. 0219 was the first: proposal
004's `Docs-only` ruling named documentation as the whole remedy, and ten days later none
of it existed with every gate green.

## Fix — the decision this needs first

Not obvious, and **spiked 2026-08-23 rather than argued.** All three candidates were measured
and all three cost something real:

1. **Per exported symbol.** Reds on **160 runtime exports** on day one. The obvious
   denominator-shrinker does not exist: this repo already has a curated "exported but not
   public surface" concept — `KERNEL_INTERNAL`, `FAMILY_ONLY`, `ANSI_INTERNAL`,
   `KERNEL_PRIVATE_BEFORE_THE_SPLIT` in `scripts/lib/kernel-surface.mjs` — and together they
   total **31 names**. Adopting this option means curating roughly 130 more, which is a
   suppression registry starting deeply in debt. Compare `KNOWN_FAIL_OPEN`
   (`scripts/vacuity-matrix.mjs:244`), the one per-item registry here, which is deliberately
   **empty** with a comment saying it should stay that way.

   That the sample is dominated by plumbing — `byCodepoint`, `registerCacheReset`,
   `selectionMemo`, `presetConstructsNothingViolation` — is the point: `check:family` forces
   dialects to re-export every kernel symbol their own source imports, so "exported" is a
   much wider set than "public API a consumer calls", **by design**.

2. **Per curated entry point.** Measured against this repo's own list of the entry points
   that matter — the 15 builders and presets `scripts/vacuity-matrix.mjs` probes —
   **0 of 15 are undocumented.** The rule would examine 15 and find nothing, today and
   probably for a long time. Under ADR-010 that is a configuration finding unless declared,
   and declaring it means shipping a gate whose green is structural.

3. **Ratchet on the count.** Cheap, and it is the shape `check:baseline` already uses. It
   also accepts 33% of the runtime surface as correct, silently, which for a repo whose
   thesis is that specs must not drift from code is a large thing to accept without saying
   so out loud.

**The decision is which cost to pay**, and it is the author's. What is not open: whichever
ships must print its own denominator, because a doc-coverage rule that examines nothing is
this same defect one level up.

## Verification

- [x] Red first: deleting a documented section reds, naming the symbol that lost its fence.
      **done-otherwise** — the gate is keyed on the SYMBOL, not the fence, so the red-first
      case is an undocumented export rather than a deleted section: `scripts/check-surface.mjs`
      reds naming it. Measured on the branch that built it, 253 of 664 at the first run.
- [x] A committed violating fixture, so an emptied implementation cannot stay green.
      `scripts/nonvacuity/bad-waived-gates.mjs` scenario 2. Note what it took to make that
      claim true: the first version appended `export const X = 1`, which the gate's parser
      (braced lists only) could not see, and asserted a non-zero exit the gate produced
      anyway — so it passed while testing nothing. It now sabotages the kernel root with a
      braced export and asserts the gate NAMES the symbol.
- [x] The gate prints symbols examined and symbols covered — a zero or an unexpectedly low
      denominator is the failure to watch.
      It prints the kernel-root denominator on success and the dialect census either way.
      **The denominator has known holes and they are not fixed here:** `exportsOf` reads only
      `packages/<pkg>/src/index.ts`, so `eess-crossvalidate` (no `index.ts`, seven subpath
      entries) contributes **zero**, eess-ts's twelve subpaths are unscanned, and a
      declaration-form or `export *` re-export is invisible. Found in review.
- [ ] **deferred→ this record** — the 89 dialect-side undocumented exports. The gate reports
      them; nothing requires them. ADR-011 clause 1 governs the kernel root only, so blocking
      on the dialects would be a gate enforcing more than any decision authorises.
- [ ] **deferred→ this record** — the denominator holes above. Drive the scan off each
      package's `exports` map instead of one hardcoded file.

Deferred: this record (the dialect surfaces, and the denominator holes).
