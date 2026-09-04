# Bug 0256: the spike lane is gated, but no document declares it and the kit has no word for it

## Status

- **State:** Draft — measured, not built.
- **Severity:** Low — nothing is wrongly passing today, and both existing spikes
  are genuinely terminal. It is filed because a gate now encodes a lifecycle
  claim that no method document makes, which is the
  [0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md) class:
  a convention enforced by a mechanism and owned by no prose.
- **Origin:** self-found · review of
  [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md), which froze
  `work/spikes/**`.
- **Reported:** 2026-09-04

## Symptom, in two halves

### 1. "Concluded" is held by nothing

0249's commit message, the code comment above the `FROZEN` constant, and the
record's Fix step all justify the freeze with the same word: a spike
**concludes**, so its dated report is not held to today's line numbers.

The glob does not say "concluded". `work/spikes/**` freezes every spike from its
first commit. An in-flight spike's pointers would be unexamined for its whole
life, and the person writing it would get no signal — the same silent-coverage
shape 0249 exists to close, reintroduced one directory down.

Not a live defect: this repo has two spikes and both are terminal (spike 0001's
plan is `State: Done`). It is a claim outrunning its mechanism, in a mechanism
argued from that claim.

### 2. Nothing declares the lane

The word "spike" appears **zero times** in `work/README.md` — the corpus's own
map, whose Lanes table is the subject of
[0108](./0108-work-readme-lanes-table-lists-one-lane.md) — and zero times in
`docs/working-method.md`. There is no `/spike` skill beside `/plan`, `/bug`,
`/close`, `/refine` and `/case`.

`kit/`, the portable method kit this repo ships to adopters, has the same hole:
its template `work/README.md` names `plans/` and `bugs/`, and its bootstrap
creates those. An adopter gets no spike lane, because the method this repo
exports has no word for a lane this repo runs.

That is [0252](./0252-the-kit-names-a-reviewer-it-does-not-ship.md) inverted —
there the kit names something it does not ship; here the repo runs something the
kit never names.

### 3. The category was defined once and applied to one member

The freeze's justification — "a dated report of what was measured, not a work
item" — describes two of the four documents 0249 made live just as well:
`work/fold-audit-2026-08-19.md` and `work/research-external-signals-2026-07.md`,
both dated in their own filenames. They are live, and their pinned line numbers
are now gated against today's code, on no stated reasoning either way.

**A position, so the next person is not left to guess it:** they should stay
live. A dated audit sits in a live lane and is read as current evidence, so a
pointer of its that stales is a signal worth having — the value of the report is
exactly that its citations still land. A spike is different because its record
cites _another repo's_ code, which this build cannot track at any date. That is
the real line, and it is about whose code is cited, not about how dated the
document is. If that reasoning is right, the code comment should say it in those
terms; if it is wrong, the category needs to widen and the two audits need
freezing. Either way the argument should exist somewhere.

(The line was drawn from the wrong premise the first time. 0249's disposition
claimed freezing spikes removed the foreign-pointer population; measured, that
population was already empty — see
[0254](./0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md).)

## Why it matters

A spike is a genuinely different lifecycle from a plan or a bug: it _concludes_
with a dated report rather than _closing_ with a disposition. That distinction is
now load-bearing — it is the entire argument for the freeze — and it exists only
in a code comment and a commit message. The next person to add `work/experiments/`
has no way to know whether it should be frozen, because the rule that would tell
them was never written down outside the gate that applies it.

## Fix (not built)

1. **Say what a spike is**, in `work/README.md`'s Lanes table and
   `docs/working-method.md`: concludes rather than closes, terminal on
   conclusion, pointers frozen with the record. 0108 already owes the Lanes-table
   row, so coordinate rather than duplicate.
2. **Decide whether "concluded" should be mechanical.** Either narrow the glob to
   conclusion (a terminal `State:` in the spike's own record, the way
   `check:ledger` reads done-ness) or drop the word from the justification and
   say plainly that the whole lane is frozen. Both are defensible; the current
   state — prose that qualifies and a glob that does not — is the one that is not.
3. **Export it or say why not.** Either `kit/` gains the lane and a `/spike`
   skill, or the kit's README says the lane is repo-local. Silence is what
   0252 is about.

## Verification

- [ ] `work/README.md` and `docs/working-method.md` describe the spike lane, and
      what freezing means for it.
- [ ] The gap between "concluded spikes" and `work/spikes/**` is closed in one
      direction, and the code comment says which.
- [ ] `kit/` either ships the lane or declares it out of scope, checked the way
      0252's finding will be.

## Related

- [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) — froze the
  lane and argued it from a word the glob does not carry.
- [0252](./0252-the-kit-names-a-reviewer-it-does-not-ship.md) — the same
  repo/kit divergence, in the other direction.
- [0108](./0108-work-readme-lanes-table-lists-one-lane.md) — owns the Lanes
  table this needs a row in.
- [0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md) — the
  lens that found this, and the record that argued the lens was missing.
