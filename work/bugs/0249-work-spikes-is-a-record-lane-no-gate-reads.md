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

`work/spikes/**` is not among them. Measured 2026-09-04: the gate's summary is
**byte-identical with and without** the two documents under
`work/spikes/0001-eess-over-ts-archunit/` — same check count, same document count.
Their links and `path:line` pointers are unchecked.

The invariance is the finding, not the integer. An earlier draft pinned "1630
across 165", accurate when measured and wrong by the time this record and its
board row existed — the drift `CLAUDE.md` warns about, committed inside a record
about unchecked claims.

`check:ledger` reaches the same directory and also declines: `work/spikes` is not
one of its three `LANES`, and `findUncoveredLanes` passes it only because it is
_records-free_ in that gate's sense — no readable `**State:**` token.

**Where that token has to sit, measured**, because testing the claim the obvious
way gives the wrong answer: a `**State:**` line appended at the BOTTOM of a spike
record produces no finding at all. `ledgerStats` reads the preamble-plus-first-
section region (bug 0119), so only a token in a record's header triggers
`ledger/uncovered-lane`. Enforcement review measured both ways. Anyone checking
this claim by appending a line to the end will conclude it is wrong.

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
was written. `work/spikes/` predates the corpus gate's current shape.

**A correction, because the first draft of this record got the next part wrong in
the fail-open direction.** It said the fix "is a classification decision, not a
one-line addition", quoted the gate's warning that an unclassified root "silently
fell into the loose (`resolveDirectories`) profile by default", and concluded that
`unclassifiedRoots()` "already refuses an unclassified root, which is that guard
working."

**It does not refuse.** `unclassifiedRoots` classifies by TOP-LEVEL segment, and
`work/` is already in `REPO_NATIVE_ROOTS`
(`scripts/lib/corpus-link-routing.mjs:23`) — so `work/spikes/**` is classified the
moment it is added and the guard has nothing to say. Measured by enforcement
review and reproduced: adding it to `ROOTS` runs clean, reporting 0 violations
over a larger document count. A reader trusting the first draft would have added
the root believing a guard had their back.

## The trap that makes this more than a widening

Widening the root **produces a false green on the very pointer that produced this
record.** `check:corpus` resolves a code pointer by path **suffix**, so
ts-archunit's `src/core/rule-builder.ts` matches this repo's
`packages/ts/src/core/rule-builder.ts` and is reported as grounded. A foreign-repo
pointer is not merely unchecked today; once the root is added it is checked and
**blessed against the wrong file**.

That is strictly worse for a reader than no gate at all, and it is the shape spike
records are most likely to carry — a spike exists to evaluate someone else's code.

## Fix (not built)

1. **Choose the routing profile deliberately**, knowing nothing will stop you
   choosing wrong: `work/spikes/**` inherits `work/`'s repo-native classification,
   so adding it to `ROOTS` is accepted silently.

   **And the obvious answer is the wrong one.** An earlier draft of this record
   said "the strict profile is the likely answer". Architecture review showed that
   is backwards: `work/` is **repo-native** — GitHub-rendered, where a link to a
   directory resolves — while strict is the VitePress-_site_ profile. Prescribing
   strict here would make `work/spikes` the only region of `work/` where a real
   directory link reds, and it would need a carve-out inside `isRepoNativeLink`'s
   prefix match to take effect at all. Repo-native is almost certainly right; what
   this record asks is that it be chosen rather than inherited.

2. **Handle foreign-repo pointers before widening, or the widening makes things
   worse.** Either teach the pointer rule to distinguish a suffix match from a
   real one, or give spike records a sanctioned way to cite upstream code — the
   inline `<!-- eess-exclude corpus/pointers-resolve: … -->` already exists and
   may be the whole answer.

   One mechanical detail worth knowing before writing either: `extractPointers`
   excludes **fenced** blocks but keeps **inline** code, so quoting a pointer to
   discuss it — as this record's own sibling landing note first did — creates a
   live pointer. Fencing the quote makes it inert.

3. **Decide whether `work/spikes/` is a ledger lane.** A spike concludes, and a
   concluded spike is arguably terminal. If it becomes a lane it needs its own
   vocabulary; if not, say so where `LANES` is declared so the next reader does
   not re-open the question.
4. A `check:nonvacuity` row, or the widening is a claim rather than a check.

## Verification

- [ ] Red first: a broken link planted in a spike record is reported.
- [ ] **The pointer fixture is a foreign-repo path that SUFFIX-MATCHES a local
      file** — not a contrived out-of-range line number. Enforcement review's
      finding: an out-of-range pointer reds while the real case (a valid line in a
      file that suffix-matches) stays green, so a fixture written to the obvious
      wording would pass without covering this bug.
- [ ] The document count moves. State the invariance, not the integer — this
      record already pinned a number that was stale within one commit.
- [ ] `check:ledger` either claims the lane or records why it does not.

## Related

- [0248](./0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) — the same
  question one gate over: a population a check does not cover, where widening is
  a decision rather than a line.
- [0244](./0244-the-board-status-cell-is-bound-to-nothing.md) — a third instance:
  an artifact readers trust, bound to nothing.
