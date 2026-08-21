# Bug 0192: nothing detects a dialect shadowing a kernel name

## Status

- **State:** Draft — the collision that motivated it is fixed; the detector is not
  built, and no filed plan holds the case.
- **Severity:** Medium — a family-coherence gap, not a false green in a build.
  It is filed because the instance it is generalised from went unnoticed through
  an entire engine fold and was found by a human reading two barrels.
- **Origin:** self-found · PR #72 product and architect reviews, then follow-up
  when the first attempt to re-home it pointed at a gate that cannot hold it
- **Reported:** 2026-08-21

## Symptom

A dialect can export a name the kernel also exports, with different semantics,
and every gate stays green.

The instance: `@nielspeter/eess` exports `correspondence({ left, right })` — a
kernel primitive binding two `Selection`s from any loaders — which
`@nielspeter/eess-md` re-exports and `docs/markdown.md` teaches. `eess-ts` grew
its own `correspondence(p)` with a `.side().side()` chain, plus a
`CorrespondenceBuilder` class under the same name. Same word, same class name,
sibling packages, incompatible signatures. An adopter importing both dialects
got a collision; a reader who learned the call from the markdown page and wrote
it in an eess-ts rule file got a different API.

Renamed to `crossProject` / `CrossProjectBuilder`. **Nothing would catch a
recurrence.**

## Why check:family cannot see it

`family.rules.ts` asserts **re-export sufficiency**: each dialect re-exports every
kernel symbol its own source imports, so installing one dialect never requires a
second, direct kernel install. That is a different question.

Worse, the allowlist made the shadowing legal. `scripts/lib/family-re-exports.mjs`
carries an explicit exemption: eess-ts deliberately does NOT re-export the
kernel's `correspondence` / `CorrespondenceBuilder` / `matchSelections` /
`applyFixes` (plan 0089's reasoned decision — they serve crossvalidate and md).
That entry was written to mean **"eess-ts has no correspondence"**. It came to
permit **"eess-ts has a DIFFERENT correspondence"**, and the gate cannot tell the
two apart because it never asks what a dialect exports on its own account.

## Why plan 0188 Phase 3 is not the home

Recorded because the first attempt to re-home this pointed there, and a deferral
to a record that does not hold the case is worse than an open one.

0188 Phase 3 is scoped as _"a gate that reds when a kernel concept **re-forks**
into a dialect"_ — the duplication problem, where a dialect grows its own copy of
a kernel module. `crossProject` was never a fork of the kernel's
`correspondence`; it is a different API that collided by name. An anti-re-fork
gate detects duplicated implementations, not shadowed identifiers, so it would
have stayed green through this entire episode.

The two are adjacent and genuinely distinct. If 0188 Phase 3's charter is widened
to cover shadowing, this record closes as `deferred→0188` and says so. That is a
decision, not an assumption, which is why it is not made here.

## Fix

Undecided; the shape is clear. A gate over the published surfaces that reds when
a dialect exports a name the kernel also exports **and does not re-export it** —
that conjunction is the whole signal. Re-exporting the kernel's is the normal,
correct case (`eess-md` does exactly that); declaring an independent binding under
the same name is the fault.

The allowlist is what makes it decidable: a name on it is a declaration that this
dialect deliberately does not forward the kernel's, so a same-named local export
alongside it is unambiguous.

## Verification

- [ ] Red test first: a dialect declaring its own export under a kernel name reds
      the gate. Must fail today — measured, `check:family` is green over exactly
      that state. (Measured on `adopt-ts-archunit-tests`, which PR #72 squashed
      into `7031427`; the pre-rename tree is `7031427~1`, since that branch's own
      shas are ancestors of nothing and die when it is pruned.)
- [ ] The break class is registered in `scripts/check-nonvacuity.mjs`.
- [ ] `eess-md`'s legitimate re-export of the kernel's `correspondence` stays
      green — the gate distinguishes forwarding from shadowing.
- [ ] `npm run validate` green.

Deferred: none.
