---
name: plan-build
description: "Build a Ready plan — refuse unless State: Ready, load the plan's declared context and the real code first, implement from real patterns, keep the plan's status live as you go, and stop before merge with the diff reviewed. A draft is not a work order."
argument-hint: '<plan number or path>   e.g. /plan-build 42'
---

# Build a plan (Ready only, stop before merge)

Implementing is the one place the method leans _hard_ on the freeze. A **Ready**
plan promises its floor is self-contained — every load-bearing artifact
internalised, every open question resolved — so whoever builds it, often an agent
alone in a worktree, can trust it without re-fetching anything. A **Draft** makes no
such promise, so this skill **refuses to build one.**

## Run

1. **Refuse unless `State: Ready`.** Read the plan's header. If it's `Draft`, stop
   and say so — send it through `/plan-ready` (the freeze) first. A draft is not a
   work order; building one risks a floor that shifts under you.

2. **Load the declared context first — then the real code.** Read what the plan
   points at (its ADRs, the artifacts it internalised) _and_ the existing code in
   the area you're about to touch, so you build from the patterns already there, not
   from an invented shape. The corpus tells you _what_; the code tells you _how this
   project does it_.

3. **Implement the smallest coherent slice.** Follow the plan's phases. If the
   plan's approach won't work as written, **raise it** — don't silently swap it (in
   an interactive build) or barrel past it (autonomous). A plan that's wrong is a
   finding worth recording, not a thing to paper over.

4. **Keep the plan's status live as you go.** Tick its ledger boxes, note what
   actually happened versus what was planned. The plan is the durable record; a
   stale plan mid-build is a lying memory for the next reader.

5. **Verify.** Green typecheck / lint / architecture / suite. For anything CI can't
   exercise (infra, deploy config), note honestly that real validation is still
   owed — don't let a green check overstate it.

6. **Stop before merge — the diff is reviewed.** Nothing is a black box: the change
   is reviewable before it lands. When it's merged-and-green, hand to `/close`
   (author the move-to-done _in the same PR_) — don't self-merge and don't do the
   close by hand.

## Guards (the autonomous failure modes)

- **Building a Draft** — refuse; a plan must be Ready.
- **Starting from a drifted/uncommitted plan** — load the real code, reconcile
  before you build on it.
- **Ignoring existing patterns** — read the neighbouring code first.
- **Going silent** — keep the status live; surface a wrong plan rather than hiding it.
- **Self-merging** — stop before merge; the diff is reviewed, then `/close`.
