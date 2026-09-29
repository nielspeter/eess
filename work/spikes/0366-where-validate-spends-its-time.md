# Spike 0366: where `npm run validate` spends its time

Measured 2026-09-29, after a run of the chain was reported at 39 minutes and the figure
was used to argue the gate chain had become too expensive to run before a commit.

## The question

Is `npm run validate` slow enough to be a real tax on every commit, and if so, which
gate is responsible?

## Method

Each of the 24 steps in the `validate` chain run **separately**, wall-clock timed, on an
unchanged green tree — the same total work as one chained run, with a breakdown instead
of one number. Then one ordinary chained run, timed end to end, on the same tree, to
check the breakdown adds up. Node 24, macOS, warm cache, nothing else running.

## Result

| gate                 | wall       | share   |
| -------------------- | ---------- | ------- |
| **check:nonvacuity** | **359.0s** | **77%** |
| test                 | 44.2s      | 9%      |
| format:check         | 9.2s       | 2%      |
| lint                 | 8.4s       | 2%      |
| check:arch           | 7.7s       | 2%      |
| typecheck            | 5.0s       | 1%      |
| check:ledger         | 4.5s       | 1%      |
| build                | 4.3s       | 1%      |
| check:family         | 3.9s       | 1%      |
| check:corpus         | 3.8s       | 1%      |
| the other 14 gates   | 12.3s      | 3%      |

**Step-by-step total: 7.8 min. One chained run on the same tree: 7.8 min.** The two agree,
so the breakdown is the whole story and nothing is hiding in the chaining.

## Ruling — no action, and the premise was wrong

**The 39-minute figure that prompted this spike was a measurement artifact, not a
property of the repo.** That run reported `544.55s user · 29.36s system · 24% cpu ·
39:25.94 total`, and it had failed at `format:check`, so it never ran `test`,
`test:matrix` or `check:surface`. The run measured here does strictly more work in 7.8
minutes. Same CPU-seconds, five times the wall clock: the process was not progressing for
roughly 31 of those minutes. It had been started in the foreground and moved to the
background when its timeout expired, which is the probable cause — **probable, not
established**, because the second run's user time was not captured and the condition was
not reproduced deliberately.

**`check:nonvacuity` at 77% is the right shape, not a defect.** It plants deliberately
violating probe files and runs the real gates against each, so it pays a full ts-morph
program construction per fixture. That cost buys the one thing the rest of the chain
cannot establish about itself — that the other gates fail when they should. A chain whose
most expensive step is the one proving the cheap steps are not vacuous is spending its
time in the right place. Six minutes for that, inside an eight-minute chain, is not worth
optimising away, and `check:fast` already exists for the tight loop.

**What this spike is actually for** is stopping the next reader from optimising against
the wrong number. Nothing in the corpus carried the 39-minute figure — it was asserted in
conversation and is corrected here before it could be quoted.

## Method note

An estimate repeated from memory is not a measurement. The ~8 minute figure this project
had been assuming turned out to be right, and was briefly abandoned in favour of a single
anomalous reading that was never checked against a second one. One reading is an anecdote;
the disagreement between two is the finding.
