# Plan 0218: require a proposal to state its acceptance criteria

## Status

- **State:** Draft — split out of [plan 0216](./0216-dogfood-the-proposals-lane.md) on
  2026-08-23, which shipped the lane's close and board gate without it. This is the one
  item there that still turns on decisions reserved for the author; it is a Draft
  precisely so those stay open.
- **Priority:** Medium — `PROPOSALS.md` requires the section and nothing checks it, but
  unlike 0216's items the miss has no measured live consequence yet.
- **Effort:** Small **if** the rule stays script-local; Medium if the honest answer is a
  depth-aware condition in `eess-md`, which makes it a published package change with a
  changeset. That choice is Open Question 1.
- **Created:** 2026-08-23

## Problem

`PROPOSALS.md`'s template requires, per capability, the **break class** — the specific
corruption that must produce a violation — **and how non-vacuity is kept**. Proposal 006
as submitted delivered the first and omitted the second entirely: zero occurrences of
"non-vacuity", "fixture", "examined", "tier" or "warn".

**And the convention has never once been met in the shape the template prescribes.**
Measured across the whole lane on 2026-08-23:

| proposal      | heading                          | depth                                              |
| ------------- | -------------------------------- | -------------------------------------------------- |
| 001           | `## Acceptance Criteria`         | 2 — capital C                                      |
| 002           | `## Acceptance Criteria`         | 2 — capital C                                      |
| 003, 004, 006 | none                             | —                                                  |
| 005           | `### Acceptance criteria (…)` ×4 | 3, all inside superseded Rewrite/Appendix sections |

`PROPOSALS.md` writes it lower-case. **No proposal matches that string.** So the honest
framing is not "001's lesson committed twice" — it is that the template and the corpus have
never agreed, which is a stronger reason to gate it and a different rule.

## What the rule can honestly assert

A heading rule proves _a heading exists_. "Did the author state a break class and how
non-vacuity is kept" is Tier 4, and this plan will not pretend to check it. The structural
version worth having is **section plus a table with named columns** —
`haveTableRowsSatisfying` is the primitive, and it is how the ADR Enforcement table is
already gated (`packages/md/src/rules/adr.ts`). Still Tier 1, but it cannot be satisfied by
a bare heading with three words under it. **The rule's `because` must say what it does not
prove.**

## Open questions

Reserved for the author. A review surfaces and argues these; it does not settle them.

1. **Where the depth check lives.** `hasSection` (`packages/md/src/model/query.ts:9-11`)
   reads `s.name` only and never `s.depth`, though the model carries it
   (`packages/md/src/model/document.ts:10`). Two answers:
   - a script-local `definePredicate` — no package change, ships immediately;
   - a depth-aware option on `haveSection` in `eess-md` — the dogfooding answer, since a
     family that cannot state its own lane convention in its own dialect is the finding,
     but it changes a published package.

   Note an anchored regex may make the question moot: `/^acceptance criteria$/i` matches
   001 and 002's `## Acceptance Criteria` and does **not** match 005's
   `### Acceptance criteria (…)`, because the parenthetical is part of the heading name.
   Measure that before deciding either option is needed.

   Do **not** use a bare substring: measured, it matches 005 on four `###` headings inside
   superseded Rewrite/Appendix sections — a forged membership suppressing a red. (An
   earlier draft also claimed it matches 006 "on a mention inside its own review". It does
   not: `hasSection` iterates headings only, and 006's occurrence is inline code in a
   paragraph, which no heading rule can see.)

2. **Migration, and it is a denominator decision.** 4 of 6 proposals would red on day one.
   Both options have a consequence to state, not just pick:
   - _Fix 001/002's casing, exempt 003–006 by an explicit committed list_ — the precedent
     is `adrEnforcement`, which exempts by name rather than by date. The real denominator
     is then 2 of 6, and the summary must print that honestly rather than "6 scanned".
   - _Gate forward from a date_ — the rule examines **zero** proposals on day one. Under
     ADR-010 zero examined units is a configuration finding unless declared, so this needs
     an explicit `.expectEmpty()`-shaped declaration or it is the "0 checks scanned" green
     this repo treats as a red flag.

   Deferring the choice means the first green run is blocked on proposal 006 growing a
   section its own review says it cannot write until Ask B leaves `Held`.

## A second rule, added 2026-08-23: a ruling that names a remedy must name an owner

Found while auditing the lane after [plan 0216](./0216-dogfood-the-proposals-lane.md) gave
it terminal states, and it is the same defect class 0216's review found four times over: a
convention stated in prose with no mechanism.

**Measured.** Proposal 004's ruling was `Docs-only` — _"the capability already ships; what
is missing is any documentation pointing at it."_ That names a remedy and creates **no
owner**. Ten days later the listing surface (`documents()`, `root`, `fileIndex`) appeared
in **0** files under `docs/` and **0** package READMEs, and the proposal's own header read
`Draft — primitive **declined** … Ruling is **docs-only**`, which reads as settled. The
remedy had evaporated and nothing could tell.

The same shape on the other side: proposal 002 says its widened primitive is _"deferred
behind plan 0090"_, and 0090 cited 002 back **in prose only** — the exact thing
[bug 0141](../bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md) found, on the
one live case the `**Implements:**` mechanism existed for. Both are now declared, but
nothing would have caught either.

**The rule.** A proposal whose operative Ruling is `Docs-only`, or whose header defers a
remainder, must name an owner that resolves — the same shape as
`corpus/promoted-proposal-names-no-owner`, applied one state earlier. It belongs here
rather than in 0216 because it is about **what a proposal must state**, which is this
plan's whole subject.

**Open question 3.** "Defers a remainder" is prose today (`deferred behind plan NNNN`) and
a rule cannot key on prose without inviting the false positives bug 0110 warns about. Two
answers: gate only the closed case (`Docs-only` ⇒ an owner), which is Tier 1 and cheap; or
introduce a machine form for the deferral, which is new lane vocabulary and a bigger ask.
Reserved for the author, like the two above.

## Out of Scope

- Everything 0216 shipped: the lane's terminal states, `promoted/` / `declined/`, and the
  board ↔ file Ruling rule.
- Retro-fitting acceptance criteria onto proposals 001–006 as content. Whether they are
  _required_ to have it is Open Question 2; writing them is not this plan's work.
