---
name: plan-ready
description: 'Promote a Draft plan to Ready — the freeze. Harvest the ripe refinement, internalise every load-bearing artifact, downgrade live-source links to dated provenance, resolve or re-home every open box, then set State: Ready. Refuse the flip while the floor still dangles. A checklist walk, not a gate.'
argument-hint: '[path/to/plan.md]   (defaults to the plan in context)'
---

# Promote Draft → Ready (the freeze)

Authoring a plan is not committing to it. Promoting a **Draft** to **Ready** is the
**freeze**, and it exists to make one guarantee: **the floor cannot be ripped out
from under whoever implements it** — often an agent alone in a worktree, for whom a
link that now dangles or an artifact that drifted is _silent corruption_. The
method's answer to silent corruption is **stop, don't start** — so this skill
_refuses the flip_ while the floor still dangles.

This is a **skill-prompted checklist walk, not a gate.** (The method explains why:
the one clause that would distinguish a `check:ready` — "the _right_ load-bearing
artifacts were internalised" — isn't a mechanically-knowable fact, so it stays
judgment rather than becoming compliance creep.)

## Run — walk the freeze checklist, refuse if any item dangles

1. **Harvest the ripe refinement.** If this plan grew from a
   [`work/refinement/`](../../../work/refinement/) story, pull the settled decisions
   and acceptance criteria _into_ the plan. After the freeze the refinement can be
   closed — the Ready plan no longer depends on it staying alive.

2. **Internalise every load-bearing artifact — record by value.** A design frame,
   the exact image, the chosen layout, a resolved answer the build depends on:
   capture it _into_ the plan (or an ADR) so nothing can move or vanish beneath it.
   Point-don't-duplicate is for _live, still-moving_ authority; a _settled_ input is
   frozen into the corpus.

3. **Downgrade live-source cords to dated provenance.** Any link the build _depends
   on_ becomes a dated pointer kept only as provenance ("as of <date>, from
   <source>"), never something the implementer must fetch. The code is the one live
   authority a plan still points at (that residual drift is what the corpus pointer
   gate watches).

4. **Resolve or re-home every open box.** Walk every open `- [ ]` / open question in
   the plan: answer it, or move it to a real home (a follow-on plan, a bug, an ADR).
   A Ready plan carries no unresolved floor.

5. **Set the state.** `**State:** Ready — <free prose>`.

6. **Refuse if the floor still dangles.** If any load-bearing artifact is still a
   live-source link, any open question is unresolved, or any internal link is
   broken — **do not flip to Ready.** Say what dangles and stop. (Sanity-check
   inbound/outbound links with `npm run check:corpus`.)

7. **Report** what was internalised, what was re-homed, and that the refinement (if
   any) is now safe to close.

## Guard (the most-forgotten discipline)

Marking a plan **Ready while its floor still dangles.** That is the exact failure
the freeze exists to prevent — an autonomous `/plan-build` hand-off trusts Ready to
mean _self-contained_. When in doubt, stay Draft.
