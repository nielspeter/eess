# Bug 0108: `work/README.md`'s Lanes table lists one lane and calls the others cargo-cult — three of them exist

## Status

- **State:** Fixed — the table names all four lanes, and `check:corpus` binds the
  `Folder` column to the real directories so it cannot drift again in either
  direction.
- **Severity:** Medium — raised from Low on 2026-09-04. "Documentation drift, no
  runtime effect" is true of the paragraph and false of the consequence: a
  newcomer following this map writes records the gate refuses (see the State-token
  finding below). Filed rather than
  silently corrected because the document's stated job is to be the map a fresh
  agent reads first, and because the claim is mechanically bindable (see _Fix_).
- **Origin:** self-found · reviewing inbound proposal 002, when the proposals
  lane turned out to be undocumented
- **Reported:** 2026-08-12

## Symptom

`work/README.md` describes itself as "the durable, reloadable memory a fresh
agent reads to reconstitute context … the one-screen map". Its Lanes table has a
single row:

```
| Folder              | What                 | Board                              | Terminal (frozen) subfolders |
| [`plans/`](./plans) | Implementation plans | [`ROADMAP.md`](./plans/ROADMAP.md) | `completed/`, `wont-do/`     |
```

followed by:

> eess is a **solo-greenfield** instance — one lane. The `bugs/`, `refinement/`
> and `support/` lanes … appear only when the work calls for them; until then
> they'd be cargo-cult.

`work/` currently contains **four** numbered or boarded lanes:

| Directory         | Exists | Board                         | Documented in the table |
| ----------------- | ------ | ----------------------------- | ----------------------- |
| `work/plans/`     | yes    | `work/plans/ROADMAP.md`       | yes                     |
| `work/bugs/`      | yes    | `work/bugs/BUGS.md`           | **no**                  |
| `work/proposals/` | yes    | `work/proposals/PROPOSALS.md` | **no**                  |
| `work/spikes/`    | yes    | none                          | **no**                  |

The bugs lane has a full board, a severity scale, a record template, and its own
terminal folder (`work/bugs/fixed/`). The prose does not merely omit it — it
asserts the lane would be cargo-cult if it existed.

## Reproduction

