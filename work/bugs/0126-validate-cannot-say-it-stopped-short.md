# Bug 0126: a truncated `validate` run looks like a green one — the chain reports every step it ran and nothing about the ones it didn't

## Status

- **State:** Draft — the failure was lived, not constructed: it hid the test
  suite for a full working session. No red test yet.
- **Severity:** Medium — no false green in the exit code, which is correct
  throughout. It is an honesty gap in the output, and it is the gate-runner's
  own instance of the failure class every gate below it exists to catch.
- **Origin:** self-found · noticed while reporting results for
  [0122](./fixed/0122-violations-path-drops-because.md)'s review round, after
  several sessions of claiming "validate green" from a chain that had exited 1
- **Reported:** 2026-08-12

## Symptom

`validate` is a single `&&`-joined chain — nineteen steps when this was filed,
**twenty-four** as of 2026-09-03, which is itself part of the point: the chain
grows and the hazard grows with it. `format:check` was step 18; `test` step 19.
An unformatted file anywhere prettier looks — including a scratch directory
nobody intended to check — stops the chain there, and **the suite never runs**.

What the operator sees is seventeen steps' worth of ✓ summaries, each one
truthful, followed by a prettier warning:

```
  ✓ corpus integrity — 250 checks across 59 documents, 0 violations
  ✓ honesty at close — 27 done-items across 65 records, 0 findings
  nonvacuity: 20 gates each failed on their violating input — none is silently green.
  …
  [warn] reports/positioning-brief.md
  [warn] Code style issues found in 3 files.
```

Nothing states that steps 18 and 19 did not complete. There is no line reading
`stopped at step 18 of 19`, and no `✓ validate — 19 of 19`. The last word on
screen is a formatting nit, and the accumulated ✓s above it read as the run.

