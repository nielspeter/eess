# Bug 0159: Violation identities collide, so baselining one finding silently baselines others

## Status

- **State:** Draft — three distinct collisions reproduced against the built
  dist; no red test yet.
- **Severity:** High — false green. Baselining is the documented way to adopt
  eess on an existing codebase. When two distinct findings share one identity,
  accepting one silently accepts the other, and the second never reappears.
- **Origin:** self-found · [fold audit](../fold-audit-2026-08-19.md)
  (upstream bugs 0064, 0067, 0065)
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
`minLines(3).withMinSimilarity(0.9)`:

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

1. Add the disambiguation pass so post-resolution collisions are separated.
2. Include a positional or ordinal discriminator in the duplicate-pair
   identity, so same-named subjects in one file differ.
3. Set `identity` on reverse-dependency findings.

Also decide whether a **collision is itself detectable** — a check that two
findings in one run never share an identity would have caught all three, and
would catch the next one. That is likely cheaper than auditing each producer
forever, and belongs in this record as a ruling either way.

## Verification

- [ ] Red test first, one per collision, asserting **distinct identities** (or
      distinct `hashViolation` values) — not finding counts, which pass today.
- [ ] A cross-cutting test: for a corpus producing many findings, no two share
      an identity.
- [ ] Control: identical findings that genuinely _are_ the same still share an
      identity, so baselining does not become per-run noise.
- [ ] The "detect collisions generically" ruling is recorded here.
- [ ] Existing baselines: state whether this changes identities for already-
      baselined findings, and if so how adopters migrate (upstream shipped a
      `hashVersion` for exactly this; eess has none — see
      [the audit](../fold-audit-2026-08-19.md), upstream 0010/0060).
- [ ] `npm run validate` green.

Deferred: none.
