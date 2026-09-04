# Bug 0249: `work/spikes/` holds records and neither corpus nor ledger reads it

## Status

- **State:** Draft — found and measured while landing a spike record; not fixed.
- **Severity:** Medium — **a corpus lane with no gate over it.** Nothing is wrong
  today: the two records there carry no links and no code pointers, so there is
  nothing to be broken. What is missing is anything that would notice when that
  changes — and it just changed, because a record with an upstream reference was
  landed into it.
- **Origin:** self-found · landing spike 0001's conclusion from an unpushed
  branch, where an edit was made expecting `check:corpus` to reject the original
  and the gate turned out not to look.
- **Reported:** 2026-09-04

## Symptom

`check:corpus` declares its roots explicitly
(`scripts/check-corpus.mjs:43`):

```js
const ROOTS = ['work/plans/**', 'work/proposals/**', 'work/bugs/**', 'adr/**', 'docs/**']
```

`work/spikes/**` is not among them. Measured 2026-09-04: adding two documents to
`work/spikes/0001-eess-over-ts-archunit/` left the summary at **1630 checks
across 165 documents** — byte-identical with and without them. Their links and
`path:line` pointers are unchecked.

`check:ledger` reaches the same directory and also declines: `work/spikes` is not
one of its three `LANES`, and `findUncoveredLanes` passes it only because it is
_records-free_ in that gate's sense — no `**State:**` token in any file. The
moment a spike record carries one, that check reports an uncovered lane.

So the directory sits in a gap between two gates: too much of a record lane to be
nothing, too little to be scanned.

## Why it matters

A spike's conclusion is a **terminal record** — spike 0001's says so in its own
words. Terminal records are exactly the documents a reader trusts without
re-deriving, and the corpus gate exists because a pointer that no longer grounds
is worse than no pointer.

The gap has been harmless because both existing records happen to carry no links
and no pointers (verified: 0 and 0 in `0002-fold-delta.md`). That is luck, not
design, and the record landed today is the first with an external reference in it.

## Root cause

Not an oversight in the roots list — a directory that grew records after the list
was written. `work/spikes/` predates the corpus gate's current shape, and the
gate's own comment (`scripts/check-corpus.mjs:45`) says why a root cannot simply
be appended:

> Every root must be explicitly classified for link-resolution routing … a new
> root nobody classified is exactly the gap bug 0086's review round found: it
> silently fell into the loose (`resolveDirectories`) profile by default, a false
> green waiting to happen.

So the fix is a classification decision, not a one-line addition — and
`unclassifiedRoots()` already refuses an unclassified root, which is that guard
working.

## Fix (not built)

1. Classify `work/spikes/**` in `scripts/lib/corpus-link-routing.mjs` and add it
   to `ROOTS`. Spike records point at code and at other records, so the strict
   profile is the likely answer — but that is the decision, and it should be made
   rather than defaulted.
2. Decide whether `work/spikes/` is a ledger lane. A spike concludes; a concluded
   spike is arguably a terminal state. If it becomes a lane it needs its own
   vocabulary (`Concluded`? `Abandoned`?), and if it does not, say so where
   `LANES` is declared so the next reader does not re-open the question.
3. A `check:nonvacuity` row, or the widening is a claim rather than a check.

## Verification

- [ ] Red first: a broken link and a stale pointer planted in a spike record are
      both reported.
- [ ] The document count moves — the current 165 is the evidence it does not now.
- [ ] `check:ledger` either claims the lane or records why it does not.

## Related

- [0248](./0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) — the same
  question one gate over: a population a check does not cover, where widening is
  a decision rather than a line.
- [0244](./0244-the-board-status-cell-is-bound-to-nothing.md) — a third instance:
  an artifact readers trust, bound to nothing.
