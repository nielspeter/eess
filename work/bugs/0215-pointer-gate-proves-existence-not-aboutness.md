# Bug 0215: the pointer gate proves a line exists, and CLAUDE.md says it proves the line is right

## Status

- **State:** Draft — **13 distinct false citations, 27 occurrences**, all green in the gate
  (and 4 of the 27 in a location no gate reaches at all).
  Measured in three sweeps: 2026-08-22 (3 distinct / 3 occurrences), and two on 2026-09-29
  (5 / 10, then 5 / 14). _The unit matters and an earlier version of this line mixed them —
  it said "seventeen" by adding distinct pointers to occurrences. Distinct citations is the
  unit used throughout; occurrences are given beside it because a single stale pointer
  quoted in four records is four things a reader can be misled by._
  The third sweep rose **inside the correcting commit**: correcting five broke five more,
  and then `prettier` — a formatter the validate chain runs, with no human edit involved —
  broke three of the corrections a second time before they could be committed.
  "Correct the instances" is measured not to converge, and "re-resolve before committing"
  is measured insufficient. That is what moves the deferred half from nice-to-have to the
  actual fix.
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

## 2026-09-29: five more, and two of them were broken by the batch that cited them

A fourth round, and the count is rising rather than holding. Every citation in one
merged batch, resolved against the file it names:

| record                                   | citation                  | prose claims                         | the line reads                   | true |
| ---------------------------------------- | ------------------------- | ------------------------------------ | -------------------------------- | ---- |
| 0359, twice — one in a checked `[x]` box | disk-set 230              | `if (exhausted) return UNDETERMINED` | `const files: string[] = []`     | 299  |
| 0359, twice — one in a checked `[x]` box | disk-set 315-317          | `UNDETERMINED`'s `classify`          | a while-loop tail                | 384  |
| 0359                                     | disk-set 46               | `ENTRY_BUDGET`                       | a docstring line                 | 68   |
| 0357                                     | diagnose 492              | the cardinality exemption            | an unrelated comment             | 499  |
| 0355, 0357, 0348 and `BUGS.md` (×4)      | vacuity-diagnosis 253-255 | a quoted invariant                   | `* by what it does: it expires.` | 301  |

_(Line numbers given as plain text, because writing them as pointers would make this
table itself five false citations — which the gate correctly objected to when it was
first written that way.)_

_The last row's `true` column says 301 and was written 278._ The correction was measured
against the tree, then the same commit added 23 lines above it. See fact 3.

`check:corpus` was green over all five: 2,652 checks, 0 violations. Its success line
reads **`pointers 627 live · ✓ all ground in code`** — the overclaim is not only in
`CLAUDE.md`'s prose but in the gate's own report of itself, which is the sentence a
reader is most likely to trust.

**Three new facts this round adds to the record.**

**1. Two were broken by a commit inside the same batch that edited those records.**
They were correct at the `v0.10.0` tag; a commit in the series moved them; and later
commits in the same series edited those very records without re-resolving. So the
drift is not only slow rot across months — a single PR series can falsify its own
citations and ship them.

**2. Two of them sit inside checked `[x]` Verification boxes.** That is the escalation.
A pointer in prose is a reading aid; a pointer in a ledger box is _the evidence for a
fix's own confirmation_. `0359`'s box read "the mechanism confirmed: whole-set
`UNDETERMINED` at …, `classify` answering `not-determined` at …" and neither line held
either thing. The mechanism is real — the record's proof of it was false.

**3. Correcting the five broke five more distinct citations (10 occurrences) in the same
commit, and three of those five were broken by the correction's own code change.** The fix for bug 0362 that ships alongside
these corrections adds 23 lines to `vacuity-diagnosis.ts`. Every citation into that file
below the insertion point moved by 23 — including the four pointing at the invariant that
0355, 0357, 0348 and `BUGS.md` all quote, and the two pointing at the floor's cardinality
exemption. They were correct when written, in this branch, hours earlier.

| citation                                  | was | is  | broken by                                                             |
| ----------------------------------------- | --- | --- | --------------------------------------------------------------------- |
| vacuity-diagnosis (×4, the invariant)     | 278 | 301 | this branch's own +23-line code edit                                  |
| vacuity-diagnosis (×2, floor exemption)   | 417 | 440 | the same edit                                                         |
| vacuity-diagnosis (×1, in a test comment) | 260 | 318 | the same edit, **and** already wrong on aboutness before it           |
| `diagnose.ts:169` → `'condition'` skip    | 169 | —   | a refactor that moved the predicate to the kernel (`glob-site.ts:86`) |
| path-universe (×6)                        | 72  | 60  | drift; all six state the same claim                                   |

The last two were **not** shifted by this branch — they were already false, and the
sweep found them only because it looked beyond the lines the diff touched. A diff-scoped
check would not have seen them.

**And the sweep's own claim to be exhaustive was false.** An earlier version of this
paragraph said the sweep "resolved every citation into the files". It did not: it resolved
markdown under `work/`, `adr/` and `docs/`, plus the handful of test comments it happened
to touch. Enforcement review then found **four more occurrences of this very citation** —
`packages/ts/src/conditions/dependency.ts:223`, `:298`, `:383`, `:516`, each citing
path-universe at line 72 — in **source comments**, which `check:corpus` does not scope
to at all (bug 0351). So the sweep that documents the defect under-reported it by four,
for the structural reason the record is about, and a reviewer caught it rather than the
gate or the author. Corrected in this branch; the count above includes them.

