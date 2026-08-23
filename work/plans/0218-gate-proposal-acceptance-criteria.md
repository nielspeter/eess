# Plan 0218: require a proposal to state its acceptance criteria

## Status

- **State:** Draft — split out of [plan 0216](./completed/0216-dogfood-the-proposals-lane.md) on
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

Reserved for the author. **Spiked 2026-08-23** rather than argued — an earlier draft of this
plan claimed both were "answered by precedent", and the spikes falsified that.

### 1. Where the depth check lives — **resolved, and not the way the draft said**

The draft argued an anchored regex made depth moot. Measured against every real heading:

| proposal      | heading                                                  | depth | `/^acceptance criteria$/i` |
| ------------- | -------------------------------------------------------- | ----- | -------------------------- |
| 001           | `Acceptance Criteria`                                    | 2     | match                      |
| 002           | `Acceptance Criteria`                                    | 2     | match                      |
| 005           | `Acceptance criteria (revised)` ×2, `(v1)`, `(original)` | 3     | no                         |
| 003, 004, 006 | none                                                     | —     | —                          |

005 fails to match because of the **parenthetical**, not the depth. A future
`### Acceptance criteria` with no parenthetical, inside a superseded appendix, would satisfy
an anchored regex. So depth is not moot; it was coincidentally unnecessary against today's
corpus, which is exactly the kind of green this repo distrusts.

**The real resolution is cheaper than either option the draft posed.** `MdSection.depth` is
public (`packages/md/src/model/document.ts:10`) and `definePredicate` is already imported by
`scripts/check-corpus.mjs`, which uses it twice. So
`doc.sections.some((s) => s.depth === 2 && /^acceptance criteria$/i.test(s.name))` is a
script-local predicate reading depth directly — no `eess-md` change, no changeset, and
structurally correct rather than accidentally correct. This question is closed.

### 2. The denominator — **genuinely open, and no framing is clean**

Measured across every plausible scope:

| framing                               | examined | would red | on                  |
| ------------------------------------- | -------- | --------- | ------------------- |
| every proposal                        | 6        | 4         | 003 006 **004 005** |
| live only (not `promoted`/`rejected`) | 4        | 2         | 003 006             |
| accepted ruling only                  | 1        | 1         | **005**             |
| live **and** accepted                 | 0        | 0         | — (ADR-010 vacuous) |

Each fails differently:

- **Every proposal** reds two terminal records. 004 and 005 are closed history; retro-fitting
  acceptance criteria into them is rewriting the record, not enforcing a convention.
- **Live only** reds 003 and 006 — and **both are legitimately unable to comply.** 003's
  ruling is `Rewrite needed` precisely because "no entry states a break class", so the rule
  would demand the thing the rewrite exists to produce. 006's own review states it cannot
  write acceptance criteria until Ask B leaves `Held`. A gate that reds on records correctly
  mid-flight teaches authors to route around it.
- **Accepted only** examines one record, and it is promoted.
- **Live and accepted** examines **zero**, which under ADR-010 is a configuration finding
  unless explicitly declared.

The exemption precedent the draft cited does not rescue this either. `adrEnforcement` is
called with **no exclusions at all** (`scripts/check-corpus.mjs:146`), and all 10 ADRs carry
the table — that gate was adopted by making every subject compliant, not by grandfathering.
The one per-item registry in this repo, `KNOWN_FAIL_OPEN` (`scripts/vacuity-matrix.mjs:244`),
is deliberately **empty**, with a comment saying it should stay that way, and its entries
carry expiry dates that fail the build when stale. Starting a new registry with two entries
is starting in debt.

**This is the decision, and it is the author's**: which of the four framings, and if it is
one of the two that red on mid-flight records, what those records are supposed to do about
it. Nothing else in this plan is blocked on anything else.

## A second rule, added 2026-08-23: a ruling that names a remedy must name an owner

Found while auditing the lane after [plan 0216](./completed/0216-dogfood-the-proposals-lane.md) gave
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
