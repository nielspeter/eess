# Plan 0218: require a proposal to state its acceptance criteria

## Status

- **State:** Done — built, reviewed and closed 2026-08-23, **after a five-lens review found
  a fail-open in the first version**. Three content rules and a config finding now ship, each
  fixtured, and rule-id coverage is no longer a claim: `check:nonvacuity` derives it and
  fails when a rule id has no fixture. `Deferred: bug 0221` (the kernel's `diffAware()`, which
  cannot tell "nothing changed" from "wrong base"). Split out of
  [plan 0216](./0216-dogfood-the-proposals-lane.md); filed as decision-blocked and it was
  not — one more pass found the option that needed no decision.
- **Priority:** Medium — `PROPOSALS.md` requires the section and nothing checks it, but
  unlike 0216's items the miss has no measured live consequence yet.
- **Effort:** Small–Medium. Both rules are script-local in `scripts/check-corpus.mjs` —
  **no `eess-md` change and no changeset** (Q1 below). The one structural piece is extracting
  `check:release`'s base-ref resolution into a shared module so this gate can read a diff,
  which is ~50 lines moved, not written.
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

### 2. The denominator — **settled 2026-08-23, and the answer was a third option**

Every framing below was measured, and every one is bad. Recorded because the table is the
argument for the answer that follows, and because an earlier version of this plan stopped
here and called itself blocked.

**The answer: gate what a change ADDS, not what the corpus already holds.** A proposal added
in this diff must carry the section; the six that already exist are untouched. Then:

- nothing is retro-fitted, so 003 and 006 — both correctly mid-flight, both unable to
  comply for reasons their own reviews state — are never asked to;
- no terminal record is rewritten;
- no exemption registry is created, so nothing starts in debt and nothing needs renewing;
- the mess stops growing, which is the whole point, without anyone having to clean it up
  first.

