# ADR-011: The Kernel's Public API Is Explicit

## Status

Accepted (2026-08-24). Proposed 2026-08-23 and **built the same day** — the
entry point exists, 70 symbols sit behind it (78 moved in the first cut; review
sent five back to the root, a sixth was caught auditing the final list, and two
more were never internal), and the rows below
were rewritten against what shipped rather than what was intended.

The classification was the work, and it was judgment, exactly as the Context
predicted. The procedure used: seed with symbols taught by `docs/` or a package
README (requiring a code-ish mention — `red` and `bold` matched plain English
prose), close it transitively over the types needed to name a taught symbol, add
anything a dialect's emitted `.d.ts` imports, and put the rest behind
`/internal`. Then read the result and change what it got wrong — **nine calls in the
end, and the last five came from review, not from the author**: `correspondence` /
`CorrespondenceBuilder` (documented on six pages, and the public surface of eess-md
and eess-crossvalidate); `reportViolations` / `finishPreset` (named seams in
[ADR-008](./008-caller-owns-reporting.md)); `globNode` / `globAnyOf`, the only
author-facing constructors of the globs a user-written `definePredicate` declares —
putting them behind `/internal` made a documented path require the internal entry
point, and left `packages/ts/src/index.ts`'s own comment about them standing over the
types alone; and `CorrespondenceOptions` / `RelationSpec` / `KeyBy`, the parameter
types of `correspondence()` and `preserveRelations()`, both public, so a consumer
could call them and not name their arguments.

A sixth came later, from reading the finished list rather than from review:
`isArchRuleError`. Its own docstring is the argument — _"the same hazard exists for
any consumer with two copies of eess-ts on disk"_ — so the structural check exists
precisely for the consumer whose `instanceof ArchRuleError` returns false, and
putting it behind `/internal` put it out of reach of the person who needs it, while
the thrown shape it detects stays public. Identical to the `globNode` mistake.

Three that were audited in the same pass and correctly stayed internal, recorded so
the question is not reopened: `applyFixes` (only eess-ts's own CLI calls it, to
implement `--fix`, and no dialect ever re-exported it), and `Pair` / `MatchResult` /
`MatchOptions` (the result types of `matchSelections`, which is itself internal —
the `Pair` that appears in `docs/` is eess-ts's `LayerPair`/`PairCondition`, a
different type).

**The last two groups share one cause, and it is procedural.** The closure runs over
the seed and the manual reversals happen after it, so every reversal re-opens the
closure — and re-running it is the step a human skips. It is a test now:
`packages/core/tests/public-surface-is-nameable.test.ts` fails if any root export
names a type only `/internal` provides. The `ArchJson*` types
stayed public on the burden-on-removal rule that
`scripts/lib/kernel-surface.mjs:56` records.

Measured across the family: exported symbols 627 → 543, symbols documented
nowhere 224 → 139.

## Context

`@nielspeter/eess` has never written down what its public API is. It is
_implied_ — the union of whatever the five dialects happen to import from it.
Nothing declares the boundary, so nothing can check it, and two binding gates
end up asking questions that have no answer.

**Measured, 2026-08-23, before this ADR existed.** 224 of 627 exported symbols
across the family appeared in no `docs/` page, no package README and no ADR. But
those 224 rows were only **158 distinct names**: 63 names are counted two or
three times, because a dialect re-exports a kernel symbol it was required to
re-export.

The qualifier is load-bearing, and it is the first piece of evidence for this
ADR. `check:docs-code` treats `adr/*.md` as documentation and matches on a bare
word boundary (`scripts/lib/public-surface.mjs:98`), so **writing this ADR moved
the number to 214/153/58** — ten rows cleared by prose that names `shallowClone`,
`isRecord`, `GlobNode`, `not`, `and` and `or` in order to argue they are not API.
Repo-wide, 21 rows currently pass only because an ADR mentions the symbol.

A document that argues plumbing is undocumented thereby marks it documented. That
is fail-open, in a gate written to detect fail-open, and it is what an implied
boundary costs: with no declared public API, "documented" degrades to "mentioned
somewhere", because there is nothing else for it to mean.

That requirement is `family/re-export-complete`. Its `because` reads _"a
standalone consumer of one dialect must never need a second, direct
`@nielspeter/eess` install"_ — the right guarantee. Its implementation compares
against the kernel symbols **the whole package's `src/**` imports**
(`scripts/lib/family-re-exports.mjs:11`). Those are not the same set. A
consumer needs to *name* a kernel symbol only when the dialect's public surface
exposes it; `shallowClone` is called once, inside a method body
(`packages/ts/src/core/terminal-builder.ts:578`), and no consumer will ever
name it — yet the rule forces it onto eess-ts's published barrel, where
`check:docs-code` then reports it as undocumented public API. It is neither.

### Three instruments, and why none of them can decide this

Before proposing structure, the boundary was attacked as a _measurement_ — if
"reachable from the public API" could be computed, `family/re-export-complete`
could simply be narrowed and no new entry point would be needed. It cannot be.

