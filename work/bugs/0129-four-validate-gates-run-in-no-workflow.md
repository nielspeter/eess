# Bug 0129: four gates in the `validate` chain run in no CI workflow — a ledger violation, a duplicate work-item number or a preset violation merges green

## Status

- **State:** Draft — measured by differencing `package.json`'s `validate` chain
  against `.github/workflows/`. No red test yet.
- **Severity:** High — a live false green, and the only one on this board that is
  live in **CI** rather than in a record. Four gates that block locally block
  nothing on a pull request, and every ADR row citing "CI runs …" is a claim about
  a list these four are not on.
- **Origin:** self-found · devops persona, six-persona review of
  [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) and
  [0128](./0128-enforcement-status-is-the-cell-nothing-derives.md)
- **Reported:** 2026-08-12

## Symptom

`validate` chains **14** `check:*` gates. `.github/workflows/ci.yml` enumerates its
steps by hand and runs **10**. The difference:

| gate                   | what stops blocking a merge                          |
| ---------------------- | ---------------------------------------------------- |
| `check:baseline`       | a `recommended`-preset violation in `packages/*/src` |
| `check:ledger`         | a done plan or bug carrying an undisposed `- [ ]`    |
| `check:numbers`        | two work items claiming the same number              |
| `check:review-harness` | drift in the review harness                          |

`publish.yml` runs `build`, `typecheck`, `lint`, `format:check` and `test` only,
and disclaims the dogfood chain in its own comment — so no workflow runs these four
anywhere.

The two records filed alongside this one are a worked example: their number
uniqueness is enforced by `check:numbers`, which CI does not run. The green that
proved it (`70 numbered items … no number claimed twice`) is a local artifact.

## Reproduction

```bash
node -e "console.log(require('./package.json').scripts.validate.match(/check:[a-z:-]+/g).length)"   # 14
grep -c 'run: npm run check:' .github/workflows/ci.yml                                             # 10
```

Then, for the behavioural half — add an undisposed `- [ ]` to any record in
`work/plans/completed/`, push, and watch CI pass.

## Root cause

The step list is **hand-maintained and duplicated**. `package.json` holds one
ordering, `ci.yml` holds a second, and nothing binds them. Each of the four was
added to `validate` in a PR whose CI was green because `ci.yml` was not part of the
change.

`check:nonvacuity` does not cover the gap, and it is worth being precise about why:
its rows drive those gates' **fixtures**, never the repo. `bad-ledger.mjs`,
`bad-numbers.mjs` and `bad-review-harness.mjs` all run over corpora under
`scripts/nonvacuity/`. The one row that does invoke a real gate over real source —
`gateBaseline` — asserts only the **violating** direction; its clean run is recorded
in `cleanNote` and never enters `ok` (`scripts/check-nonvacuity.mjs`), so a genuine
`recommended` violation in `packages/*/src` leaves that row green.

This is [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)'s shape one
level up, and worse in one respect: 0127's 35 uncovered rules at least **run** in
CI. These four do not run at all.

It is also [0128](./0128-enforcement-status-is-the-cell-nothing-derives.md)'s subject
made concrete — `gated` means "mechanism runs in CI, failing blocks", and for any
clause citing one of these four it is false. (Measured, and to 0128's credit: none of
the 20 `gated` rows currently cites any of the four. The exposure is the next row
someone writes.)

## Fix

Add the four steps to `ci.yml` in `validate` order. One commit.

Then close the class rather than the instance — the duplication is the defect:

1. **Let CI run the chain**, not a copy of it. A single `npm run validate` step, or
   a step generated from the `validate` script, removes the second list entirely.
   The cost is losing per-gate step granularity in the GitHub UI, which is the
   reason the list was expanded by hand in the first place; weigh it.
2. **Or bind the two lists** — `gateCoverage()` in `scripts/check-nonvacuity.mjs`
   already enumerates from `package.json`'s `check:*` keys. Adding a
   `ci.yml`-membership column makes a gate that is in `validate` and not in a
   workflow a violation. That is the derivation the harness is missing: for the
   claim "this gate blocks a merge", the authoritative list is the workflow, and the
   harness currently reads the one a gate can be absent from while still looking
   accounted for.

(2) is the smaller change and closes it permanently; (1) is the honest one if the
step granularity is not worth a second list.

## Verification

- [ ] Red test written first: a gate present in `validate` and absent from
      `.github/workflows/**` is a violation. Fails today on exactly these four.
- [ ] The four gates run on a pull request, in `validate` order.
- [ ] The membership check derives both sides — the `validate` chain and the
      workflow — so the two lists cannot drift apart again
      ([0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)'s
      lesson).
- [ ] `gateBaseline`'s clean direction is either asserted or documented as
      deliberately informational, so "a real violation passes this row" is a stated
      property rather than a discovered one.
- [ ] `npm run validate` green.

Deferred: none.
