# Bug 0159: Violation identities collide, so baselining one finding silently baselines others

## Status

- **State:** Draft — three distinct collisions reproduced against the built
  dist; no red test yet.
- **Severity:** High — false green. Baselining is the documented way to adopt
  eess on an existing codebase. When two distinct findings share one identity,
  accepting one silently accepts the other, and the second never reappears.
- **Origin:** self-found · [fold audit](../fold-audit-2026-08-19.md)
  (upstream bugs 0064, 0067, 0065)
- **Shipped in:** partly. Collision (3) — reverse-dependency findings with no
  `identity` — is in the published `0.2.x` (`reverse-dependency.ts` in
  `810808b` has zero `identity` mentions). Collision (2), the `duplicate-pair::`
  formula, is fold-era and therefore only in the unpublished `0.3.0`.
- **Reported:** 2026-08-19

## Symptom

Three separate producers emit findings whose identities are not distinct.
Filed as one bug because they share a root — an identity built from too few
components — and a fix should establish one rule for all of them rather than
patch three formulas independently.

1. **Two spellings of one module collide.** A file importing the same target
   by relative path and by tsconfig alias produces 2 findings and 1 hash.
2. **Same-named functions in one file collide.** The duplicate-pair identity is
   `<file>#<name>` with no disambiguator, so three identically-named functions
   in one file produce 3 findings and 1 identity.
3. **Reverse-dependency findings carry no identity at all.** `beImported()`
   pushes without setting `identity`, so two orphan modules produce 2 findings,
   byte-identical messages, and 1 hash.

## Reproduction

All three measured against `packages/ts/dist`.

**(1)** Fixture with `paths: {'@app/*': ['src/*']}`, one file importing
`src/legacy/index.ts` both ways:

```
notImportFrom  → 2 findings, identities …::dynamic::/…/legacy/index.ts::  ×2 → 1 hash
                 2 findings, identities …::import::/…/legacy/index.ts::old ×2 → 1 hash
```

**(2)** Three identical `function errorResponseBuilder` in one file,
`minLines(3).withMinSimilarity(0.9)`. **Two caveats a reader will otherwise
trip on:** three top-level functions of one name is a `tsc` error ("Duplicate
function implementation") — ts-morph tolerates it, `tsc` does not, and the
fixture must be built that way to reproduce (nested functions and class
methods are collected as `wrapperOne`/`Alpha.errorResponseBuilder` and are
already distinct). And the bodies must be rich enough to clear
`DuplicateBodiesBuilder`'s undisclosed `minDistinctVocabulary = 8` default
(`packages/ts/src/smells/duplicate-bodies.ts:35`), which silently rejects
short identical bodies. With both, it reproduces exactly:

```
3 findings, all identity duplicate-pair::/…/dup.ts#errorResponseBuilder::/…/dup.ts#errorResponseBuilder
→ 1 hash
```

**(3)** Two orphan modules `src/alpha/index.ts`, `src/beta/index.ts`:

```
beImported() → 2 findings, identity undefined on both, 1 distinct hash
```

A count-based test cannot see any of these — all three report the right
_number_ of findings.

## Root cause

- **(1)** No `disambiguateIdentities` pass anywhere in eess. Upstream added one
  to separate findings whose identity would otherwise be equal after
  resolution.
- **(2)** `packages/ts/src/smells/duplicate-bodies.ts:224` builds the pair
  identity from `<file>#<name>` only.
- **(3)** `packages/ts/src/conditions/reverse-dependency.ts:195` pushes the
  violation without an `identity` field. The _message_ half of upstream's fix
  did come across (`:136` names the importer by path); the identity half did
  not.

All three predate plan 0088's fold — eess forked from ts-archunit at ~0.17 and
froze; upstream fixed them afterward and the fixes were not carried. See the
[fold audit](../fold-audit-2026-08-19.md) for how this was found.

## Why it matters

`packages/core/src/baseline.ts` matches on identity. Two findings sharing one
identity means:

- baselining the first silently baselines the second;
- fixing the first makes the second look "already accepted" rather than new;
- the count in a baseline file does not correspond to the findings it covers.

None of this is visible from a passing run, which is what makes it a false
green rather than a nuisance.

## Fix

Establish one rule — an identity must be distinct for any two findings a reader
would consider different — and apply it at all three producers rather than
patching each formula:

**Placement, ruled up front** (PR #70's review raised this, and plan 0150 took
a hit of exactly this shape): the three fixes do not live in one package.
Fix (1) and the collision check are **kernel** work — every dialect emits
`ArchViolation`s that feed `packages/core/src/baseline.ts`, so building them in
`packages/ts` guarantees md/mermaid/gherkin/crossvalidate reinvent them. Fixes
(2) and (3) are dialect-local, in `packages/ts`'s smells and conditions layers.

1. Add the disambiguation pass **in `packages/core`** so post-resolution
   collisions are separated for every dialect.
2. Discriminate the duplicate-pair identity so same-named subjects in one file
   differ — **but not with a run-ordinal.** An ordinal suffix yields distinct
   identities within a run and _unstable_ identities across runs: every re-run
   mints new hashes and no baseline ever matches again. That is upstream's own
   bug 0056 ("a cycle identity changes when imports are reordered")
   re-committed, and neither a "distinct identities" assertion nor a
   single-run control can see it. Use something derived from the subject —
   declaration order within the file is stable; a source position is stable
   under edits elsewhere in the repo but not within the file. Record the
   choice and its stability argument here.
3. Set `identity` on reverse-dependency findings.

Also decide whether a **collision is itself detectable** — kernel-side, next to
`hashViolation`, where it can see every dialect's output — a check that two
findings in one run never share an identity would have caught all three, and
would catch the next one. That is likely cheaper than auditing each producer
forever, and belongs in this record as a ruling either way.

## Verification

- [ ] Red test first, one per collision, asserting **distinct identities** (or
      distinct `hashViolation` values) — not finding counts, which pass today.
- [ ] **Identity content, not just distinctness.** "Distinct identities" is
      `new Set(ids).size === n` — a count one level up, blind to _what_ each
      identity says. Assert that the alpha finding's identity names alpha.
- [ ] **Cross-run stability.** Two runs over the same unchanged corpus produce
      the **same** identity set. Without this, an ordinal discriminator (see
      Fix 2) passes every other box while destroying baselining.
- [ ] The cross-cutting test carries its own **denominator**: assert the
      finding count is the expected non-zero number _and_ that identities are
      pairwise distinct. "No two share an identity" passes vacuously on 0 or 1
      findings (ADR-010).
- [ ] Control: identical findings that genuinely _are_ the same still share an
      identity, so baselining does not become per-run noise.
- [ ] The "detect collisions generically" ruling is recorded here.
- [ ] Existing baselines: state whether this changes identities for already-
      baselined findings, and if so how adopters migrate (upstream shipped a
      `hashVersion` for exactly this; eess has none — see
      [the audit](../fold-audit-2026-08-19.md), upstream 0010/0060).
- [ ] `npm run validate` green.

Deferred: none.