Lived consequence: across an entire working session I reported "`npm run
validate` green" from runs that exited **1** and never reached `npm run test`.
The tests did pass — run directly — but that is a fact I asserted without having
the evidence I claimed. The chain was doing exactly what `&&` means; the output
gave no way to notice.

## Reproduction

```bash
printf 'x   =1\n' > packages/core/src/__unformatted__.ts
npm run validate; echo "exit=$?"      # → exit=1, no test output, 17 green summaries
rm packages/core/src/__unformatted__.ts
```

## Second instance — 2026-09-03, and worse than the first

The first consequence was that `test` did not run for a session. The tests were
fine; the claim about them was unearned. This one is worse, because what got
hidden was a **fail-closed census** — the thing that exists to notice nobody is
looking.

`npm run validate` was run on this branch. It stopped at step **10 of 24**,
`check:corpus`, on three untracked proposals carrying stale pointers. Steps 11
through 24 did not execute, and nothing said so. Running them by hand:

| steps  | result                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11–14  | ledger · spec · numbers · vacuity — green                                                                                                             |
| 15     | `check:nonvacuity` — red, downstream of the same corpus state (see [0232](./fixed/0232-a-nonvacuity-fixture-blames-the-gate-for-a-dirty-baseline.md)) |
| 16–22  | typecheck · examples · docs-code · review-harness · lint · format:check · test — green                                                                |
| **23** | **`test:matrix` — RED, four published exports unclassified**                                                                                          |
| 24     | surface — green                                                                                                                                       |

Three of those four — `.:ArchConfigError`, `.:isArchConfigError`,
`.:variationBetween` — had been unclassified **since earlier on the same
branch**. The vacuity matrix asserts that every published export is classified,
which is precisely a "has anyone looked at this?" check, and it had been failing
silently for the length of the branch.

Two layers of invisibility stacked, and the record's own "Why it matters" section
predicted the first:

1. **The chain.** `test:matrix` is step 23 of 24. Anything red earlier hides it,
   and something was.
2. **The runner.** `test:matrix` uses its own vitest config
   (`vitest.matrix.config.ts`), so `npm run test` is green without ever loading
   it. `vacuity-classification.ts` already carried a comment about this from
   2026-08-24 — "a full local green said nothing about it" — written when
   `test:matrix` was not yet in `validate` at all. It has since joined, and the
   comment went stale while the hazard stayed.

That is the argument for the runner in the Fix below, sharpened: a chain that
cannot say _"stopped at step 10 of 24; 14 steps did not run"_ does not merely
overstate a green — it lets a census that exists to catch unlooked-at things go
unlooked at.

## Root cause

The chain has no denominator. Each step reports what **it** scanned — that
discipline is enforced everywhere below (`check:corpus` prints its document
count, `check:ledger` its readable-State count, `check:nonvacuity` its gate
count) — and the chain composing them reports nothing about itself. A step that
never ran leaves no trace at all, which is indistinguishable from a step that ran
and found nothing.

This is bug [0119](./fixed/0119-placement-check-never-ran.md)'s shape, one level
up: there, a check that had never examined a document printed `0 findings`; here,
a step that never executed prints nothing, and the run above it prints ✓.
[0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md) named the same
collision inside a single rule — "found nothing" and "could not look" must not
produce the same output. `validate` collides them at the chain level.

CLAUDE.md already tells agents the principle: _"If a count reads zero or far
lower than expected, the gate matched nothing — treat that as a red flag, not a
pass."_ The chain provides no count to read.

## Why it matters

`validate` is the command this repo tells contributors and agents to run before
proposing a commit. It is the one gate whose result gets **quoted** — into PR
descriptions, bug records, and commit messages — and a quoted result is only
worth what its weakest reader can verify. An agent scanning for ✓ has no signal
here, and neither did I.

The specific hazard is ordering: the slowest and most valuable steps are last.
`test`, `format:check`, `lint` and `typecheck` all sit behind fifteen gates, so
the steps most likely to be skipped by an early failure are the ones a reader is
most likely to assume ran.

## Fix

Give the chain the denominator every step already has. A small runner —
`scripts/validate.mjs` — that owns the step list, runs them in order, and ends
with one line:

```
✓ validate — 19 of 19 steps (2m 14s)
✗ validate — stopped at step 18 of 19: format:check (14 completed, 5 not run: …)
```

The failing step's own output still prints; what is added is the statement that
the run was partial and which steps never executed. That makes truncation
countable rather than invisible, and it is the same move `ledgerStats` made for
`check:ledger` — the fix that mattered there was not the region change, it was
the printed denominator.

Cheaper interim, if the runner is too much: append `&& echo "✓ validate — 19 of
19 steps"` to the chain. Its absence then means truncation. Weaker (it names
neither the failing step nor the skipped ones) but it is one line and it removes
the silent case.

Worth deciding alongside: whether `format:check` should sit ahead of `test` at
all. Ordering the chain cheapest-first is a real virtue — fast feedback — but it
puts the least consequential step in front of the most consequential one. A
runner that continues past a failing step and reports all failures at the end
would sidestep the question entirely; that is a bigger behavioural change and
should be argued on its own.

## Verification

- [ ] Red test written first: a fixture that makes an early step fail, asserting
      the output names the step and the count of steps not run. Silent today.
- [ ] `validate` on a clean tree ends with `19 of 19` and exits 0.
- [ ] The step count in the summary is derived from the step list, not written
      beside it — a hand-maintained denominator is the thing this record is about
      ([0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)'s
      lesson: the list and the claim must not be able to drift apart).
- [ ] `check:fast` gets the same treatment or is explicitly exempted. It is now
      a six-step chain of its own (`check:integrity` joined at the head on
      2026-09-03, per [0231](./fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)),
      so it truncates the same way.
- [ ] `npm run validate` green — and this time from a run that reached the last
      step, whatever its number is by then. **Not achievable today** for a
      reason worth stating: the chain stops at `check:corpus` on work-in-progress
      that is not this record's to fix, which is itself an argument for reporting
      truncation rather than requiring a clean run to notice it.

Deferred: none.