```bash
ls -d work/*/            # → bugs/ plans/ proposals/ spikes/
rg -c '^\| \[`' work/README.md   # → 1 lane row
```

No gate reports the discrepancy. `check:corpus` validates that links resolve and
that `path:line` pointers ground; "these are all the lanes" is a prose claim
about the world, and there is nothing for a link check to catch. The one lane
listed is described correctly, so the table is not _wrong_ — it is silently
incomplete, which is the harder failure to notice.

## Root cause

The text was accurate when written: eess ran one lane. Three lanes were added
since — `bugs/` when the first defect was filed, `proposals/` and `spikes/` as
the work called for them — and each addition was exactly the event the sentence
anticipated ("appear only when the work calls for them"). The sentence describes
its own supersession and was never revisited, because nothing required it to be.

The related omission was that `work/proposals/` had **no README and no board** at
all, so the lane a reviewed proposal lived in had no documented lifecycle — which
is how an inbound proposal came to sit in it with no provenance field until
[002](../../proposals/002-comment-embedded-links.md) was reviewed. **The board half
is closed; the README half is not** — `work/proposals/` still has no README, and
this record's own deferral below still carries it. The past tense above covers
the board only.

> **This record drifted too, and the correction is the point.** `PROPOSALS.md`
> has existed since 2026-08-13 — the day after this was filed — so the table
> above claimed "none" for 23 days. A Draft bug left open long enough to need its
> own re-measurement is a signal about the ranking, not about the bug; that is why
> the severity moved. Found by the working-method reviewer on its first run
> ([0250](./0250-the-review-roster-has-no-working-method-lens.md)).

## A second defect in the same document, split out

The **State-token** table beneath the Lanes table teaches one union vocabulary
where `check-ledger.mjs` declares three disjoint ones — a bigger problem than this
record's, and a different one.

An earlier version of this work widened 0108 to carry it. Architecture review
called that wrong: _split, don't widen_. The two share a filename and nothing
else — different table, different binding target (`LANES`, not the directory
tree), different prerequisites — and bundled, the record is closable in neither
half, the constraint this repo already applies to plan phases. It is
[0251](../0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md).

Both are blocked on the same root gap, and 0251 carries a second prerequisite
this record does not.

> **Unblocked 2026-09-04.** This record's fix binds the Lanes table to the real
> directories with `rows()` + `correspondence()`. It was blocked because
> `work/README.md` sat outside every `check:corpus` root, so a correspondence
> authored then would have examined **zero** rows and reported green — a vacuous
> gate, the defect this repo exists to prevent.
>
> [0249](./0249-most-of-work-is-outside-every-corpus-root.md) widened the
> roots to `work/**`; `work/README.md` is now a live corpus document, so the rule
> this record calls for would examine real rows. **The prerequisite is met and
> nothing else about this record changed.** Neither record named the other until
> the working-method reviewer did.
>
> One addition that arrived with the unblocking:
> [0256](./0256-the-spike-lane-is-run-but-never-declared.md) needs the `spikes/`
> row this record's Fix already calls for, and defines what the lane means.

## Fix

**1 — Tell the truth in the table.** _(done)_ Add rows for `bugs/` (board `BUGS.md`,
terminal `fixed/`), `proposals/`, and `spikes/`. Replace the solo-greenfield
sentence with what is now true: which lanes exist, and that further lanes join
the same skeleton and the same number sequence (see
[0107](./0107-number-allocation-scans-one-lane.md)) when the work calls for
them.

**2 — Bind it, so it cannot drift again.** _(done)_ This is a markdown table making a
checkable claim about directories, which is precisely the case `eess-md`'s
`rows()` plus the kernel's `correspondence()` exist for — the pattern the md
README already documents. One rule binds the Lanes table's `Folder` column to
the real directories under `work/`, and drift either way fails `check:corpus`:
a lane added without a row, or a row naming a directory that does not exist.

That is worth more than the correction itself. The repo's own one-screen map is
currently the least-gated document in a corpus whose thesis is that specs are
checked, and it is a spec — this is the dogfooding gap, not just a stale
paragraph.

**3 — Not in scope here:** giving `work/proposals/` its own README and
lifecycle. That is a convention to decide, not a defect to fix — see _Deferred_.

No changeset — no `packages/` directory changed (`check:release`: 0 changed of
6 workspace packages). Not "documentation only": this ships gate code in
`scripts/`, which no package publishes.

## Verification

- [x] **Red first.** The binding was written before the table was touched, and
      reported exactly the three lanes this record names:

      ```
      lanes     1 row(s) · 4 directories · ✗ 3 finding(s)
        work/README.md:1  work/bugs/ exists but the Lanes table does not list it
        work/README.md:1  work/proposals/ exists but the Lanes table does not list it
        work/README.md:1  work/spikes/ exists but the Lanes table does not list it
      ```

      Green once the rows exist: `4 row(s) · 4 directories · ✓ the map lists
      every lane`.

- [x] The reverse direction reds too — a row for `ghosts/` gives
      `the Lanes table lists "ghosts/", which is not a directory under work/`,
      at the row's own line.
- [x] `check:corpus` prints a `lanes` line with both denominators (rows and
      directories) beside its siblings, and the row count feeds `totalChecked`
      — so a table emptied to zero rows is visible rather than a silent pass.
- [x] Both directions have a `check:nonvacuity` row over the production script,
      because the rule emits two ids and the harness's own `rule-id coverage`
      self-check requires a fixture per id. The unlisted-lane fixture plants a
      directory; the unresolved-row fixture mutates `work/README.md` itself and
      restores it, since the fault _is_ a row in that one named table and no
      probe document can stand in for it.
- [x] `npm run validate` green.

**One thing the binding decides that the record did not.** Ground truth is
**every top-level directory** under `work/`, not "every directory that looks like
a lane". A cleverer test existed — `check-ledger.mjs` decides lane-ness by whether
a directory carries `State:`-shaped records — and it is the wrong one here:
`work/spikes/` carries none, because a spike concludes rather than closes
([0256](./0256-the-spike-lane-is-run-but-never-declared.md)). That test
would have exempted the very lane whose absence from this map was the last thing
anyone noticed. A directory the map does not mention is the gap, whatever is in
it; if a non-lane directory ever appears, the answer is a row saying what it is,
not an exemption.

Deferred:

- **A README and lifecycle for `work/proposals/`** — what states a proposal
  moves through, whether it has a board, and where a ruled proposal goes when
  it is neither accepted nor rejected. Proposal 002 is the first record to need
  it. That is a convention decision, not a defect, so it is not resolved here.
  deferred→[plan 0259](../../plans/0259-a-lifecycle-for-the-proposals-lane.md).

  **Corrected after review.** This deferral originally read "re-homed to the
  working-method docs (`docs/working-method.md`)". Review measured that file:
  zero occurrences of "proposal". Naming a filename is not naming an owner —
  the item would have sat in a frozen record, on no board, with no number, which
  is precisely the silent deferral `/close` exists to prevent. Plan 0259 is the
  home, authored in the review round rather than promised.