| Instrument                                                   | Says        | Why it is wrong                                                                                                     |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| kernel symbols the package's `src/**` imports (today's rule) | 169 needed  | over-broad: includes `shallowClone`, `isRecord`, `byCodepoint`                                                      |
| names in emitted `.d.ts`, including the barrel               | 15 surplus  | **circular** — counts `index.d.ts`'s forwarding `export … from` lines, which exist _because_ of the rule under test |
| names imported by emitted `.d.ts`, excluding the barrel      | 131 surplus | under-broad, and falsified below                                                                                    |

The third looks principled: `tsc` emits `import type { X } from
'@nielspeter/eess'` into a `.d.ts` only when `X` is needed to describe the
public type surface. It correctly keeps `GlobNode`, which is a public return
type (`packages/ts/src/core/terminal-builder.ts:444`), and correctly drops
`shallowClone`. It is still wrong, and this repo's own code proves it: the
instrument reports `not`, `and` and `or` as surplus for eess-mermaid and
eess-md, while `family.rules.ts:22` reads

```ts
import { workspace, modules, or, and, not, resideInFile } from '@nielspeter/eess-ts'
```

The combinators are exactly what a consumer needs in order to write rules, and
they never appear in an emitted type because they are runtime values, not
types. A dialect that stopped re-exporting them would satisfy every mechanical
definition of "public API" while breaking the first rule file anyone writes.

**The conclusion is the decision's premise.** The contract is not "what
typechecks against this dialect". It is "what a consumer needs in order to use
it", and that is a judgment about API design. No instrument reads it off the
code, because the line does not exist anywhere to be read.

## Decision

**`@nielspeter/eess` declares its public API at its root entry point. Everything
the dialects need and consumers do not moves behind a second entry point,
`@nielspeter/eess/internal`. Every kernel symbol is in exactly one of the two.**

This is not a novel packaging device here. Subpath exports are already the
family's idiom: eess-ts ships twelve (thirteen `exports` keys, one of which is the root), and
eess-crossvalidate is composed entirely of them. `@nielspeter/eess` is the only package in the workspace with
a lone `"."`.

### 1. The root is public API, and public API is documented

A symbol exported from `@nielspeter/eess` is something a consumer may use, and
therefore something the corpus must teach. `check:docs-code`'s public-surface
gate already asks exactly this question (`scripts/lib/public-surface.mjs:98`);
today it is asking it of plumbing, which is why it reports a number nobody can
act on.

### 2. `/internal` is family plumbing, and a dialect never re-exports it

A dialect may import from `@nielspeter/eess/internal`. Its barrel must not
forward those names. This is the clause that removes the duplication: the 63
doubly-counted names are plumbing, and once they are behind `/internal` they
leave the dialects' published surfaces entirely.

### 3. Re-export completeness applies to root imports only

`family/re-export-complete` keeps its guarantee and loses its false premise. It
asks "does the barrel re-export what this package imports **from the root**",
which is answerable, instead of "…from the kernel", which is not. The
`ALLOWLIST` and the `KERNEL_INTERNAL` / `FAMILY_ONLY` /
`KERNEL_PRIVATE_BEFORE_THE_SPLIT` sets in `scripts/lib/kernel-surface.mjs:20`
exist today precisely because the rule over-asks; they are the hand-maintained
shadow of the boundary this ADR makes structural, and they shrink or disappear
as symbols move.

### 4. `/internal` is still a published, versioned contract

The six packages version independently. `/internal` ships in the tarball and
crosses a package boundary, so breaking it still requires a changeset naming
the dependents (`check:release`). `/internal` means "not for consumers"; it
does not mean "unversioned".

## Consequences

### Positive

- The boundary becomes a fact in the code rather than an inference from import
  graphs, so it can be checked, reviewed, and argued about.
- `check:docs-code`'s count becomes actionable: every remaining undocumented
  root export is genuinely a documentation debt, not a classification artifact.
- `family/re-export-complete` stops encoding a question with no answer.
- The hand-maintained not-public-surface sets stop being load-bearing.

### Negative

- **Someone must classify roughly 169 kernel names by hand.** That is the real
  cost and no measurement will pay it down; the three instruments above are the
  evidence. This is the trade-off the ADR accepts.
- It is a breaking change for anyone importing a moved symbol from the root.
- Two entry points is more surface to explain than one, and a wrong placement
  is now a decision someone made rather than an accident.
- **A subpath export is published and importable by anyone.** `/internal` is
  enforced inside this repo and is convention outside it. Recorded as a
  `manual` row below rather than left implied.

## Alternatives Considered

### Declare the internals in `KERNEL_INTERNAL` and leave the structure alone

Cheapest by far — the sets already exist. Rejected because it makes the
boundary _data maintained beside the code_ rather than a property of the code:
nothing stops a new plumbing symbol from being added to the root barrel and
never to the set, and the failure is silent in the direction that matters (a
symbol missing from the set reads as public API forever). It also keeps the
symbols on the dialects' published surfaces, so the duplication survives.

