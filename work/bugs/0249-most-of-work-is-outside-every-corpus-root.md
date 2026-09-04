# Bug 0249: seven documents under `work/` are outside every `check:corpus` root, including the one that describes the corpus

## Status

- **State:** Draft — measured, rescoped twice by review, not fixed.
- **Severity:** Medium — **a region of the corpus no link or pointer check
  reads.** Nothing is broken today. What is missing is anything that would notice
  when it breaks — and one of the seven documents already makes a false claim
  about the corpus's own shape.
- **Origin:** self-found · landing spike 0001's conclusion, where an edit was made
  expecting `check:corpus` to reject something and the gate turned out not to look.
- **Reported:** 2026-09-04

## Symptom

`check:corpus` declares its roots explicitly (`scripts/check-corpus.mjs:43`):

```js
const ROOTS = ['work/plans/**', 'work/proposals/**', 'work/bugs/**', 'adr/**', 'docs/**']
```

Three lanes under `work/`, and nothing else. Measured 2026-09-04, **seven**
markdown documents under `work/` fall outside every root:

| document                                               | what it is                          |
| ------------------------------------------------------ | ----------------------------------- |
| `work/README.md`                                       | **the corpus's own one-screen map** |
| `work/dogfood-coverage.md`                             | a coverage record                   |
| `work/fold-audit-2026-08-19.md`                        | an audit                            |
| `work/research-external-signals-2026-07.md`            | a research note                     |
| `work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md` | a spike's terminal record           |
| `work/spikes/0001-eess-over-ts-archunit/README.md`     | its companion                       |
| `work/spikes/0002-fold-delta.md`                       | a measurement appendix to plan 0088 |

Their links and `path:line` pointers are unchecked. Verified by the gate's own
summary being **byte-identical** with and without the two spike documents — same
check count, same document count.

## Two corrections this record owes, both from review

**First scope, too narrow.** This record was filed as "`work/spikes/` is a record
lane no gate reads". The directory was where the gap was noticed, not where it
ends: `work/README.md` and three sibling documents are outside the roots too.
Architecture review found them.

**And the title was wrong by half. `check:ledger` DOES cover `work/spikes/`.** It
prints `lanes 3 declared · 4 work/ directories · 0 uncovered`, and
`scripts/lib/lane-coverage.mjs:9` names `work/spikes/` as its worked example —
"records-free today" — with a live tripwire for the day a `State:`-shaped record
appears there. That is coverage by design, itemised in the gate's summary.

Only the **corpus** half is a gap. The original framing would have cost whoever
picked it up: they would have gone looking for a ledger fix that is not needed.

## Why it matters

`work/README.md` calls itself the corpus's map, is the document a newcomer reads
first — and nothing checks its links. It is also **already wrong**: it declares
one lane (`plans/`) and says `bugs/`, `refinement/` and `support/` "appear only
when the work calls for them; until then they'd be cargo-cult". Live reality is
three declared lanes, 141 bug records, 9 proposals, and `proposals/` unmentioned.

That is the shape this repo keeps paying for — a document readers trust, bound to
nothing — and it is the third instance filed in two days
([0244](./0244-the-board-status-cell-is-bound-to-nothing.md),
[0248](./0248-the-source-text-guard-covers-a-sixth-of-the-repo.md)).

## Root cause

Not an oversight in the roots list — regions that grew after it was written.

**A correction, because the first draft got this wrong in the fail-open
direction.** It said the fix "is a classification decision, not a one-line
addition", and that `unclassifiedRoots()` "already refuses an unclassified root,
which is that guard working."

**It does not refuse.** `unclassifiedRoots` classifies by TOP-LEVEL segment and
`work/` is already in `REPO_NATIVE_ROOTS`
(`scripts/lib/corpus-link-routing.mjs:23`), so any `work/**` glob is classified
the moment it is added. Both reviewers ran the real gate with `work/spikes/**`
prepended: clean, 0 violations, first try, documents 166 → 169. A reader trusting
the first draft would have added the root believing a guard had their back.

## The trap in the obvious fix

Widening the roots **produces a false green on the very pointer that produced
this record.** `check:corpus` resolves a code pointer by path **suffix**, so
ts-archunit's `src/core/rule-builder.ts` matches this repo's
`packages/ts/src/core/rule-builder.ts` and is reported as grounded. A foreign-repo
pointer is not merely unchecked today; once the root is added it is checked and
**blessed against the wrong file** — strictly worse for a reader.

Spike records are the documents most likely to carry upstream pointers, because a
spike exists to evaluate someone else's code.

## Fix (not built)

**The mechanism already exists, and the first draft of this record missed it.**
`check:corpus` freezes `['**/completed/**', '**/wont-do/**', '**/fixed/**',
'**/archived/**']`, and `work/README.md` states the contract: a frozen folder's
"code pointers describe things as they were, so `check:corpus` reports drift in
them but never fails on it (links must still resolve)."

That is exactly the semantics a concluded spike needs — links gated, pointers
reported — and it dissolves the suffix-resolution trap for the frozen population
rather than requiring it to be solved first.

1. Add the missing `work/` regions to `ROOTS`. No classification decision is
   required: `work/` is already repo-native, so they inherit the correct profile.
   (An earlier draft said "the strict profile is the likely answer" — backwards.
   Strict is the VitePress-_site_ profile; prescribing it here would make these
   the only regions of `work/` where a real directory link reds.)
2. Cover concluded spikes with a frozen glob, so their pointers are reported and
   their links still gated.
3. For the un-frozen remainder, decide how a document may cite foreign code —
   the inline `<!-- eess-exclude corpus/pointers-resolve: … -->` already exists and
   may be the whole answer.
4. Fix `work/README.md` while it is finally being checked; it under-declares the
   lane model it is the map for.
5. A `check:nonvacuity` row, or the widening is a claim rather than a check.

**Not proposed: making `work/spikes/` a ledger lane.** The first draft asked the
question; architecture review answered it. A spike record has no `- [ ]`
disposition ledger — it is a report, not a work item — so `findLaneDoneVacuity`
would fire on day one absent `expectEmptyDone`. "A concluded spike is a terminal
state" is true as prose and wrong as a lane argument: the lane model enforces
honest box disposition at close, not document lifecycles.

## Verification

- [ ] Red first: a broken link planted in each newly-covered region is reported.
- [ ] **The pointer fixture is a foreign-repo path that SUFFIX-MATCHES a local
      file** — not a contrived out-of-range line number, which reds while the real
      case stays green.
- [ ] A frozen spike's stale pointer is _reported and not fatal_; its broken link
      still fails.
- [ ] The document count moves. State the invariance, not the integer — this
      record already pinned one that was stale within a commit.

## Related

- [0248](./0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) — the same
  question one gate over, and filed a day earlier: a population a check does not
  cover, where widening is a decision rather than a line.
- [0244](./0244-the-board-status-cell-is-bound-to-nothing.md) — the same shape a
  third time: an artifact readers trust, bound to nothing.
