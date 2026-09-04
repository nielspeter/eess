# Bug 0246: one non-vacuity fixture plants a probe `check:integrity` cannot recognise, so a killed run blames the corpus

## Status

- **State:** Draft — hit twice while fixing 0242, measured and bounded, not fixed.
- **Severity:** Medium — **not a false green; a false RED pointed at the wrong
  place.** It costs a reader the exact thing bug 0231 was filed to stop costing
  them: a gate reds over a file they never wrote, while the gate that exists to
  name such a file reports the workspace clean.
- **Origin:** self-found · killed a `check:nonvacuity` run twice during bug 0242
  and got two different outcomes from the same mistake — one named, one blamed
  on the corpus.
- **Reported:** 2026-09-04

## Symptom

Interrupt `npm run validate` during `check:nonvacuity` and a fixture may not
reach its cleanup. That is expected, and
[0231](./fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
is the record that made it survivable: `check:integrity` leads the chain,
recognises a leftover probe, and says so in the fixture's own words —

```
✗ non-vacuity probe present: work/proposals/__nonvacuity_probe_003-dup__.md —
  a fixture under scripts/nonvacuity/ plants this file and removes it again …
```

That works because it recognises a **name**: `PROBE_PREFIX = '__nonvacuity_probe'`
(`scripts/check-workspace-integrity.mjs:367`).

**One fixture does not use that name.** `bad-finished-not-closed.mjs` plants
`work/bugs/9999-nonvacuity-finished-but-open.md`
(`scripts/nonvacuity/bad-finished-not-closed.mjs:104`). Kill the run there and:

- `check:integrity` reports `10 probe roots free of leftover fixtures` — clean,
  because it is looking for a prefix this file does not carry;
- `check:ledger` then reds with
  `work/bugs/9999-nonvacuity-finished-but-open.md:5 ledger/finished-not-closed`.

A reader is now debugging an honesty-at-close violation in a bug record that
does not exist in the corpus, told by the preceding gate that the workspace is
fine. That is bug 0231's symptom exactly, with 0231's fix in place and not
covering this one file.

## Measured, and bounded

Surveyed 2026-09-04 — every path any fixture plants:

| fixture                                  | plants                                                                                   | recognised by `check:integrity` |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| six fixtures under `scripts/nonvacuity/` | `packages/core/src/__nonvacuity_probe_{copy,empty,generic_error,leftover,nul,stub}__.ts` | yes                             |
| `bad-finished-not-closed.mjs`            | `work/bugs/9999-nonvacuity-finished-but-open.md`                                         | **no**                          |

One of seven. The gap is a single file and the fix is small; what makes it worth
a record is that the convention it breaks is load-bearing and nothing enforces
it.

## Why the odd name is not simply a mistake

The fixture has a reason, and any fix has to keep it. Its comment says so:

> Everything above proves the FUNCTION discriminates; none of it proves
> `check-ledger.mjs` calls it against `work/`. … So plant a real
> finished-but-open record in the live lane and require the real gate to red on
> it.

The plant must be **scanned by the real gate**, which means it has to look like a
real record in a real lane. `.gitignore` carries `**/__nonvacuity_probe*`, and
the corpus globs are what they are — so renaming it to the recognised prefix
risks the plant no longer being seen by the very gate it exists to exercise.
That has to be checked, not assumed.

## Fix (not built)

The convention is doing work and is enforced by nothing, so the fix should make
the fixtures declare their plants rather than agree by habit:

1. A single exported list of plant paths that both the fixtures and
   `check:integrity` read, so a new fixture cannot invent an unrecognised path.
2. `check:integrity` names any of them that is present, in the words it already
   uses.
3. A guard that a fixture's plant path appears in that list — otherwise this
   record's defect returns with the next fixture.

Open, and genuinely open: whether the `9999-` plant can move to the recognised
prefix without falling out of the ledger scan. If it can, the rename is the
cheaper half of item 1 and should be done first.

## Verification

- [ ] Red first: with the plant present, `check:integrity` names it rather than
      reporting the workspace clean.
- [ ] `check:ledger` is not the gate that reports it.
- [ ] The list-membership guard reds when a fixture plants an undeclared path —
      the half that stops this recurring.
- [ ] The `bad-finished-not-closed` fixture still discriminates after any rename,
      re-measured rather than assumed.

## Related

- [0231](./fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
  — the record this one completes. Its fix is right and covers six of the seven
  plants; this is the seventh.
- [0232](./fixed/0232-a-nonvacuity-fixture-blames-the-gate-for-a-dirty-baseline.md)
  — the same family again: a fixture whose leavings are read as a defect in the
  code under test.
