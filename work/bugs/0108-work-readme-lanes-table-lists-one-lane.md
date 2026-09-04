# Bug 0108: `work/README.md`'s Lanes table lists one lane and calls the others cargo-cult — three of them exist

## Status

- **State:** Draft — confirmed against the directory tree; no red test written
  yet.
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
[002](../proposals/002-comment-embedded-links.md) was reviewed.

> **This record drifted too, and the correction is the point.** `PROPOSALS.md`
> has existed since 2026-08-13 — the day after this was filed — so the table
> above claimed "none" for 23 days. A Draft bug left open long enough to need its
> own re-measurement is a signal about the ranking, not about the bug; that is why
> the severity moved. Found by the working-method reviewer on its first run
> ([0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md)).

## The larger half, found 2026-09-04: the close convention is wrong, not just the lanes

This record was filed about the **Lanes** table. The **State-token** table beneath
it is wrong in a way that costs more, and neither this record nor
[0249](./0249-most-of-work-is-outside-every-corpus-root.md) covered it.

`work/README.md` presents one four-token vocabulary — `Draft` / `Ready` / `Done` /
`Won't-do` — as _the_ close convention. `scripts/check-ledger.mjs` declares three
deliberately **disjoint** ones:

| lane      | states                                            | terminal           |
| --------- | ------------------------------------------------- | ------------------ |
| plans     | Draft, Ready, **Open**, Done, Won't-do            | Done, Won't-do     |
| bugs      | Draft, Ready, **Fixed**, **Rejected**, **Parked** | Fixed, Rejected    |
| proposals | Draft, **Promoted**, **Rejected**                 | Promoted, Rejected |

Measured across `work/`: dozens of records carry `Fixed`, three carry `Promoted`,
two carry `Parked`. **None of the three appears in the map.**

And the separation is load-bearing, not incidental — the gate's own comment says
so: _"They are scanned separately because a union would let a plan marked `Fixed`
pass as a known state — the precision this gate exists for."_ The one-screen map
teaches exactly the union the gate was built to refuse. A newcomer who closes a
bug as `Done` per this table gets a red gate the map cannot explain.

**The dogfood is also worse than the product.** `kit/templates/work/README.md` —
what eess _exports_ as its portable working method — lists two lanes including
`bugs/`, and gives the plan vocabulary correctly, `Open` included. The repo's own
copy lists one lane and calls the bugs lane "cargo-cult". The two files have
diverged into structurally different documents, so a fix to either will not
propagate and nothing binds them.

**A third binding, higher-value than this record's original two and proposed by
nobody until now:** bind the map's state-token table to `check-ledger.mjs`'s
`LANES` vocabularies, so the map cannot again teach a token the gate rejects.
That is the difference between fixing today's text and making tomorrow's drift
impossible.

> **Blocked, noted 2026-09-04.** This record's fix binds the Lanes table to the
> real directories with `rows()` + `correspondence()`. That rule cannot work yet:
> `work/README.md` is outside every `check:corpus` root, so a correspondence
> authored today examines **zero** rows and reports green — a vacuous gate, which
> is the defect this repo exists to prevent. Sequence behind
> [0249](./0249-most-of-work-is-outside-every-corpus-root.md), which owns the root
> gap. Neither record named the other until the working-method reviewer did.

## Fix

**1 — Tell the truth in the table.** Add rows for `bugs/` (board `BUGS.md`,
terminal `fixed/`), `proposals/`, and `spikes/`. Replace the solo-greenfield
sentence with what is now true: which lanes exist, and that further lanes join
the same skeleton and the same number sequence (see
[0107](./fixed/0107-number-allocation-scans-one-lane.md)) when the work calls for
them.

**2 — Bind it, so it cannot drift again.** This is a markdown table making a
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

No changeset — corpus documentation only.

## Verification

- [ ] Red test written first: the Lanes-table binding fails while `bugs/`,
      `proposals/` and `spikes/` are unlisted, and passes once rows exist.
- [ ] The reverse direction goes red too: add a row for a directory that does
      not exist and the gate fails.
- [ ] `check:corpus` reports the new rule in its per-check counts, so the
      binding is visibly non-vacuous rather than a silently-zero rule.
- [ ] `npm run validate` green.

Deferred:

- **A README and lifecycle for `work/proposals/`** — what states a proposal
  moves through, whether it has a board, and where a ruled proposal goes when
  it is neither accepted nor rejected. Proposal 002 is the first record to need
  it. That is a convention decision, not a defect; re-homed to the working-method
  docs (`docs/working-method.md`) rather than resolved here, so this bug closes
  with its own PR.
