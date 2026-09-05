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

**2 — The "concluded" qualifier is dropped.** That is **option (b) of the two
this record offered**, not a third answer; an earlier version of this section
claimed "neither option", which overstated it. What is new is the justification,
not the mechanical outcome.

A spike is terminal from its first commit — 0002 measures `ts-archunit` at commit
`b4084c9`, 0001 at versions 0.57.0 and 0.58.0. **That is an observation about two
records, not a guarantee**, and the method doc no longer states it as an absolute:
nothing prevents someone committing a spike across several passes, and the
unconditional glob would stop examining that document's pointers for its whole
life. Convention, not mechanism — worth knowing rather than asserting away.

**The replacement justification was wrong too, and review caught it.** It said a
spike cites code this repo does not own. Measured: `work/spikes/` contains **zero**
`path:line` pointers — 648 corpus-wide, none in a spike — so the freeze suppresses
nothing today, and deleting the glob entry would change no violations. That is the
same shape as the qualifier it replaced: a reason the corpus does not bear out.

What the freeze is actually for is in spike 0001's own landing note, which records
rewriting its single `path:line` citation into prose **so this mechanism would not
catch it**. The population is empty because it was emptied by hand. The freeze is
**prospective** — so the next spike need not do that — and the gate's comment now
says exactly that, with the measurement.

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
      why, and that the freeze is prospective rather than currently load-bearing.
- [x] `scripts/lib/frozen-scope.mjs` says "terminal", not "concluded". **An
      earlier version of this box said that file "already read correctly and
      needed no change — checked rather than assumed", having checked one
      occurrence of four.** The other three applied "concluded" to everything in
      `TERMINAL_FOLDER_NAMES`, `spikes` included — and one is the **runtime
      refusal text**, so a maintainer tripping the guard would have been told, in
      the words this record retired, that freezing is for "records that
      concluded". Corrected; the one line that did read correctly now says why it
      differs.
- [x] `kit/` declares the lane out of scope in both places that matter: the
      template README names it beside the other unseeded lanes, and `kit/README.md`
      says why no `/spike` skill exists. Both state a reason rather than omitting
      it, which is 0252's actual complaint.
- [x] **The "no skill" decision does not silently drop what a skill would have
      carried.** Review found it had: every other lane's skill tells the author to
      take the next free number from the shared sequence and where to put the
      file, and nothing replaced that. Both are stated where the decision is.
- [x] `kit/README.md` no longer contradicts itself four lines apart — `/close`
      was "one ritual, every lane" beside a spikes lane with no close ritual.
- [x] The kit says how to freeze, not just to freeze: `corpus({ frozen: [...] })`
      from `@nielspeter/eess-md`. An adopter who followed the template's own
      advice to wire up `check:corpus` previously met a verb with no object.
- [x] "One record", not "one document" — this repo's own spike 0001 is a
      directory of two files, so the written rule was narrower than the corpus it
      claims to describe.

**One justification, not two.** The gate's comment had ended up stating the
freeze's reason twice — the paragraph this record added, and an older one from
[0253](../0253-frozen-drift-is-not-reported-only-unexamined.md)'s fix about the
suffix-resolution trap. Two accounts of one mechanism, written by different edits,
is the shape this record diagnoses elsewhere; they are one paragraph now, and the
trap connection is the stronger for sitting beside the note about spike 0001
hand-defusing exactly that hazard.

**No mechanism binds the three statements about this lane** —
`TERMINAL_FOLDER_NAMES`, the `frozen` glob, and the method doc's lane list — and
that is a choice rather than an oversight, stated because the record otherwise
said nothing. A `rows()`/`correspondence()` binding of the kind
[0108](../0108-work-readme-lanes-table-lists-one-lane.md) is building for the
Lanes table binds a _table_ to _directories_; there is no table here, and
inventing one to have something to bind would be ceremony.

**`kit/` is outside every `check:corpus` root**, so none of the prose added there
is link-checked — the population [0249](./0249-most-of-work-is-outside-every-corpus-root.md)
measured at 187 of 451 tracked `.md` files, naming `kit/` as the one that matters
most. That is 0249's to close, not this record's, but adding unchecked prose to it
without saying so would have been the quieter version of the same problem.

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
