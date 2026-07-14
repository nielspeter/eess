---
name: refine
description: 'Work the volatile pre-plan lane — reconcile understanding against a moving source (a design tool, a stakeholder answering over days), append with dated pointers never mirrors, track open questions, and mark a topic ripe when it settles, then suggest /plan. Deliberately ungated: this is working memory.'
argument-hint: '<topic>   e.g. /refine onboarding flow open questions'
---

# Refine (the volatile pre-plan lane)

Reach for `/refine` when discovery is **volatile and shared** — understanding is
still being reconciled against a source that keeps moving (a design tool,
stakeholders answering over days), and open questions need somewhere to live until a
topic is _ripe_. The goal here is **current, not tidy.** This lane is deliberately
messy and deliberately **ungated** — it's working memory; hardening happens later,
at `/plan` and the `/plan-ready` freeze.

Read the _shape_ from the corpus: skim recent stories in
[`work/refinement/`](../../../work/refinement/) and its board. Match what's there.

## Run

1. **Confirm it belongs here.** Still-moving, still-argued discovery → refine. A
   settled _how_ ready to build → `/plan`. A concrete defect → `/bug`. If it's
   already clear, skip straight to `/plan`.

2. **Append — dated pointer, never a mirror.** Log the external dialog (a design
   frame, an email thread, a decision-in-progress) as a **dated pointer to the live
   source**, not a pasted copy: `as of <date>, <source>: <what it said>`. A mirror
   of a moving thing goes stale and lies. Point at the moving; don't freeze it yet.

3. **Track the open questions.** Keep open `- [ ]` items for what's still
   unresolved. This lane is _allowed_ to carry unanswered questions — that's its job.

4. **Mark a topic ripe when it settles.** When the churn stops and the decisions
   hold still, note the topic **ripe**. Ripe is the signal that the freeze can now
   capture it by value.

5. **Suggest `/plan`.** Once ripe, hand off: `/plan` authors the buildable slice,
   and `/plan-ready` internalises the settled artifacts and cuts the live-source
   cords. After that freeze, the refinement can be closed.

## Guard

**Mirroring a moving source.** The one failure that turns working memory into a
lie — paste a design that then changes, and the corpus now misleads. Dated pointer,
not a copy. Freezing waits for the freeze.
