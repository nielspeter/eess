# Bug 0251: `work/README.md` teaches one close vocabulary where the gate declares three disjoint ones

## Status

- **State:** Draft — split out of [0108](./0108-work-readme-lanes-table-lists-one-lane.md)
  on architecture review's advice; measured, not fixed.
- **Severity:** Medium — **the map teaches exactly what the gate was built to
  refuse.** A newcomer following it closes a bug as `Done` and gets a red
  `check:ledger` the map cannot explain.
- **Origin:** self-found · the working-method reviewer's first run, on the very
  change that created it ([0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md)).
- **Reported:** 2026-09-04

## Why this is not part of 0108

0108 is about the **Lanes** table listing one lane where four exist. This is the
**State-token** table beneath it. They share a filename and nothing else:

|                | 0108                                                              | this record                          |
| -------------- | ----------------------------------------------------------------- | ------------------------------------ |
| wrong table    | Lanes                                                             | State tokens                         |
| binding needed | table ↔ real directories                                          | table ↔ `check-ledger.mjs`'s `LANES` |
| blocked on     | [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) | 0249 **and** a refactor (below)      |

Architecture review's call was _split, don't widen_: bundled, the record is
closable in neither half — the constraint this repo already applies to plan
phases. An earlier version of this work widened 0108 instead, and its Fix section
then had to carry two deliverables of different sizes with different
prerequisites.

## Symptom

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

The separation is load-bearing, not incidental — the gate says so itself:

> They are scanned separately because a union would let a plan marked `Fixed`
> pass as a known state — the precision this gate exists for.

So the one-screen map teaches precisely the union the gate refuses.

## The exported method has the same defect, and worse

`kit/` ships this repo's working method to other projects. Measured:

- `kit/templates/work/README.md` teaches the same single union vocabulary.
- `kit/templates/plan.md` gives `Draft · Ready · Done · Won't-do`, **omitting
  `Open`** — so the kit contradicts itself.
- `kit/skills/close/SKILL.md` gives `**State:** Done` for every lane.
- **`Fixed` appears zero times across all three.** The exported method never
  teaches the bugs lane's terminal token at all.

Fixing only this repo's copy leaves the exported method wrong.

## Two prerequisites, one of which is code

1. **`work/README.md` must be inside a `check:corpus` root** —
   [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md). Until then a
   binding rule examines zero rows and reports green.
2. **`LANES` is not importable, and adding `export` will not fix it.**
   `scripts/check-ledger.mjs:49` declares it as a bare `const` in a module with
   top-level side effects — it runs the whole scan at `:84`, walks `work/` at
   `:107`, and calls `process.exit` at `:167` and `:228`. Importing it to build a
   correspondence would run the gate and could exit the rule's process. The
   vocabulary has to be extracted to `scripts/lib/` first, the way
   `lane-coverage.mjs` and `finished-not-closed.mjs` already are.

   Architecture review found this; neither 0108 nor the first draft of this
   finding named it.

## Fix (not built)

1. Replace the single table with the three lane vocabularies, terminal states
   marked.
2. Extract `LANES` to `scripts/lib/`, then bind the table to it with `rows()` +
   `correspondence()` — the same shape `spec.rules.ts` already uses to join a
   `rows()` selection against a hand-built one. A token taught here that the gate
   would reject then fails `check:corpus`.
3. Decide what the kit can carry. A fresh `kit/`-bootstrapped project starts with
   one lane, so lane-specific vocabularies may not be portable as-is — that is the
   open question, not a detail.
4. A `check:nonvacuity` row, or the binding is a claim rather than a check.

## Verification

- [ ] Red first: a token in the map that no lane declares fails `check:corpus`.
- [ ] The reverse: a lane vocabulary the map omits fails too.
- [ ] The rule reports a non-zero denominator, so it is visibly not the
      zero-row rule 0249 warns it would be today.
- [ ] The kit's three copies agree with whatever is decided, or the record says
      why a portable kit cannot carry lane-specific vocabularies.

## Related

- [0108](./0108-work-readme-lanes-table-lists-one-lane.md) — the other half of the
  same document, split from this on review's advice.
- [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) — the root gap both
  halves are blocked on.
- [0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md) — the lens
  whose first run found this.
