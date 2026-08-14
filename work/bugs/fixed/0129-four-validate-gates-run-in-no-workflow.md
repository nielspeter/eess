# Bug 0129: four gates in the `validate` chain run in no CI workflow — a ledger violation, a duplicate work-item number or a preset violation merges green

## Status

- **State:** Fixed — the four steps run in `ci.yml` in `validate` order, and the
  `pull_request` trigger no longer carries a `branches:` filter, which was a second
  instance of the same defect found during review (see Correction). Closed on the
  **instance**. The derivation that would stop the two lists drifting again was
  attempted here, failed review twice, and is re-homed to
  [0132](../0132-the-chain-and-the-workflow-need-a-derivation.md).
- **Severity:** High — a live false green, and the only one on this board that was
  live in **CI** rather than in a record. Four gates that block locally blocked
  nothing on a pull request.
- **Origin:** self-found · devops persona, six-persona review of
  [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) and
  [0128](../0128-enforcement-status-is-the-cell-nothing-derives.md)
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-13 (PR #49)

## Symptom

`validate` chains **14** `check:*` gates. `.github/workflows/ci.yml` enumerated its
steps by hand and ran **10**. The difference:

| gate                   | what stopped blocking a merge                        |
| ---------------------- | ---------------------------------------------------- |
| `check:baseline`       | a `recommended`-preset violation in `packages/*/src` |
| `check:ledger`         | a done plan or bug carrying an undisposed `- [ ]`    |
| `check:numbers`        | two work items claiming the same number              |
| `check:review-harness` | drift in the review harness                          |

`publish.yml` runs `build`, `typecheck`, `lint`, `format:check` and `test` only,
and disclaims the dogfood chain in its own comment — so no workflow ran these four
anywhere.

**And a second instance, found in review:** `pull_request: branches: [main]`
filters the PR's **base** ref. This repo stacks branches, so a PR into anything
other than `main` matched no trigger and ran the whole chain nowhere. Measured on
this record's own pull request: `gh pr checks 49` → _"no checks reported"_, while
PR #48 (base `main`) reported `test pass 3m55s`. The fix for "four gates run in no
workflow" was itself merging through a PR on which nothing ran.

## Reproduction

```bash
node -e "console.log(require('./package.json').scripts.validate.match(/check:[a-z:-]+/g).length)"   # 14
grep -c 'run: npm run check:' .github/workflows/ci.yml                                             # 10
```

For the trigger half: open a PR whose base is any branch other than `main` and run
`gh pr checks <n>`.

## Root cause

The step list was **hand-maintained and duplicated**. `package.json` held one
ordering, `ci.yml` a second, and nothing bound them. Each of the four was added to
`validate` in a PR whose CI was green because `ci.yml` was not part of the change.

`check:nonvacuity` did not cover the gap, and it is worth being precise about why:
its rows drive those gates' **fixtures**, never the repo. `bad-ledger.mjs`,
`bad-numbers.mjs` and `bad-review-harness.mjs` all run over corpora under
`scripts/nonvacuity/`. The one row that does invoke a real gate over real source —
`gateBaseline` — asserts only the **violating** direction; its clean run is recorded
in `cleanNote` and never enters `ok`, so a genuine `recommended` violation in
`packages/*/src` leaves that row green. That is now stated at its site rather than
left to be discovered.

This is [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)'s shape
one level up, and worse in one respect: 0127's uncovered rules at least **run** in
CI. These four did not run at all.

## Fix

**Shipped:** the four steps in `ci.yml` in `validate` order, and the removal of the
`branches:` filter from the `pull_request` trigger. The two step lists are now
identical in membership and order, verified by `diff`.

**Considered and not shipped here.** The record originally proposed closing the
_class_ in the same PR — a derivation binding the two lists so they cannot drift
again. That was built twice and failed review twice: the first version was green
through a comment, an `if: false`, a `continue-on-error` and an emptied verdict;
the second closed those in code and guarded none of them, so every parser function
could be reverted to its pre-review state with the row still printing OK. Both
failures are the same class, and the third review named the structural reason: a
hand-rolled instrument inside `check:nonvacuity` gets hand-rolled controls, where a
real `check:*` gate would get a `bad-*` fixture by convention. The capability, and
what review established about how to build it, is
[0132](../0132-the-chain-and-the-workflow-need-a-derivation.md).

Two options remain open there and are recorded rather than decided:

1. **Let CI run the chain** — a single `npm run validate` step removes the second
   list entirely, at the cost of per-gate step granularity in the GitHub UI.
2. **Bind the two lists** with a real gate, fixtures and all.

## Verification

- [x] The four gates run on a pull request, in `validate` order — every chain step
      appears in `ci.yml` in chain order, verified by `diff`. (`ci.yml` also carries
      `npm ci` and `npm rebuild`, which are not chain steps.)
- [x] A PR whose base is not `main` runs the chain — the `branches:` filter is gone,
      and this record's own PR is the case that proved it necessary.
- [x] `gateBaseline`'s clean direction is documented as deliberately informational
      at its site: `cleanNote` never enters `ok`, so a real `recommended` violation
      leaves that row green — correct division of labour, since catching one is
      `check:baseline`'s job, and that now runs in CI.
- [x] `npm run validate` green.

Deferred, each re-homed:

- **The derivation binding the chain to the workflow** →
  [0132](../0132-the-chain-and-the-workflow-need-a-derivation.md), which carries
  the design constraints three review rounds established.
- **Nothing asserts `check:*` ⊆ `validate`** →
  [0133](../0133-nothing-requires-a-check-to-join-the-chain.md).

## Outcome

The instance was four lines of YAML and one deleted filter. The attempt to close
the class in the same PR is the part worth recording.

### Correction — two attempts, both false greens, both caught in review

Kept because a record that closed a false green by shipping one has no business
hiding it. Both were found **before merge**, so this is an unfinished fix corrected
in place, not the board's "a later break is a new bug" rule being bent.

**First attempt** — an instrument scanning workflow files for `npm run <step>`:

| claimed                                      | measured                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| "the words in a comment cannot vote"         | a comment saying `npm run validate` turned the whole gate green |
| the `on:` block alone decides the trigger    | a comment **inside** that block made a push-only workflow count |
| a step present means the step runs           | `if: false` and `continue-on-error: true` both read as covered  |
| controls prove the instrument can fail       | only its give-up branches — `const missing = []` stayed green   |
| status: "every validate step blocks a merge" | branch protection is not in the tree; nothing read it           |

**Second attempt** — those five closed in code, six controls added. Three review
personas measured the same thing independently: **7 of 7 mutations to the parser
survived green**, including `prTriggered` replaced by `return true`. The four holes
above were fixed and none was locked in. A committed fixture claimed to catch
comment-voting and structurally could not, because `prTriggered` returns before the
comment-reading code is ever reached.

The lesson is not "add more controls". It is that the third round found the same
defect class as the first two, and the difference between this instrument and every
gate in the repo that does not have this problem is that the others are `check:*`
scripts with `bad-*` fixtures. 0132 carries that.

Also found while fixing, and worth its own line: the first `validate` run after the
fix exited **1** at `format:check` on an unformatted edit, and the chain reported
nothing about the three steps it then skipped — [0126](../0126-validate-cannot-say-it-stopped-short.md),
hit for the third time in one session, inside the fix for its sibling.
