# Bug 0400: a one-way `beComplete()` counts the side it never reads

## Status

- **State:** Fixed — 2026-10-21, on branch `fix/0400-one-way-examined`, under choice (b) below: a
  correspondence counts what its checks read. Reproduced 2026-10-07 against this repo's build at
  `9d18f0e`; red tests first, 2026-10-21.
- **Severity:** High — **a false green that the documented remedy cannot catch.** A
  `correspondence()` checked in one direction, whose checked side selects nothing, passes. Adding
  `.expectNonEmpty()`, the declaration ADR-010 §3 provides for exactly this, does not turn it red.
- **Origin:** self-found 2026-10-07, measuring the composition proposal 013 describes. A consuming
  project hit the same false green independently, in its own corpus, the same day.
- **Reported:** 2026-10-07
- **Blocks (2026-10-21):** [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
  ask B and its fix. [Spike 0540](../../spikes/0540-one-join-over-every-source.md) reproduced this bug on
  their composition: a join whose mention side is empty is green with or without `.expectNonEmpty()`.
- **Tier:** 1–2. A kernel evidence defect under ADR-010 (§1, the unit; §3, declarations) and
  ADR-014 (the receipt carries `examined`).

## Symptom

All rows are `beComplete()`; L is the left side, R the right. Measured with this repo's CLI, about
25 ms per file:

| row | direction       | sides        | declaration         | result                                                  |
| --- | --------------- | ------------ | ------------------- | ------------------------------------------------------- |
| a   | `left-to-right` | L=[], R=[x]  | none                | **green**                                               |
| b   | `left-to-right` | L=[], R=[x]  | `.expectNonEmpty()` | **green**                                               |
| c   | `both`          | L=[], R=[]   | `.expectNonEmpty()` | red: declared non-empty, examined zero                  |
| d   | `both`          | L=[], R=[]   | none                | green, by design (below)                                |
| e   | `left-to-right` | L=[], R=[x]  | `.expectEmpty()`    | red: "examined 1 unit(s) — the declaration has expired" |
| —   | `left-to-right` | L=[y], R=[x] | none                | red: `left "y" has no matching right`                   |

- **Row b is the defect.** The author declared the checked side must never be empty, and the rule
  passed with it empty.
- **Row e is its mirror.** It tells the author their corpus grew, when the side it checks is
  empty. That is a false cause (ADR-009 rule 2).
- **Through eess-md:** a reciprocity rule whose left side is the links on a `**Related to:**` line
  stays green when the predicate's marker is misspelt, with or without `.expectNonEmpty()`. With no
  links at all and `.expectNonEmpty()`, it goes red.

## Reproduction

```ts
import { correspondence } from '@nielspeter/eess'
const side = (label: string, names: string[]) => ({
  elements: names.map((name) => ({ name })),
  label,
  identify: (e: { name: string }) => ({ name: e.name }),
})
export default [
  correspondence({ left: side('left', []), right: side('right', ['x']) })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .expectNonEmpty()
    .rule({ id: 'b/empty-left-expectNonEmpty' }),
]
```

`node packages/ts/dist/cli/bin.js check <file>`, from a directory that links `@nielspeter/eess`
and `@nielspeter/eess-ts` to this repo's packages: `✓ … 0 failing`, exit 0.

## Root cause

Line numbers in this section are as of `9d18f0e`, before the fix.

**`examined` counts both sides whatever the direction**
(`packages/core/src/correspondence.ts:139`): `left.elements.length + right.elements.length`.
A `left-to-right` check reads only the left side, so a non-empty right side reports evidence for a
check that asserted nothing.

- The zero-examined path, and the `.expectEmpty()` / `.expectNonEmpty()` checks with it, run only
  when `examined === 0` (`packages/core/src/terminal-builder.ts:290`, `:315-320`). Row a never gets
  there, so the declaration in row b is never consulted.
- The comment above the count states the design: "one side alone being empty is still real
  examination of the other" (`correspondence.ts:135-138`). That is true for `direction: 'both'`,
  where L=[] and R=[x] does go red (`x` has no matching left). It is false for one direction.
- ADR-010 §1 fixes the unit for `correspondence()` as "the key sets of its two sides"
  (`adr/010-a-pass-is-constructed-from-evidence.md:124-125`). For a one-way check, that unit
  includes a side nothing reads.

**`preserveRelations()` has the same root.** It shares the count and the exemption
(`correspondence.ts:123-129`). It compares matched pairs, so two non-empty sides that share no key
report `examined` = n+m with nothing compared. It is a different defect from
[bug 0084](../0084-preserve-relations-right-to-left.md).

**Row d is intended, not this bug.** `beComplete()` is cardinality-exempt
(`correspondence.ts:104-115`), and passing over two empty sides is pinned:
`packages/core/tests/correspondence.test.ts` ·
`it('beComplete() over two empty sides passes — an absence assertion with nothing to be absent')`.
The remedy for that case exists and works: `.expectNonEmpty()` turns it red (row c).

**Prior art.** eess-ts's `crossProject()` already reports an empty side and takes a per-side
declaration: `emptinessFindings` (`packages/ts/src/builders/correspondence-findings.ts:223`) and
`expectEmpty(side)` (`packages/ts/src/builders/correspondence-builder.ts:273`). The kernel's
`correspondence()` has neither. This is the shape of bug 0355, but not its remedy: 0355 asked the
disk, and a kernel `Selection` has no paths (ADR-013), so a disk check does not belong in core.

## Exposed callers

Every one-way `beComplete()` whose checked side can be emptied by a broken selector:

- `crossval/adr-citations-resolve` (`packages/crossvalidate/src/md-ts.ts:153-174`), left-to-right
  over ADR citations, in this repo's own `check:crossval`. If citation extraction returned nothing,
  the right side (every test title) keeps `examined` above zero and it passes. Reasoned from row a,
  not run end to end; its non-vacuity row goes red through a dangling citation, not an empty
  extraction.
- `packages/crossvalidate/src/mermaid-ts.ts:52-54` and `packages/crossvalidate/src/md-mermaid.ts:126-128`,
  whenever their direction option is one-way.
- `release/names-real-package` (`scripts/release-gate.mjs:291-302`), left-to-right with the whole
  workspace on the right.
- eess-md `rows()` + `correspondence()` compositions (`packages/md/src/index.ts:46-60`).

**One caller depends on today's count.** `scripts/release-gate.mjs:597-598`: "A correspondence
examines `|left| + |right|`, so it reports zero only when both sides are empty". Its `declaredEmpty`
values (`:608-615`) are built on that. Counting only the checked side changes both rules'
zero cases: `names-real-package` would examine zero whenever no changeset is pending.

## Fix

**Decided 2026-10-21: (b), only the count changes.** Each chained check reports the units it read,
and the builder sums them (`packages/core/src/correspondence.ts`, `CheckResult`): both sides for a
`beComplete()` in both directions, the checked side for a one-way one, and the left elements a
`preserveRelations()` compared, which is none under `direction: 'right-to-left'`
([bug 0084](../0084-preserve-relations-right-to-left.md)'s gap, now visible to `.expectNonEmpty()`).
Why (b): ADR-010 §3 already rules that an absence assertion over an empty selection is satisfied,
as `.notExist()` is, and rows a and d make the same claim. (a) would red row a and keep row d green,
which amends §3 as well as §1 and splits one claim into two verdicts. (b) amends only §1's unit,
which [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) now records, and makes the
declaration ADR-010 provides work. A `correspondence()` with no check chained now reads nothing,
so it reports zero examined units over any sides; it used to pass over non-empty ones.

`crossval/adr-citations-resolve` declares it: `adrCitationsResolve` takes `expectNonEmpty`, which
ADR-010 §3 requires of a preset that calls `.check()` itself, and `scripts/check-crossval.mjs`
passes it. `scripts/release-gate.mjs` declares each rule empty on its checked side alone.

**The merge, found by the first full validate (2026-10-21), widened with the maintainer's approval.**
With an empty changeset waiving the release gate's one rule and nothing declared, every member of its
`mergeCollectResults` examined zero, and the waived member (`notRun`) read as undeclared: the gate
reported a pass without evidence (`release/gate-fails-the-build`, "an empty changeset IN this diff
waives"). It had been green only because `names-real-package` counted the workspace it never read.
`packages/core/src/collect-result.ts` now asks only the members that ran to declare, and at least
one must have run; [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7
records it. `packages/core/tests/emitter-refuses-without-evidence.test.ts` pins both sides: a
`notRun` member beside declared ones is a declared pass (red before), and members that all never ran
are not.

What the decision had to weigh, as recorded before it:

Changing the unit for a one-way check amends ADR-010 §1 ("the key sets of its two sides"), so it
goes through an ADR amendment, not this record. The amendment is written with the fix, in the plan
or PR that builds it; until then this record owns getting it written. It is a breaking change for
adopters whose one-way correspondences start reporting, and its changeset is marked so.

**The decision includes the exemption, not only the count.** Fixing the count alone sends row a to
the zero-examined branch, where `beComplete()`'s cardinality exemption is checked
(`packages/core/src/terminal-builder.ts:318`) and returns no finding. Row a would stay green, the
same as row d. Rows a and d make the same claim (nothing on the checked side lacks a match, and it
is empty), so a fix that reds row a and keeps row d green has to narrow the exemption for one-way
checks or find another way to tell them apart. The decision picks one of:

- **(a) One-way checks lose the exemption when their checked side is empty.** Row a goes red with
  no declaration, and the pinned row-d test is kept only for `direction: 'both'`.
- **(b) Only the count changes.** Row a stays green, and an author who wants it red declares
  `.expectNonEmpty()` (row b). Rules in this repo that need it, starting with
  `crossval/adr-citations-resolve`, declare it.

Break classes the fix must pin, whichever is chosen:

1. **Under (a):** a one-way `beComplete()` whose checked side is emptied goes red, whatever the other
   side holds (row a). **Under (b):** `crossval/adr-citations-resolve` declares `.expectNonEmpty()`.
   Either way, a non-vacuity fixture that empties its citation extraction goes red in
   `check:nonvacuity`.
2. `.expectNonEmpty()` on a one-way check goes red when the checked side is empty (row b).
3. `.expectEmpty()` on a one-way check does not expire because the unchecked side is non-empty
   (row e).
4. `preserveRelations()` over two sides that share no key does not pass silently: by the same
   choice, it goes red under (a), or under (b) its `.expectNonEmpty()` fires.

The release gate keeps "the declaration comes from the input, the count from the rule"
(`scripts/release-gate.mjs:589-595`): its declarations become conditional on the checked side.

## Corrections

The first version of this record (2026-10-07) said the cardinality exemption caused the headline
case and called the double count "a second, smaller defect". Enforcement review showed the
exemption is never consulted when `examined` is above zero, so the order was backwards. Method
review found the record had missed `.expectNonEmpty()`, the eess-ts prior art, and ADR-010 §1, and
that its fix was a decision written into a bug. A second review round found that break class 1 could
not be met by fixing the count alone, because the exemption then applies; the decision above now
says so.

## Verification

- [x] Red test written first: row b — a `left-to-right` `beComplete()` over an empty left side with
      `.expectNonEmpty()` is reported. `packages/core/tests/correspondence.test.ts`, describe "a
      one-way check counts only the side it reads (bug 0400)": six of its tests were red before the
      fix, and its right-to-left twin with them.
- [x] row e does not report an expired declaration
- [x] row d stays green (pinned), and row c stays red: row d's pinned test is unchanged and green;
      row c had no test, and now has one.
- [x] the non-vacuity fixture that empties `crossval/adr-citations-resolve`'s citation extraction
      goes red in `check:nonvacuity`: `scripts/nonvacuity/bad-crossval-adr-empty.mjs` runs the real
      `check-crossval.mjs` over ADRs that cite no test, through `EESS_CROSSVAL_ADR_ROOT`. Sabotaged
      both ways on 2026-10-21: removing the declaration, and restoring the old count, each left the
      fixture vacuous (exit 0); restored, it exits 1.
- [x] row a: under (b), green without a declaration and red with `.expectNonEmpty()`
- [x] `preserveRelations()` over two sides that share no key does not pass silently (break class 4):
      it examines zero, so its `.expectNonEmpty()` fires.
- [x] the release gate stays green on a clean tree and on a clean tree with a pending changeset:
      `scripts/nonvacuity/bad-release-e2e.mjs` runs both ("a clean tree with the base at HEAD says it
      had nothing to read", and the pending-changeset scenarios) in `check:nonvacuity`, and
      `check:release` is green on this branch with three changesets pending.
- [x] the merge asks only members that ran to declare, with all-off still reported
- [x] `npm run validate` green.

Deferred: two gaps the fix leaves, found by PR #258's reviews on 2026-10-22, each with an open home.
The one-way crossvalidate presets other than `adrCitationsResolve` have no `expectNonEmpty` option:
[bug 0544](../0544-one-way-crossvalidate-presets-cannot-declare-non-empty.md). A `preserveRelations()`
over non-empty sides that share no key passes undeclared:
[bug 0545](../0545-preserve-relations-over-sides-sharing-no-key-passes.md).
