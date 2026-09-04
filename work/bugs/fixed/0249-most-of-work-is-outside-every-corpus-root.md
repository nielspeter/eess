# Bug 0249: seven documents under `work/` are outside every `check:corpus` root, including the one that describes the corpus

## Status

- **State:** Fixed — `work/**` is a corpus root, concluded spikes are frozen, and
  a fixture reds if the root is narrowed again. Closed in the PR that fixed it.
  `Deferred: work/README.md's content → 0108 and 0251`.
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
([0244](../0244-the-board-status-cell-is-bound-to-nothing.md),
[0248](../0248-the-source-text-guard-covers-a-sixth-of-the-repo.md)).

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
   lane model it is the map for. **That drift is already filed as
   [0108](../0108-work-readme-lanes-table-lists-one-lane.md)** (2026-08-12), which
   this record failed to name when it was written — found by the working-method
   reviewer on its first run. The two are ordered: 0108's own fix binds the map's
   Lanes table with `rows()` + `correspondence()`, and a rule authored today would
   examine **zero** rows and report green, because `work/README.md` is not in any
   corpus root. **0108 is blocked by this record.**
5. A `check:nonvacuity` row, or the widening is a claim rather than a check.

**Not proposed: making `work/spikes/` a ledger lane.** The first draft asked the
question; architecture review answered it. A spike record has no `- [ ]`
disposition ledger — it is a report, not a work item — so `findLaneDoneVacuity`
would fire on day one absent `expectEmptyDone`. "A concluded spike is a terminal
state" is true as prose and wrong as a lane argument: the lane model enforces
honest box disposition at close, not document lifecycles.

## Verification

- [x] **Red first, and the break class is the widening itself.** A new
      `check:nonvacuity` row plants a broken link at `work/__nonvacuity_probe_work_root__.md`
      — directly under `work/`, where only the widened root can see it. The
      existing repo-native probe lives in `work/bugs/`, a lane that was already a
      root, so it proved nothing about this. Measured: revert `ROOTS` to the three
      lane globs and the row reports
      `FAILED (did not fail on violating input) · json exit 0, terminal exit 0`,
      while every other corpus row stays green — which is precisely how the gap
      survived as long as it did. 71 fixtures now, from 70.
- [x] **The widening found a real defect on its first run**, which is the evidence
      the region was unchecked rather than merely unlisted: a stale pointer in
      `work/dogfood-coverage.md`, a dated Phase-0 audit. Doubly stale — the path
      predates the `packages/` restructuring, and the line it named is now a type
      field rather than the cast it claimed. Fixed by removing the pointer shape
      from an illustrative example, not by sanctioning it: the number added
      nothing and was wrong.
- [x] **A frozen spike behaves as the contract's gating half promises.** Measured
      with a planted probe under `work/spikes/`: a stale pointer is **not fatal**
      (exit 0) and a broken link in the same document **still fails**.
- [~] `done-otherwise` — **the contract's other half turned out to be false, and
  that is now its own record.** This box was written expecting frozen drift to
  be _reported_. It is not reported; frozen documents' pointers select
  `.areLive()` and are never examined. The gate's summary said
  "reported, never gated" on every run and now says
  "links gated, pointers not examined". Filed as
  [0253](../0253-frozen-drift-is-not-reported-only-unexamined.md).
- [~] `dropped-on-purpose` — **the foreign-repo pointer fixture.** This box asked
  for a fixture using a foreign path that suffix-matches a local file, on the
  assumption that live documents would carry upstream citations. Freezing
  concluded spikes removed that population: the documents most likely to cite
  another repo are now the ones whose pointers are not gated. The suffix trap
  is unchanged for live documents and is still real — it is described in this
  record's own body for whoever meets it — but building a fixture for a case
  this fix no longer creates would be coverage theatre.
- [x] **The document count moves**: 168 live → 172 live, 1166 links → 1201, 456
      pointers → 466, and 88 frozen → 91. Stated as a delta rather than pinned,
      per this record's own earlier correction.
- [~] `deferred→`[0108](../0108-work-readme-lanes-table-lists-one-lane.md) and
  [0251](../0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md)
  — **fixing `work/README.md`'s content.** This record's Fix listed it as step 4. It is not this record's to do: the map's two defects each have an owner,
  both were blocked on exactly this root gap, and both are now unblocked. That
  is the whole of what this fix owed them.

## Related

- [0248](../0248-the-source-text-guard-covers-a-sixth-of-the-repo.md) — the same
  question one gate over, and filed a day earlier: a population a check does not
  cover, where widening is a decision rather than a line.
- [0244](../0244-the-board-status-cell-is-bound-to-nothing.md) — the same shape a
  third time: an artifact readers trust, bound to nothing.