**A fourth class, found by review of this very table: basename ambiguity.** The
path-universe correction above was first written as a bare basename at line 60 — correct
for `packages/core/src/path-universe.ts`, where the claim lives, and _also resolvable_ in
`packages/ts/src/core/path-universe.ts`, a 74-line file in the same package as the citing
test, whose line 60 is an unrelated string helper. Two files share the basename; the
citation named neither. So a correction can resolve to a real line in the wrong file, and
the reader who resolves it the obvious way is misled with no signal at all. Now written
package-qualified, in all six places.

**And here the gate is better than this record first said.** A draft of this paragraph
claimed the ambiguity class was one "a line-count check never can" catch. That is false,
and the gate proved it on this very file: writing those examples as live pointers reddened
`check:corpus` with four findings —

```
ambiguous code pointer: "path-universe.ts:72" matches 2 files
(packages/core/src/path-universe.ts, packages/ts/src/core/path-universe.ts)
 — cite a longer suffix so it names one
```

_Quoted in a fence, because quoting it in prose re-creates the pointer and the gate
objects again — which it did, once, while this paragraph was being written._

So `corpus/pointers-resolve` **does** carry an ambiguity check, and a good one. What let
all six occurrences through is **scope**, not capability: every one of them lives in a
source comment or a test, and the gate reads `work/`, `adr/` and `docs/` only (bug 0351).
That is a materially different finding from the one first written, and it points the
remedy somewhere else: the cheapest win here is not a new check, it is the existing
check's reach.

_Recorded rather than quietly corrected, because the first version was wrong in the same
way `CLAUDE.md` records about itself — an instrument that looks for one thing and reports
absence. The claim was made by reading the gate's summary line, not by running it against
an ambiguous pointer._

**5. And then `prettier` broke the same three citations a second time, in the same PR.**
This is the finding that settles the design fork, so it is worth stating precisely.

After every correction above was verified, `npm run validate` reddened on `format:check`.
Running `npm run format` reflowed the comment block in `vacuity-diagnosis.ts` — no
semantic change, no human edit, a formatter the validate chain runs on every commit — and
moved all three of its cited lines again:

| citation                 | corrected to | after `prettier` | occurrences |
| ------------------------ | ------------ | ---------------- | ----------- |
| the invariant            | 301          | **336-338**      | 4           |
| the floor exemption      | 440          | **476**          | 2           |
| the `declaresEmpty` exit | 318          | **354**          | 1           |

These are re-breaks of citations already counted above, not new ones, so the distinct
count does not move. What moves is the **conclusion**. Every earlier instance could be
blamed on an author: someone edited code and did not re-resolve. This one cannot. The
formatter is mechanical, it is unavoidable — it is in the gate chain — and it invalidated
seven occurrences with nobody making a decision at all.

**So "be careful when you edit" is not available as a remedy**, and neither is "re-resolve
before commit": this branch did re-resolve, twice, and the third break happened between
the last resolution and the commit, done by a tool. A line number is not merely fragile
under edits; it is _not stable under formatting_, which the repo enforces. That is the
argument for the fragment anchor stated at its strongest, and `CLAUDE.md`'s own
enforcement-table convention already warns about exactly this hazard for `it('…')` titles
— "a raw-text key is your formatter's to change, so `prettier` restyling a quoted title
can turn a correct citation red." The same hazard applies to every line pointer in the
corpus, and nothing says so.

This is the second row of the original table happening again, one scale up: a correction
written in the paragraph documenting the defect, invalidated by a later commit in the
same pull request. The difference is that this time the invalidating commit was the fix
itself, and the count went up rather than down. **A remedy that reliably creates more
instances than it closes is not a remedy.**

**What this does to the deferred half.** The Fix below describes an anchored-citation
mechanism and drops it on purpose, on the grounds that the design fork is unsettled and
the authoring cost is ~250 pointers. **That figure is asserted and wrong**: the gate's own
summary counts **627 live pointers** (240 live documents; a further 142 frozen, where
pointers go unchecked entirely). Four rounds of instances later, the cheaper variant
is worth re-costing: **carry the expected fragment and check the line contains it**,
with a citation that carries no fragment simply unchecked. That mirrors what
`check:docs-code` already does for changeset fences — state a claim and it becomes
checkable, state none and nothing is promised — and it needs no renumbering of existing
pointers, which was the objection that made the fork expensive.

**Does the `dropped-on-purpose` disposition still hold?** Not on the reasoning that
justified it. The Verification boxes below drop the anchored-citation half on two grounds:
the design fork is unsettled, and the authoring cost is ~250 pointers. This sweep moved
both — the cost is 627, and the fragment variant needs no renumbering, which was the
expense that made the fork look hard. The boxes are left as they are rather than flipped
here, because re-opening them is a scope decision and this record is not the change that
makes it; but the disposition is now **held on a reason that has been measured false**, and
should be re-taken when this record is next picked up. Flagged rather than silently left,
which is the failure mode the close ritual exists to catch.

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
