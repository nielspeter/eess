# Bug 0132: nothing binds the `validate` chain to the workflow that runs it — the derivation 0129 fixed the instance of, twice failed to build, and re-homed here

## Status

- **State:** Draft — the capability is unbuilt. What is written down is what three
  review rounds established about how to build it, which is the expensive part and
  the reason this is a record rather than a line in a plan.
- **Severity:** Medium — [0129](./fixed/0129-four-validate-gates-run-in-no-workflow.md)
  fixed the live instance (four gates, plus a base-branch filter that ran the whole
  chain nowhere on stacked PRs). What is missing is the guard that stops the two
  hand-maintained lists drifting apart a third time. Nothing is wrong today; the
  next `check:*` added to `validate` and not to `ci.yml` is wrong tomorrow, silently.
- **Origin:** self-found · re-homed from 0129 after two implementations failed
  review — five personas in the second round, five in the third
- **Reported:** 2026-08-13

## Symptom

`package.json`'s `validate` chain and `.github/workflows/ci.yml`'s step list are
two authored lists of the same thing. 0129 measured them four apart and fixed them.
Nothing asserts they stay together.

The reverse direction is unguarded too: `publish.yml` deliberately runs a lighter
set, so "in a workflow" is not the same claim as "in the workflow that gates a
merge", and only the second is worth anything.

## Root cause

Duplication with no join, which is the shape this whole family exists to catch —
`correspondence()` in the kernel is the primitive for "two artifacts must agree",
and `check:crossval` is built on it. The chain-to-workflow pair simply never got one.

## What two failed attempts established

Both attempts lived inside `scripts/check-nonvacuity.mjs` as an instrument row.
Both shipped green and were taken apart in review. The findings are the design.

**Attempt 1 — scan workflow files for `npm run <step>`.** Green through: a comment
containing `npm run validate` (which short-circuits the whole gate), a comment
inside the `on:` block (a push-only workflow read as merge-blocking), `if: false`,
`continue-on-error: true`, and `const missing = []` — the verdict itself, because
both controls returned from give-up branches and none drove the comparison.

**Attempt 2 — those five closed, six controls added.** Measured independently by
three personas: **7 of 7 mutations to the parser survived green**, including
`prTriggered` replaced with `return true`. Reverting any of `stripYamlComments`,
`readCondition`'s `false` branch, the `continue-on-error` check, or the `run:`-body
scoping re-opened the exact hole attempt 1 was corrected for, with all six controls
still satisfied. A committed fixture claimed to catch comment-voting and could not:
`prTriggered` returns before the comment-reading code runs.

**The structural finding, which is why this is re-homed rather than patched again.**
Three rounds produced the same defect class. The difference between this instrument
and every gate in the repo that does not have this problem is that the others are
`check:*` scripts with committed `bad-*` fixtures. A hand-rolled instrument gets
hand-rolled controls, and hand-rolled controls are exactly what kept being wrong.

## Fix

1. **Build it as a real gate**, `check:ci`, with a `scripts/nonvacuity/bad-*`
   fixture directory and a row in the gate table — the convention every other gate
   follows. That is what dissolves the control problem instead of re-solving it.
   Alternative home worth weighing: `check:integrity`, which is already the
   "two authored lists must agree" script.
2. **One fixture per hole, and each control's chain is exactly the step that
   fixture kills.** Measured in review: a composite fixture bundling several dead
   steps cannot discriminate — every mutant survives, because the other missing
   steps keep the verdict red regardless.
3. **Controls assert identity, not falsity.** `firedOn()` already does this for
   the gate fixtures: a fixture that exits 1 for some other reason cannot answer
   for the gate it is listed under. The attempt-2 controls filtered on
   `ok !== false`, so three of six passed via a branch other than the one they
   named, and one would silently change meaning the day a `.github/dependabot.yml`
   appears.
4. **Take a YAML parser.** The record this replaces claimed `scripts/` holds a
   zero-dependency convention and used it to justify hand-rolling. That was false —
   measured: seven of ten scripts import workspace packages, and `picomatch`,
   `eslint`, `typescript-eslint`, `mdast-util-from-markdown`, `typescript` and
   `@changesets/parse` are already imported there. `release-gate.mjs` took
   `@changesets/parse` for exactly this reason: parsing a foreign format by hand is
   how you get a parser that disagrees with the real one. `yaml` is available on
   the same terms.
5. **Decide what the claim is, and let the status string say only that.** Whether a
   check _blocks_ a merge depends on branch protection, which is a GitHub setting
   and not in the tree. Attempt 2 printed "blocks a merge" from a text scan — the
   over-claim [0128](./0128-enforcement-status-is-the-cell-nothing-derives.md) is
   about, committed inside its sibling's fix.

The alternative that removes the problem rather than guarding it: **have CI run
`npm run validate`** as a single step. The second list stops existing. The cost is
per-gate granularity in the GitHub UI, which is why the list was expanded by hand
originally. Worth deciding before building anything.

## Semantics a hand-rolled reader got wrong, measured

Kept as a checklist for whoever builds this, whichever way. Every row was verified
against attempt 2:

| shape                                           | attempt 2                                |
| ----------------------------------------------- | ---------------------------------------- |
| `pull_request: branches: [x]` (base-ref filter) | counted — this is 0129's second instance |
| `pull_request: types: [labeled]`                | counted, runs on no code push            |
| `pull_request_review` / `pull_request_target`   | counted, via substring match             |
| job-level `if:` / `needs:` / matrix skip        | counted                                  |
| `continue-on-error: ${{ true }}` or `'true'`    | counted                                  |
| job-level `continue-on-error: true`             | counted                                  |
| a `run:` body that only `echo`es the name       | counted                                  |
| a gate inside a shell `if` in a `run: \|` body  | counted                                  |
| reusable workflows (`jobs.x.uses:`)             | refused (fails closed)                   |
| `paths:` / `paths-ignore:`                      | refused (fails closed)                   |

`pull_request_target` is the nastiest: it fires on PRs and checks out the **base**
tree, so it would run and go green about `main` rather than about the change.

## Verification

- [ ] Red test written first: a `validate` step absent from every merge-blocking
      workflow fails, proven by a committed fixture rather than a one-time run.
- [ ] Every semantic row in the table above has its own fixture, or is declared
      out of scope in the gate's own header with a reason.
- [ ] Each control asserts **which** failure fired, not merely that one did.
- [ ] Deleting the gate's row, or any one of its fixtures, is caught — attempt 2
      could be removed from the harness entirely as a silent, green change.
- [ ] The status string claims only what was measured.
- [ ] `npm run validate` green.

Deferred: none.
