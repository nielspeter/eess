# Bug 0400: a one-way `beComplete()` counts the side it never reads

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `9d18f0e`, with the kernel
  alone and with an eess-md composition. Rewritten the same day after enforcement and method
  review: the first version blamed the cardinality exemption, which never runs in the headline
  case (see "Corrections"). No red test yet.
- **Severity:** High — **a false green that the documented remedy cannot catch.** A
  `correspondence()` checked in one direction, whose checked side selects nothing, passes. Adding
  `.expectNonEmpty()`, the declaration ADR-010 §3 provides for exactly this, does not turn it red.
- **Origin:** self-found 2026-10-07, measuring the composition proposal 013 describes. A consuming
  project hit the same false green independently, in its own corpus, the same day.
- **Reported:** 2026-10-07
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
[bug 0084](./0084-preserve-relations-right-to-left.md).

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
- `packages/crossvalidate/src/mermaid-ts.ts:52-54` and `packages/crossvalidate/src/md-mermaid.ts:158-160`,
  whenever their direction option is one-way.
- `release/names-real-package` (`scripts/release-gate.mjs:291-302`), left-to-right with the whole
  workspace on the right.
- eess-md `rows()` + `correspondence()` compositions (`packages/md/src/index.ts:46-60`).

**One caller depends on today's count.** `scripts/release-gate.mjs:597-598`: "A correspondence
examines `|left| + |right|`, so it reports zero only when both sides are empty". Its `declaredEmpty`
values (`:608-615`) are built on that. Counting only the checked side changes both rules'
zero cases: `names-real-package` would examine zero whenever no changeset is pending.

## Fix

Not designed, and it needs a decision first. Changing the unit for a one-way check amends ADR-010
§1 ("the key sets of its two sides"), so it goes through an ADR amendment, not this record. The
amendment is written with the fix, in the plan or PR that builds it; until then this record owns
getting it written. It is a
breaking change for adopters whose one-way correspondences start reporting, and its changeset is
marked so.

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

- [ ] Red test written first: row b — a `left-to-right` `beComplete()` over an empty left side with
      `.expectNonEmpty()` is reported
- [ ] row e does not report an expired declaration
- [ ] row d stays green (pinned), and row c stays red
- [ ] the non-vacuity fixture that empties `crossval/adr-citations-resolve`'s citation extraction
      goes red in `check:nonvacuity`
- [ ] row a: red under (a); under (b), green without a declaration and red with
      `.expectNonEmpty()`
- [ ] `preserveRelations()` over two sides that share no key does not pass silently (break class 4)
- [ ] the release gate stays green on a clean tree and on a clean tree with a pending changeset
- [ ] `npm run validate` green.

Deferred: none.
