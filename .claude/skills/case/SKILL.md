---
name: case
description: 'Log a customer support case — keep the raw evidence by pointer, keep the case (what the customer reported) distinct from the defect (what is wrong in the code), and spawn a /bug that internalises the reproduction. Case points at live evidence; the bug it spawns freezes it.'
argument-hint: '<one-line report>   e.g. /case customer cannot submit application on mobile'
---

# Case (support: point at evidence, spawn the bug)

Reach for `/case` when **real people report things.** A case is customer-facing: it
records _what was reported and by whom_, kept distinct from the engineering
**defect** it might spawn. The distinction is the whole point — one case can spawn
several bugs, or none; a bug can exist with no case. **Case points; bug freezes.**

Read the _shape_ from the corpus: skim recent cases in
[`work/support/`](../../../work/support/) and its board. Match what's there.

## Run

1. **Confirm it's a case.** A customer/user report → case. A defect _you_ found in
   the code, no customer involved → `/bug` directly. A feature request → `/refine`
   or `/plan`.

2. **Take the next free number** and write it in the house shape at
   `work/support/NNN-slug.md`. Header: `**State:** Open — <free prose>`. Put it on
   the support board.

3. **Keep the raw evidence by pointer.** Email, screenshots, chat logs — logged as
   **dated pointers to the live source** (or stored as raw attachments), never
   retyped into the case body as if they were fact. The customer's words are
   volatile external truth; point at them.

4. **Keep the case distinct from the defect.** The case says _what the customer
   experienced_. Do not diagnose root cause _in the case_ — that's the bug's job.

5. **Spawn a `/bug` that internalises the reproduction.** When the case points at a
   real defect, `/bug` the defect and have it **freeze** the distilled repro and
   evidence so the bug stands alone (red test first). Link the case ↔ the bug. The
   case may point at live evidence forever; the bug must be self-contained.

6. **Close the case when the customer is served** — `/close` walks the ledger and
   moves it to the support done-folder. A case is done when the _customer_ is
   resolved, which may be before or after the bug it spawned.

## Guard

**Collapsing case and defect into one.** If root cause lands in the case body, the
case rots when the code changes and the bug has no self-contained repro. Keep them
separate: the case points, the bug freezes.
