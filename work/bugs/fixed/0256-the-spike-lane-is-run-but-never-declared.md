# Bug 0256: the spike lane is gated, but no document declares it and the kit has no word for it

## Status

- **State:** Fixed — the lane is declared in the method, named in the kit with
  the reason it is not seeded, and the gate's justification no longer carries a
  word the glob cannot see. The corpus map's Lanes row is deferred to 0108,
  which owns that table and is binding it.
- **Severity:** Low — nothing is wrongly passing today, and both existing spikes
  are genuinely terminal. It is filed because a gate now encodes a lifecycle
  claim that no method document makes, which is the
  [0250](./0250-the-review-roster-has-no-working-method-lens.md) class:
  a convention enforced by a mechanism and owned by no prose.
- **Origin:** self-found · review of
  [0249](./0249-most-of-work-is-outside-every-corpus-root.md), which froze
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
[0108](../0108-work-readme-lanes-table-lists-one-lane.md) — and zero times in
`docs/working-method.md`. There is no `/spike` skill beside `/plan`, `/bug`,
`/close`, `/refine` and `/case`.

`kit/`, the portable method kit this repo ships to adopters, has the same hole:
its template `work/README.md` names `plans/` and `bugs/`, and its bootstrap
creates those. An adopter gets no spike lane, because the method this repo
exports has no word for a lane this repo runs.

That is [0252](../0252-the-kit-names-a-reviewer-it-does-not-ship.md) inverted —
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

## Fix

**1 — `docs/working-method.md` declares the lane**, beside Plan, Bug, Refinement,
Support and ADR: a dated measurement of something the build does not own, which
**concludes rather than closes** — no ledger to reconcile, no disposition to
write, because it was never a list of work.

**2 — The "concluded" qualifier is dropped, and the answer was neither option
this record offered.** Both spikes in this repo settle it: 0002 is _"Measured
2026-08-14 against `ts-archunit` commit `b4084c9`"_, and 0001 is a terminal
record with a landing note. **A spike is terminal from its first commit** — there
is no in-flight state in which the record exists but is not yet a report, so
there was nothing for "concluded" to exclude. Narrowing the glob to conclusion
would have been mechanism for a distinction that does not exist.

The real reason to freeze the lane is sharper than conclusion, and the gate's
comment now says it: a spike cites code this repository does not own, so holding
those citations to today's line numbers would demand the record be edited to stay
green — the opposite of what a dated measurement is for.

**3 — `kit/` names the lane and says why it ships neither the folder nor a
skill.** The template README lists it alongside refinement and support as a lane
to add when the work calls for it, using the kit's own existing wording for that
case. `kit/README.md` says there is no `/spike` skill _by design_: a spike is one
document written after measuring, with no sequence to walk, no ledger to
reconcile and no close ritual — a skill would be ceremony around a single act.
That is the "say why not" branch, and saying it is the whole point, because
silence is what [0252](../0252-the-kit-names-a-reviewer-it-does-not-ship.md) is
about.

## Verification

- [x] `docs/working-method.md` describes the spike lane and what freezing means
      for it, in the lanes list where a reader looks for what a lane is.
- [~] `deferred→`[0108](../0108-work-readme-lanes-table-lists-one-lane.md) —
  **the corpus map's Lanes row.** Not a dodge, and not the same defect: 0108
  owns that table, its Fix already names the `spikes/` row, and its second
  half binds the table to the real directories with `rows()` +
  `correspondence()` so it cannot drift again. Adding one row here would put
  a fourth lane in a table whose own prose still says _"solo-greenfield — one
  lane"_ and calls the others cargo-cult — making the document
  self-contradictory in a new way, and handing 0108 a diff to unpick. The
  lane is _declared_ by the method doc; the table being incomplete is 0108's,
  and it was already blocked on nothing.
- [x] The gap between "concluded spikes" and `work/spikes/**` is closed by
      dropping the qualifier, and the gate's comment says which direction and
      why. `scripts/lib/frozen-scope.mjs`'s doctrine already read correctly
      ("a record that concluded … or a spike") and needed no change — checked
      rather than assumed.
- [x] `kit/` declares the lane out of scope in both places that matter: the
      template README names it beside the other unseeded lanes, and `kit/README.md`
      says why no `/spike` skill exists. Both state a reason rather than omitting
      it, which is 0252's actual complaint.

Deferred: the corpus map's Lanes row → 0108.

## Related

- [0249](./0249-most-of-work-is-outside-every-corpus-root.md) — froze the
  lane and argued it from a word the glob does not carry.
- [0252](../0252-the-kit-names-a-reviewer-it-does-not-ship.md) — the same
  repo/kit divergence, in the other direction.
- [0108](../0108-work-readme-lanes-table-lists-one-lane.md) — owns the Lanes
  table this needs a row in.
- [0250](./0250-the-review-roster-has-no-working-method-lens.md) — the
  lens that found this, and the record that argued the lens was missing.
