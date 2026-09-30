# Bug 0369: the walk's prune list is fixed, so an adopter cannot stop it entering their own generated output

## Status

- **State:** Draft — deferred out of
  [0359](./fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md),
  which named the lever and did not build it.
- **Severity:** Low — **nothing is wrong today for any measured repository.** 0359 raised
  the budget to 500,000 and extended the default prune list from 14 names to 30, which
  covers every case anyone has measured. This is the residual: output nobody anticipated.
- **Origin:** [spike 0368](../spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md),
  which listed it third of four and measured why it matters less than the other three.
- **Reported:** 2026-09-30

## Symptom

`PRUNE` in `packages/ts/src/core/disk-set.ts` is a module constant referenced nowhere else.
An adopter whose repository holds a large generated tree the list does not name has no way
to say so: the walk enters it, spends the budget, and — since 0359 — reports exhaustion
naming that directory. The finding is honest and actionable (delete or relocate it), but
only if the directory is genuinely disposable. If it is code the adopter keeps and their
rules never scope to, they have nothing to do.

The budget is closed in the same way: its docstring says "not tunable", and
`buildDiskSet`'s injectable budget is documented "exported for tests only".

## Why it is not urgent

Measured in 0368: pruning removes **88.9%** of entries in a repository with no generated
output at all, and the dominant real case — an adopter's `.wrangler` at **58% of their
entries** — is now in the default list. The combination of a 30-name list and a 500,000
budget puts every repository measured so far far inside the bound. This bug is about the
next unanticipated one.

## Fix

Not decided, and deliberately not decided inside 0359. This is **public API**, which in
this repo means a proposal reviewed for kernel-vs-dialect placement before code — the shape
question is whether the prune list, the budget, or both become inputs, and where they live:

- an option on `project()` / `workspace()`, which today take no options at all;
- a family-level config, which
  [proposal 012](../proposals/012-a-family-config-declares-the-artifact-graph.md) is already
  arguing about for a different reason and may be the natural home;
- or nothing, on the grounds that "delete your generated output" is a sufficient remedy and
  a configurable walk is a knob that will be mis-set.

The third is a real option. A gate the adopter can narrow is a gate the adopter can
silence, and this project's whole subject is gates that stop being able to fail.

## Related

- [0359](./fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md)
  — the fix that made this the residual rather than the lever.
- [0368](../spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md) — the
  measurement that ranked it third.
- [0356](./0356-project-memoizes-for-process-lifetime-so-a-module-scope-export-builds-every-project.md)
  — the other open question about what `project()` should accept.

## Verification

- [ ] a proposal, reviewed for placement — not a bug fix's judgement call.
- [ ] if built: a red-first test that an adopter-named directory is really not walked, and a
      control that the default list still applies when nothing is named.
- [ ] the silencing risk addressed explicitly — a narrowed walk must not be able to hide an
      absence claim it would otherwise have contradicted.