### Narrow `family/re-export-complete` mechanically and add no entry point

The preferred option until it was measured. Falsified above: every mechanical
definition of "public API" either keeps `shallowClone` or drops `not`. Shipping
a narrowed binding gate on any of the three instruments would have broken
consumers or changed nothing.

### Document all 158 distinct undocumented symbols

Honest about the count and wrong about the meaning: it enshrines
`resetEdgeCoverage` and `shallowClone` as API by writing them down, which is
the opposite of the intent, and it commits the corpus to teaching them forever.

### Do nothing

`check:docs-code` stays red on a number that mixes real documentation debt with
plumbing, which is the condition that makes a gate get waived rather than
fixed.

## Notes

This ADR fixes what "public surface" _means_; it does not by itself document
anything. Bug 0220 ("document the public surface") shrinks accordingly — most
of its 224 rows are reclassification, not prose — and what remains at the root
after classification is its real scope.

Whether `adr/` should count as documentation at all is left open here rather than
settled in passing. An ADR records a decision; it does not teach a consumer how to
use a symbol. Excluding `adr/` from the documentation blob would move the count
from 214 to 235 — a real change to a gate that is already red, and a decision
about what "documented" means, which is this ADR's subject but not this ADR's
clause. It belongs to the implementing plan, with the 21 affected rows named.

The `manual` row below is the one clause with no mechanism. It is recorded
rather than omitted because an Enforcement table whose every row says `gated`
is usually a table that stopped asking hard questions.

## Enforcement

| Clause                                                                                     | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status   |
| ------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Every symbol exported from the kernel root appears in `docs/`, a package README, or an ADR | 1    | `scripts/check-surface.mjs`, wired as `check:surface` and **last** in `npm run validate` and in `.github/workflows/ci.yml`. It blocks on the kernel root (this clause's population) and prints the dialect surfaces as a reported census. Last is deliberate: the first version sat mid-chain, and `validate` is one `&&` sequence, so while it was red `lint`, `format:check` and the whole suite never ran — including row 2's own mechanism. Non-vacuity: `scripts/nonvacuity/bad-waived-gates.mjs` scenario 2 adds an undocumented braced export to the kernel root and asserts the gate NAMES it; an exit-code assertion could not tell detection from an unrelated red                                                                                                                                                                                                                                                                                                                                                                                                                    | `gated`  |
| No dialect barrel re-exports a symbol obtained from `@nielspeter/eess/internal`            | 1    | `packages/ts/tests/standalone-surface.test.ts` · `it('no symbol behind @nielspeter/eess/internal is reachable from eess-ts')`, with `it('the internal entry point is non-empty, so the guard above can actually fail')` beside it so the assertion cannot pass over an empty set. Shipped as a runtime test rather than the `family.rules.ts` rule this row first described, and that choice costs two things, both real: `import * as ns` sees only VALUE exports, so a dialect re-exporting an `/internal` **type** is not caught; and the test reads eess-ts's barrel only, so **md, mermaid, gherkin and crossvalidate are unguarded**. The clause holds across all five today — measured, no barrel forwards `/internal` in either form — but it is guarded in one. The runtime form sidesteps the transitive-re-export trap a static scan would have walked into — `reachableExportNames` (`scripts/lib/family-re-exports.mjs:111`) needs `getExportedDeclarations()` precisely because a direct-only scan produced 16 false positives here — but the type-only gap is real and unguarded | `gated`  |
| Re-export completeness is computed from root imports only                                  | 1    | **No code change is required here, and the row says so rather than implying work.** `kernelImportsOf`'s two specifier tests are already strict equality against `'@nielspeter/eess'` (`scripts/lib/family-re-exports.mjs:83`), not a prefix match, so `@nielspeter/eess/internal` imports are invisible to re-export completeness the moment the subpath exists. `gated` as of 2026-08-24: the subpath exists, so the existing strict-equality test now does the whole job and `check:family` is green with the internals absent from every dialect barrel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `gated`  |
| A break in `/internal` declares a release naming its dependents                            | 3    | `check:release` (`scripts/check-release.mjs`) already reads changeset bodies for a break marker and requires a bump past patch; `/internal` is inside the same package, so this needs no new mechanism — recorded so the clause is not assumed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `gated`  |
| Consumers do not import `@nielspeter/eess/internal`                                        | 4    | **None possible.** A subpath export is published and resolvable by any consumer; nothing in npm, TypeScript or this repo can prevent it. The name and its documentation are the whole mechanism, and review is the only backstop. The documentation half exists as of 2026-08-24 — `packages/core/README.md`'s "Two entry points" section says what `/internal` is, why it is published at all, and that the root is what you want. It shipped absent, which review caught: a `manual` row whose stated mechanism does not exist is not `manual`, it is nothing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `manual` |
