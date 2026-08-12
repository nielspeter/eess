# Bug 0108: `work/README.md`'s Lanes table lists one lane and calls the others cargo-cult — three of them exist

## Status

- **State:** Draft — confirmed against the directory tree; no red test written
  yet.
- **Severity:** Low — documentation drift, no runtime effect. Filed rather than
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

| Directory         | Exists | Board                   | Documented in the table |
| ----------------- | ------ | ----------------------- | ----------------------- |
| `work/plans/`     | yes    | `work/plans/ROADMAP.md` | yes                     |
| `work/bugs/`      | yes    | `work/bugs/BUGS.md`     | **no**                  |
| `work/proposals/` | yes    | none                    | **no**                  |
| `work/spikes/`    | yes    | none                    | **no**                  |

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

The related omission is that `work/proposals/` has **no README and no board** at
all, so the lane a reviewed proposal lives in has no documented lifecycle —
which is how an inbound proposal came to sit in it with no provenance field
until [002](../proposals/002-comment-embedded-links.md) was reviewed.

## Fix

**1 — Tell the truth in the table.** Add rows for `bugs/` (board `BUGS.md`,
terminal `fixed/`), `proposals/`, and `spikes/`. Replace the solo-greenfield
sentence with what is now true: which lanes exist, and that further lanes join
the same skeleton and the same number sequence (see
[0107](./0107-number-allocation-scans-one-lane.md)) when the work calls for
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
