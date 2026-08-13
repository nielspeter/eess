# Bug 0132: the workflow-coverage instrument is regex over YAML, and two lists still nobody joins — the residuals 0129 named rather than closed

## Status

- **State:** Draft — every residual below was measured against the shipped
  instrument during [0129](./fixed/0129-four-validate-gates-run-in-no-workflow.md)'s
  review; none is speculative. No red test yet.
- **Severity:** Medium — nothing is wrong today and every residual but one fails
  **closed** (an unreadable shape reds the gate rather than passing it). It is
  filed because 0129's first version failed **open** in five ways, and the shapes
  below are what survived that repair — a known limit is only honest while someone
  can still find it written down.
- **Origin:** self-found · the five-persona review of 0129's fix, re-derived by the
  coordinator
- **Reported:** 2026-08-13

## Symptom

Two independent gaps, filed together because one fix closes both if it is taken.

**1. `ciChainCoverage` hand-parses YAML.** It reads triggers from a
comment-stripped `on:` block and coverage from `run:` bodies of steps carrying no
`if:` it cannot evaluate and no `continue-on-error: true`. What it still cannot
see, measured:

| shape                                                                  | direction                                   |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| job-level `if:` / `needs:` — the whole job never runs                  | **open** — steps read as live               |
| a matrix that skips the job                                            | **open**                                    |
| reusable workflows (`jobs.x.uses:`) and composite actions              | closed — reports the caller's steps missing |
| a `run:` body that merely echoes the string (`echo 'npm run check:x'`) | **open**                                    |
| branch protection — whether the check is _required_                    | not read, and stated in the status string   |

The three open shapes are contrived (nobody disables a gate by echoing its name),
but job-level `if:` is not: it is the natural way to skip a slow job, and it is the
one residual a reader would reasonably expect to be covered.

**2. Nothing asserts `check:*` ⊆ `validate`.** `gateCoverage()` enumerates
`check:*` from `package.json` and requires a gate row or a waiver;
`ciChainCoverage` enumerates the `validate` chain and requires a live PR step.
Neither asks whether a `check:*` is **in** the chain. A new script with a
`no-gate-yet` waiver in `NO_GATE_NEEDED` — three such waivers exist today — that is
never added to `validate` is green in both instruments and runs nowhere. That is
0129's exact shape, one list over.

## Reproduction

```bash
# 2 — a check:* that no chain runs, green in both instruments
node -e "const p=require('./package.json');
  const chain=p.scripts.validate.match(/check:[a-z:-]+/g);
  const all=Object.keys(p.scripts).filter(k=>k.startsWith('check:'));
  console.log('check:* not in validate →', all.filter(c=>!chain.includes(c)))"
# → ['check:fast']  (an alias today, so the set is clean — the guard is what is missing)
```

For (1), add `if: false` to the `test:` **job** in `ci.yml` and run
`npm run check:nonvacuity`: the row still reports every step covered.

## Root cause

A workflow file is a YAML document with GitHub-specific semantics — job graphs,
matrices, conditions, reusable calls — and the instrument reads it with regexes
over lines. That was a deliberate choice: `scripts/` holds a stated
zero-dependency convention (`check-workspace-integrity.mjs` says so in its header,
and `check-nonvacuity.mjs` says "node builtins + the workspace packages"), and the
convention is load-bearing for the portability of `kit/`. Taking a YAML parser for
one instrument breaks it.

The gap in (2) is the same duplication 0129 was about, one list over: three
authored lists (`check:*` keys, the `validate` chain, the workflow steps) and only
two of the three joins asserted.

## Fix

1. **Close (2) first — it is one assertion and needs no parsing.** In
   `gateCoverage()`, require every non-waived `check:*` to appear in the `validate`
   chain, with `check:fast` waived by name as the alias it is. That completes the
   triangle: keys ⊆ chain ⊆ live PR steps.
2. **Take a YAML dependency when a second workflow-shaped check appears, not
   before.** The trigger is deliberate. One instrument does not justify breaking
   the zero-dependency convention; two would, and at that point job-level `if:`,
   `needs:`, matrices and `uses:` all become readable properly rather than one
   regex at a time.
3. **Meanwhile, keep the residuals fail-closed and stated.** The `readCondition`
   seam already reports an unevaluatable step condition as a failure rather than
   guessing; the same treatment for job-level `if:` is a smaller change than a
   parser and is the one open shape worth closing by hand.

## Why it matters

The instrument's own header claims what it proves and lists what it does not,
which is the honest form. But a residual documented only in a source comment is
one refactor from being lost, and the shapes above are exactly the ones a future
reader would assume were handled — the gate says "every validate step is named in
a live PR step", and a job-level `if: false` makes that sentence false while the
row stays green.

## Verification

- [ ] Red test written first, for (2): a `check:*` present in `package.json`,
      waived in `NO_GATE_NEEDED`, and absent from `validate` fails
      `check:nonvacuity`. Green today.
- [ ] The new assertion has a control driving `gateCoverage()` itself, not a copy
      ([0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)'s lesson,
      which 0129's first version failed).
- [ ] Job-level `if:` either reads correctly or fails loudly, with a control.
- [ ] The residuals that remain are listed in the instrument's header **and** in
      this record, so neither can be the only copy.
- [ ] `npm run validate` green.

Deferred: none.
