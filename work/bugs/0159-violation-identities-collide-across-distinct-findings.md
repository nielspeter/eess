# Bug 0159: Violation identities collide, so baselining one finding silently baselines others

## Status

- **State:** Draft — **half fixed.** Within one run, the identity repair pass separates every
  collision below (it shipped with #72; this record was not updated). **Across runs, collision
  3 still fails open**, measured 2026-10-05 through the real baseline: fix the orphan you
  baselined, add a different one of the same name, and the baseline forgives it. Pinned as a
  known gap; see "State on 2026-10-05".
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

## Fix — measured 2026-08-19

Built and measured in an isolated worktree against a green baseline
(kernel 145/145, md 113/113 before any patch).

| check                                                                                                                                      | before    | after      |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| (1) two spellings of one module — distinct hashes                                                                                          | **1**     | **2** ✓    |
| (2) three same-named functions — distinct identities                                                                                       | **1**     | **3** ✓    |
| (2) three same-named functions — distinct hashes                                                                                           | **1**     | **3** ✓    |
| (3) reverse-dep — every finding carries an identity _(built in the 2026-08-19 worktree; never shipped — see "State on 2026-10-05")_        | **false** | **true** ✓ |
| (3) reverse-dep — distinct hashes                                                                                                          | **1**     | **2** ✓    |
| CONTENT: an identity names `alpha`, not just "is distinct" _(built in the 2026-08-19 worktree; never shipped — see "State on 2026-10-05")_ | false     | **true** ✓ |
| STABILITY: two runs over one corpus → same identity set                                                                                    | true      | **true** ✓ |
| DENOMINATOR: findings produced (3 and 2)                                                                                                   | 3 / 2     | 3 / 2      |
| `check:arch` · `check:family` · `check:spec`                                                                                               | green     | green      |
| kernel / md suites                                                                                                                         | 145 / 113 | 145 / 113  |

> **Correction — this record's own prescription was wrong.** It said to
> discriminate the duplicate-pair identity _"but not with a run-ordinal"_,
> arguing an ordinal would recreate upstream bug 0056 (identities unstable
> across runs). Checked against what upstream actually shipped: **its answer
> _is_ a run-ordinal.** For identical bodies with identical names there is no
> content left to discriminate on — that is what makes them duplicates. What
> makes the ordinal safe is _where_ it is applied and what surrounds it, not
> avoiding it.

**The design, which is a central repair pass and not a per-producer fix.**

`disambiguateIdentities(violations)` runs in `applyFilters`, **ahead of
enrichment and of every filter** — so a finding's identity is a property of
what the _rule found_, not of what a `--changed` or `.excluding()` run happened
to keep. Suffixing after filtering would give one finding different identities
in CI and on a laptop, which is the defect `identity` exists to prevent.

Three properties that are easy to lose, each measured:

- the **first** occurrence keeps its subject verbatim, so existing baselines do
  not churn — the migration is empty;
- generated suffixes are **reserved** against keys a producer already emits, so
  closing one collision cannot open another (`[X, X, X, X#1]`);
- nothing collides in the common case, and the input is returned untouched.

Stability rests on producers emitting in a **deterministic order** — asserted
by the cross-run row above, not assumed.

**`identityCollisions()` is the part that matters most.** A repair pass hides
the thing it repairs: after it runs there is nothing left for a guard to see,
so a colliding producer looks fixed. Collisions are therefore recorded _before_
the repair and exposed (with `resetIdentityCollisions()` for `beforeEach`).
Measured: it names the exact rule and subject that collided. This is what keeps
the net from becoming a blindfold, and it is exported from `@nielspeter/eess/internal`, where the guards in a dialect's own suite import it _(corrected 2026-10-05: first written "re-exported from `eess-ts`", which it is not)_.

**Only one producer actually needed fixing.** Reverse-dependency findings set
no `identity` at all, so the baseline subject fell back to
`element::message` — and `element` is the **basename**, so two orphan
`index.ts` files in different folders produced byte-identical subjects. They
now carry `reverse-dep::<full path>::not-imported`. _(built in the 2026-08-19 worktree; never shipped — see "State on 2026-10-05")_ The duplicate-pair
producer is left alone: its identity string is **byte-identical to upstream's**,
which never fixed it either — the repair pass is the answer there, and the
disclosure keeps it honest.

**A gate caught the fix, again.** The three new kernel exports were not
reachable from `eess-ts`, which plan 0089's standalone-sufficiency contract
(`check:family`) reports. Re-exported.

## State on 2026-10-05

Re-measured on `main` after a close was attempted and withdrawn — testing review found the
close claimed more than was true. What holds and what does not:

- **Within one run: fixed.** `disambiguateIdentities` (`packages/core/src/violation.ts`), run in
  eess-ts's `applyFilters`, separates every colliding group by position, and the first member
  keeps its pre-repair identity. Already pinned, with values rather than counts, by
  `packages/ts/tests/core/identity-uniqueness.test.ts` —
  `it('beImported reports both orphans with distinct hashes')` and
  `it('and the first orphan keeps the identity a pre-fix baseline recorded')`, and the bug-0064
  block for collision 1.
- **Across runs: collision 3 is still open.** `beImported`
  (`packages/ts/src/conditions/reverse-dependency.ts`) sets no `identity`; its `element` and its
  `message` are both the basename, so every orphan `index.ts` in a project has one identity, and
  the position the repair gives it is all that separates it. Measured through
  `generateBaseline` / `withBaseline().filterNew`: run 1's one orphan `src/a/index.ts` is
  baselined; in run 2 it is imported and `src/b/index.ts` is the new orphan; `filterNew` reports
  nothing. Pinned as a known gap by
  `packages/ts/tests/core/a-baselined-orphan-forgives-the-next-one.test.ts`, which flips red
  when the identity carries the path (measured: it does).
  _The Fix section above says reverse-dependency findings carry
  `reverse-dep::<full path>::not-imported`, and the withdrawn close said "its message now
  carries the path". Neither is true for `beImported`: the path-carrying message belongs to
  `onlyBeImportedVia`._
- **Collisions 1 and 2 across runs:** their members are indistinguishable by content, so a
  positional identity is all there is (`violation.ts` records this as a known fail-open). That
  is [bug 0338](./0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md)'s
  class. [Plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md) does
  **not** fix them: its Phase 1 changes only `identifyMatches`, which `dependency.ts` and the
  duplicate-bodies detector do not call. They stay open here (narrowed 2026-10-05 after method
  review of the plan).
- **Collision 2 has changed shape:** the duplicate-bodies detector now reports one finding per
  cluster, and two clusters of same-named functions still collide (only reachable from code
  `tsc` rejects: duplicate function implementations).
- **Not measured:** whether eess-md, eess-mermaid or eess-gherkin producers can collide. Their
  `applyFilters` (the kernel's) does not run the repair pass at all, so if they can, it is a live
  false green in `check:corpus` and `check:diagram`.

**The fix for collision 3** is now
[bug 0388](./0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md)'s. Review of plan
0346 found that `beImported` is one instance of a kernel fault: with no `identity`, the file is
not in a finding's baseline hash at all. Plan 0346's Phase 2 fixes that class and its
migration covers it, so collision 3 is ticked here when that ships.

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
- [x] The "detect collisions generically" ruling is recorded — `identityCollisions()`
      does exactly this, recording before the repair so a producer defect stays
      visible. See Fix.
- [ ] Existing baselines: state whether this changes identities for already-
      baselined findings, and if so how adopters migrate (upstream shipped a
      `hashVersion` for exactly this; eess has none — see
      [the audit](../fold-audit-2026-08-19.md), upstream 0010/0060).
- [ ] `npm run validate` green.

Deferred: none.