This is not a new idea in this repo. `check:release` gates exactly this way — it reads a
base ref and asks only about packages **your change touched** — which is why nobody had to
retro-declare six packages the day it landed. Its resolution logic (`EESS_RELEASE_BASE` →
the PR's target → `origin/main` → `main`, hard-erroring rather than pretending) moves to
`scripts/lib/base-ref.mjs` and is read by both gates, the same one-module-two-consumers shape
`scripts/lib/kernel-surface.mjs` documents as the fix for a hand-synced pair.

**The known cost, stated rather than discovered later.** On `main`, base and HEAD are the
same commit, so the rule examines **zero** proposals. That is a _measured_ zero — "no
proposal was added in this diff" — not a dead selector, and the gate must print it as such.
It is the same property `check:release` has and reports honestly (`0 changed of 6 workspace
packages`). The second rule below is not diff-gated and covers the standing corpus, so the
two together are never both empty by construction.

### The framings that were rejected, and why

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
[bug 0141](../../bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md) found, on the
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

## Files Changed

- `scripts/lib/base-ref.mjs` — **new**: the base-ref resolution moved out of
  `check-release.mjs`, so two gates read one module rather than a hand-synced pair
- `scripts/check-release.mjs` — reads the shared module; behaviour unchanged
- `scripts/check-corpus.mjs` — the two rules, plus the fail-closed branch for an unresolved
  base
- `scripts/check-nonvacuity.mjs` — three fixtures, and `sh()` gains an env overlay so one of
  them can hand the child a base ref that does not resolve
- `.gitignore` — the new-proposal probe's path

## Verification

- [x] **Rule 1 reds in one direction and stays quiet in the other.** An untracked proposal
      with no `## Acceptance criteria` fires `new-proposal-states-no-acceptance-criteria`;
      the same file **with** the section fires nothing. Both measured against the built gate.
- [x] **Rule 2 reds.** Stripping bug 0219's `**Implements:** proposal 004` leaves 004's
      `Docs-only` ruling with no owner and fires `remedy-ruling-names-no-owner`, naming the
      proposal and the declaration that is missing.
- [x] **The fail-closed branch reds.** `EESS_RELEASE_BASE=__nonvacuity_no_such_ref__`
      produces `proposal-diff-base-unresolved` rather than a quiet skip — "no base ref"
      never reads as "nothing was added", which is how a shallow CI clone would otherwise
      turn this rule into a no-op.
- [x] **Three committed fixtures, one per rule id.** Harness **54 → 57**, and the whole
      corpus gate is now **18 of 18 rule ids fixtured**, audited from the harness's own
      output rather than its source.
- [x] **Denominators print.** `0 added · 1 remedy-ruled` on `main` — a measured zero for the
      diff-gated rule (nothing was added in this diff) beside a standing one for the rule
      that reads the corpus, which is why the two together are never both empty.
- [x] `npm run validate` exit 0; `check:release` still green on the extracted module.

## What shipped is weaker than "What the rule can honestly assert", deliberately

That section above specifies the structural form worth having as **section plus a table with
named columns**, via `haveTableRowsSatisfying`, "so it cannot be satisfied by a bare heading
with three words under it". **The table half did not ship.** What ships is heading presence,
so an empty `## Acceptance criteria` clears rule 1.

That is a defensible Tier-1 check and an honest one only if it says so, which is what three
reviewers found it did not. Two consequences, both now in the code:

- every violation carries a `because` that states the limit outright — _"this rule proves
  only that the heading EXISTS — it does not read what is under it, so an empty section
  satisfies it"_;
- the `suggestion` still asks for the break class, because that is what an author should
  write; the `because` is what stops the pair from over-claiming together.

Left undone on purpose: the table check itself. It needs a column vocabulary this lane has
never used, and inventing one to satisfy a plan's own prose is the wrong order. Recorded here
rather than as a silent scale-back, because the plan closed `Deferred: none` once already
with this paragraph unamended.

## What building it changed about the plan

**A performance bug, and a measurement of it that was itself wrong.** Rule 1 needs to see
proposals added but not yet committed — that is when a missing section is cheapest to add —
so `addedSince` unions committed additions with `git ls-files --others`. Unscoped, that walks
every untracked path in the repo: **16,204 here**, almost all `node_modules`, on every run of
the gate. Passing the prefix as a **pathspec** rather than filtering afterwards fixes it, and
the lesson stands: a filter that runs after the walk is not the same as a walk that never
happens.

> **The first version of this paragraph said it "took the non-vacuity harness from seconds to
> over two minutes". That is false, and review measured it.** The unscoped call costs
> **0.12s** against **0.02s** scoped — ~100ms per gate run, a few seconds across the whole
> harness. And the harness on `main`, containing none of this code, **already takes 1:48**.
> The baseline was never seconds. What actually happened is that a 120-second shell timeout
> fired and I attributed it to my own change without measuring the harness first. An
> unmeasured before/after, in a closed record, in the plan that ships a gate against
> unfalsifiable claims — recorded rather than quietly deleted.

## What the review found, and it was the half that runs in CI

Five lenses. Two found the same Critical independently, from different angles, and I had
reproduced it before either landed.

**Rule 1 fell open on a rename.** `git diff --diff-filter=A` runs with rename detection on by
default, so `git mv` an existing proposal to a **new number** arrives as `R` and the rule
examined nothing — measured, `0 added`, green. `check-release.mjs` has passed `--no-renames`
since it was written, for this exact reason, three lines from the import this plan added.

`--no-renames` alone is the wrong fix and that is why it needed thought: promotion is a
`git mv` **within** the prefix, so with the flag it becomes an addition — and since none of
the six existing proposals carries a level-2 section, the next promotion would red. The fix
keys on the proposal **number**: `--no-renames` for the file list, then drop any path whose
number already resolved at the merge base. Verified both ways — the rename now reds, the
promotion does not.

**And the arm that runs in CI had no fixture.** Both in-harness probes plant an _untracked_
file, so they rode `ls-files --others` only. Delete the committed arm entirely and the
harness stayed green — while the committed arm is the only one a pull request uses.
`bad-corpus-diff-e2e.mjs` now drives it against a real worktree with a real commit, and pins
the rename case; deleting the arm makes that fixture fail.

**Three more, each fixed:**

- **A regression was invisible.** Diff-gating the _add_ meant a proposal that complied could
  silently stop. `proposal-lost-its-acceptance-criteria` fires only for records that had the
  section, so it cannot red 003 or 006 — which is why the narrow form beats `--diff-filter=AM`.
- **`0 added` could not be told from "could not look".** The gate runs on push to `main`,
  where merge-base _is_ HEAD. The summary now distinguishes all three zeros by name.
- **A silent `continue` sat on the denominator** — the same shape this file converts into a
  finding 250 lines earlier. Now `corpus/added-proposal-not-loaded`.

**The audit that was a claim is now a mechanism.** "18 of 18 rule ids fixtured" had none — I
checked it by hand, twice, with a regex wrong both times. `check:nonvacuity` now reads the
emitted ids from the gate's source and the asserted ids from the run, and fails on any gap.
**It caught an unfixtured rule on its first execution** — one I had added an hour earlier.

## Out of Scope

- Everything 0216 shipped: the lane's terminal states, `promoted/` / `declined/`, and the
  board ↔ file Ruling rule.
- Retro-fitting acceptance criteria onto proposals 001–006 as content. Whether they are
  _required_ to have it is Open Question 2; writing them is not this plan's work.
