# Bug 0215: the pointer gate proves a line exists, and CLAUDE.md says it proves the line is right

## Status

- **State:** Draft — three measured instances in one day, all green.
- **Deferred:** the anchored-citation half — see Verification
- **Found:** 2026-08-22, across the review rounds on bug 0209 and proposal 006. Named as
  deserving its own record in
  [0209](./fixed/0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md) and by two
  reviewers; never filed until now, which is itself the finding's shape.

## Symptom

`corpus/pointers-resolve` (`scripts/check-corpus.mjs:133`) asserts `.resolve()`, whose
description is _"resolve to a real file and line"_ and whose implementation
(`packages/md/src/conditions/pointer-resolve.ts:96`) resolves the path and bounds-checks
the line against the file's line count.

`CLAUDE.md:133` describes it as:

> A pointer you cite must hit the **real line**.

Those are different claims. The gate proves the line **exists**; the prose promises the
line is **the one the citation is about**. A citation that drifts onto an unrelated line
passes, silently, forever.

## Measured — three instances, one day

| citation                                                    | drifted onto                                                                   | gate  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ----- |
| proposal 006 → `md-mermaid.ts:56` "selects mermaid fences"  | a JSDoc line, after bug 0209's fix moved the code                              | green |
| proposal 006, **re-anchored** → `md-mermaid.ts:143` / `:93` | `suggestion:` (a violation field) and JSDoc, after the same PR's later commits | green |
| `PROPOSALS.md:131` board row → `md-mermaid.ts:143`          | same                                                                           | green |

The second row is the one that matters: the re-anchor was written _in the paragraph
documenting this defect_, verified at the time, and invalidated by a later commit in the
same pull request. Three independent reviewers found it; the gate never could.

## Root cause

A line number is not a durable reference to a fact. Any edit above the cited line moves
it, and nothing ties the citation to what it claims. The gate is doing exactly what it was
built to do — the defect is that its guarantee is weaker than the guarantee the corpus
relies on, and `CLAUDE.md` states the stronger one.

## Fix — two halves, and the second is a design decision

1. **Correct the claim now.** `CLAUDE.md:133` should say what the gate proves: the file
   exists and the line is in range. This is the honest half and it is one sentence. Under
   ADR-009 an over-claimed guarantee is worse than a stated-weak one, because readers stop
   checking.

2. **Make aboutness checkable.** This repo already ships the shape, one lane over: ADR
   Enforcement tables cite `` `path/to/file.test.ts` `` · `it('exact title')`, and
   `check:crossval` resolves the **title** against the real AST — no line number, nothing
   to drift. The equivalent for a code pointer is to cite an anchor that must be present
   at the target — a line number plus the symbol that must be present there, or a
   required substring.

   <!-- eess-exclude corpus/pointers-resolve: the illustrative citation below is a shape, not a real target -->

   ```
   `packages/crossvalidate/src/md-mermaid.ts:186 classDiagramBlocks`
   ```

   Whether that becomes a new citation form, an optional one, or a second rule alongside
   the existing one is a real design decision with corpus-wide authoring cost — ~250 live
   pointers today. If it needs sequencing, it needs a plan; this record owns the defect
   and the honest-claim half.

## Verification

> **Scope note, added after review.** This record owns the honest-claim half only, and three
> of the four boxes below need the mechanism it defers. They are disposed here rather than
> left to look deliverable: closing this bug on an undischargeable checklist is how a
> `deferred→<home>` with no home gets written. **The honest half ships no gate** — after it
> lands, a citation that drifts onto an unrelated line still passes silently. That is the
> correct trade under ADR-009 (stated-weak beats over-claimed), and it is not a fix.

- [ ] `dropped-on-purpose` — red first: a pointer whose line exists but
      whose content has nothing to do with the citing prose. All three rows above are
      ready-made fixtures.
- [ ] `CLAUDE.md`'s description matches what the gate asserts.
- [ ] `dropped-on-purpose` — a citation whose anchor is absent at the
      target reds, and the message names the anchor and what is actually there.
- [ ] `dropped-on-purpose` — a break class in `scripts/nonvacuity/`; an
      emptied aboutness check must not stay green.

**Deferred:** the anchored-citation mechanism. **No plan is filed for it, deliberately** —
the design fork (optional anchor vs required, and ~250 pointers of authoring cost either way)
is not settled enough to write a Ready plan against, and a Draft plan reserving a number for
an unsettled design is the phantom this corpus's own lane guards forbid. So this is a
`dropped-on-purpose` for now with the reasoning above it: the honest-claim half ships, the
mechanism is described, and whoever wants it has the design fork written down. Re-file as a
plan when the fork is decided.

## Out of scope

- **Reflowing the ~250 existing pointers** into an anchored form. If the anchor is
  optional, existing citations keep working and the gate strengthens where authors opt in.
  That trade is the design decision above.
