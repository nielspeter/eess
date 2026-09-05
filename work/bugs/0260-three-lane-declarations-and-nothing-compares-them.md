# Bug 0260: three declarations of the lane set, and nothing compares them

## Status

- **State:** Draft — found by the architect lens reviewing bug 0108's fix, and
  filed rather than folded into it: 0108 bound one of the three declarations to
  the filesystem, which is what it was for. Binding them to _each other_ is a
  second mechanism.
- **Severity:** Low — nothing is wrong today. All three are green, and the
  disagreement is currently benign. It is the shape that is wrong.
- **Created:** 2026-09-05

## Symptom

Three places declare what the lanes are. No two agree, and no gate compares them.

| declaration                        | lanes                                  | bound to                  |
| ---------------------------------- | -------------------------------------- | ------------------------- |
| `work/README.md` Lanes table       | `plans`, `bugs`, `proposals`, `spikes` | the filesystem (bug 0108) |
| `scripts/check-ledger.mjs` `LANES` | `plans`, `bugs`, `proposals`           | nothing                   |
| `docs/working-method.md`           | Plan, Bug, Refinement, Support, Spike  | nothing                   |

Two gates print the word "lanes" with different integers, in the same
`npm run validate` run, and neither consults the other:

```
check:corpus   lanes     4 row(s) · 4 directories · ✓ the map lists every lane
check:ledger   lanes     3 declared · 4 work/ directories · 0 uncovered
```

## Root cause

Bug 0108 chose the filesystem as ground truth for the map, and the reasoning is
sound — `check-ledger.mjs` decides lane-ness by whether a directory carries
`State:`-shaped records, and `work/spikes/` carries none (a spike concludes
rather than closes, bug 0256), so that test would have exempted the very lane
whose absence started 0108.

What 0108 did not address is the consequence: having rejected `LANES` as ground
truth, the two declarations are now independent derivations of the same fact
with nothing comparing them. ADR-009 Rule 5 — _a derivation is unguarded until a
differently-derived value disagrees with it_ — is exactly the clause in play, and
the disagreeing value already exists in the repo. It just isn't read.

`docs/working-method.md` is the third and loosest: it lists lanes as _shapes_
(Refinement and Support have no directory here), so it is not straightforwardly
comparable — but it omits Proposal entirely, which is both a directory and a row
in the map. That omission is real regardless of how the list is framed.

## Fix (proposed, not settled)

Bind `work/README.md`'s Lanes table to `check-ledger.mjs`'s `LANES` in the
direction that is actually true: **every `LANES` entry must have a row in the
map.** Not the reverse — `spikes/` is deliberately a lane in the map and not in
`LANES`, and a gate that forbade that would re-break 0256.

The working-method list is prose about shapes; the honest fix there is a
sentence introducing the proposals lane, which [plan 0259](../plans/0259-a-lifecycle-for-the-proposals-lane.md)
already owns.

## Verification

- [ ] a `LANES` entry with no row in `work/README.md` fails `check:corpus` (or
      `check:ledger` — placement is part of the fix)
- [ ] `work/spikes/` — a map row with no `LANES` entry — stays green
- [ ] a nonvacuity fixture per emitted rule id
