# Bug 0231: a killed non-vacuity run leaves an invisible probe that reds other gates

## Status

- **State:** Fixed — the pair landed: a `check:integrity` row that names a
  leftover for what it is, and the scenario-6 tightening that stops it
  answering for the raw-NUL guard. One residue is stated below and NOT fixed.
- **Severity:** Medium — nothing is missed and nothing is silently green. The
  cost is misattribution: two gates go red for a file that `git status` cannot
  see, neither of them the gate that created it, and the natural reading is
  "my last change broke this". Measured cost in the session that found it: the
  failure was first attributed to an unrelated branch rewrite.
- **Origin:** self-found · a `check:nonvacuity` run hit a 10-minute command
  timeout mid-scenario; the next `check:arch` and `check:guardrails` reported a
  violation in a file no commit contains.
- **Reported:** 2026-09-03

## Symptom

`scripts/nonvacuity/bad-waived-gates.mjs` plants real source files under
`packages/*/src/**` — it has to, because that is the population the gates it
probes declare. One of them:

```ts
// packages/core/src/__nonvacuity_probe_generic_error__.ts
export function probeThatThrows(): never {
  throw new Error('a bare Error the guardrails preset must object to')
}
```

Killed mid-scenario, that file stays. Then:

```
$ git status --short
(nothing)

$ npm run check:arch
✗ eess-ts — 1 of 25 rules failing

$ npm run check:guardrails
  probeThatThrows contains new 'Error' at line 2
  packages/core/src/__nonvacuity_probe_generic_error__.ts:1 — probeThatThrows
  Why: a generic Error loses the type/context callers need to handle it
  Fix: throw a domain-specific error (NotFoundError, ValidationError, …)
```

The violation is well-formed and points at a real file. It is also entirely
phantom, and the `Fix:` line tells you to edit a test artifact.

## Repro

```bash
PROBE=packages/core/src/__nonvacuity_probe_generic_error__.ts
node scripts/nonvacuity/bad-waived-gates.mjs guardrails/generic-error & PID=$!
until [ -f "$PROBE" ]; do sleep 0.2; done
kill -KILL $PID
ls $PROBE            # still there
git status --short   # empty
npm run check:arch   # FAIL
```

## Root cause

Three layers of cleanup, and `SIGKILL` defeats all three. Measured, each
separately:

| mechanism                                                 | signal      | outcome                 |
| --------------------------------------------------------- | ----------- | ----------------------- |
| `finally` in `withAddedFile` (`bad-waived-gates.mjs:138`) | SIGTERM     | cleaned                 |
| `SIGINT`/`SIGTERM`/`SIGHUP` handlers (`:87`)              | SIGTERM     | cleaned                 |
| parent killed, child left in `spawnSync`                  | SIGTERM     | cleaned (child runs on) |
| —                                                         | **SIGKILL** | **leftover**            |

The fourth row is not a defect on its own: nothing survives `SIGKILL`, and the
design already knows it. Two things make it cost more than it should:

1. **`.gitignore:27` — `**/\_\_nonvacuity_probe\*`.** The entry exists so a probe
cannot be committed by accident, which is right. Its side effect is that a
surviving probe is invisible in the one place anybody looks for "what
changed": `git status` reports a clean tree.

2. **The startup sweep recovers it, but only on the slowest path.**
   `sweepProbes()` runs at module load in `bad-waived-gates.mjs:107`, so the
   next run of that fixture clears it — measured, it does. But that fixture is
   reached only through `check:nonvacuity`, which takes over ten minutes.
   Every other gate stays red until then, and `check:fast` — the loop an agent
   actually runs — never sweeps.

So the recovery path is real and correct, and is gated behind the one command
nobody runs when a fast gate has just gone red.

### Measured blast radius

With the leftover present:

| gate               | result |
| ------------------ | ------ |
| `check:arch`       | FAIL   |
| `check:guardrails` | FAIL   |
| `check:baseline`   | pass   |
| `check:integrity`  | pass   |

## A stale claim in the harness's own docstring

`scripts/check-nonvacuity.mjs:135` reads:

> `bad-waived-gates.mjs` plants its own probes and has the finally but NOT the
> startup sweep, so a SIGKILL mid-scenario leaves a file behind.

The first half is wrong: it **does** have a startup sweep, at
`scripts/nonvacuity/bad-waived-gates.mjs:107`. The conclusion still holds for a
different reason — the sweep is on the wrong side of a ten-minute gate — but
the stated cause is not the real one. Correcting it is part of this fix.

## Fix — as built

Both halves, in this order, because the second cannot be verified after the
first: with the new rule in place `check:integrity` reds on scenario 6's probe
for two reasons at once, so the tightening had to be proven while only the NUL
reason existed.

**1. Scenario 6 asserts the reason** (`bad-waived-gates.mjs`). It read
`out.includes(probeName) && status !== 0`. It now also requires
`` `${NUL_PROBE} contains` `` and `'raw NUL byte(s) (first at line'`.

The first attempt at this asserted `'raw NUL byte'` alone, **and that was
wrong** — the success summary ends "…free of raw NUL bytes", so the phrase is
satisfied by the line that says the gate found nothing. Measured while writing
it: with the guard sabotaged, that variable still read true. The assertion is
now a phrase that occurs only in the finding. This is the same defect the
scenario itself is about, committed in the fix for it.

**2. `check:integrity` names a leftover** (`check-workspace-integrity.mjs`).
Matching is by basename prefix — the same shape as the `.gitignore` rule — over
`packages/*/src`, `docs`, `work`, `examples` and `scripts/nonvacuity`, so a
probe planted somewhere new is caught without editing a list. The finding:

```
✗ leftover non-vacuity probe: packages/core/src/__nonvacuity_probe_generic_error__.ts
  — a fixture under scripts/nonvacuity/ was killed before its cleanup ran.
  Delete the file. It is gitignored (`**/__nonvacuity_probe*`), so `git status`
  will not show it, and until it is gone other gates will report it as a defect
  in your own code
```

Per the one-row-per-CHECK doctrine under `GATE_FOR`, the new check gets its own
fixture (`integrity/leftover-probe`), its own row, and its own `GATE_FOR` entry.
Its probe is deliberately innocuous — no NUL, no bare `Error`, no import — so
the fixture cannot pass on some other check firing first. The OK summary gained
its denominator: `N probe roots free of leftover fixtures`.

Also corrected: `check-nonvacuity.mjs`'s docstring, which claimed the fixture
has no startup sweep. It has one.

## 3. `check:integrity` joins `check:fast`, first in the chain

Filed initially as a residue and left to the maintainer, then taken. Without it
the fix reached `validate` but not the loop where the bug was actually felt: the
fast chain would still report the phantom `check:arch` violation and never reach
the gate that can explain it.

```
check:fast = check:integrity && check:release && check:corpus
          && check:spec && check:arch && check:family
```

**First, not appended.** The chain is `&&`, so leading with the gate that can
NAME a leftover means the run stops at the explanation instead of continuing to
the symptom. Demonstrated end-to-end with a probe planted:

```
$ git status --short
(nothing)

$ npm run check:fast
Workspace integrity: 1 problem(s)
  ✗ leftover non-vacuity probe: packages/core/src/__nonvacuity_probe_leftover_demo__.ts
    — a fixture under scripts/nonvacuity/ was killed before its cleanup ran. …
```

The demo probe was not on `bad-waived-gates.mjs`'s `PROBE_PATHS`, which is the
point: matching is by basename prefix, so a probe planted somewhere the list
never predicted is still caught.

Measured cost: `check:fast` went from 2.11s to 2.13s — inside the noise, because
`check:integrity` is 0.17s of work that overlaps the npm startup already paid.

Three descriptions of `check:fast` were stale BEFORE this change and are
corrected with it — they all still said "corpus + spec + arch", omitting
`check:release` and `check:family`, which joined earlier:

| where                                  | was                                        |
| -------------------------------------- | ------------------------------------------ |
| `CLAUDE.md`                            | "just the spec and architecture gates"     |
| `docs/agent-integration.md`            | "(spec + corpus + arch, skipping build …)" |
| `check-nonvacuity.mjs`'s waiver reason | "an alias — runs corpus + spec + arch"     |

The last of those is one of [bug 0133](../0133-nothing-requires-a-check-to-join-the-chain.md)'s
open verification boxes — "`check:fast`'s waiver reason describes a subset chain,
not an alias" — which this change satisfies. 0133's own fix (a separate
chain-membership waiver map) is untouched and still owed.

## 4. The message must not assert a cause it cannot know

Found by measurement, in this fix, after it was written.

The first version of the finding read _"a fixture under scripts/nonvacuity/ was
killed before its cleanup ran. Delete the file."_ That is one of two
possibilities, and the check cannot tell them apart: a probe is also present,
legitimately, for the seconds a `check:nonvacuity` run has it planted.

It happened immediately. A gate sweep run while a background `check:nonvacuity`
was in flight reported `check:integrity FAIL` — and the remedy said to delete a
file the running harness needed. Following it would have sabotaged the run.

Adding `check:integrity` to `check:fast` widens that window from "whatever rule
the probe happens to trip" to "deterministically, every time", so the message
has to be honest about both branches. It now is:

```
✗ non-vacuity probe present: <path> — a fixture under scripts/nonvacuity/ plants
  this file and removes it again. Either a `check:nonvacuity` run is IN FLIGHT,
  in which case wait for it and do NOT delete the file (the run needs it) — or
  one was killed before its cleanup ran, in which case delete it. …
```

This race is not new and not introduced here — [bug 0140](../0140-nonvacuity-corpus-probes-residual-gaps.md)
records the same class for `check:fast` against `check:corpus`'s probes, where a
racing run "can observe a probe". What is new is that the observation now has a
name and both readings, instead of arriving as a violation in someone's own code.

A sweep instead of a report would have been actively wrong here: it would delete
the file a live run depends on, and turn a failing run into one that silently
succeeds next time.

## Superseded analysis

The original filing recommended this pair and noted the fixture interaction. It
also listed two cheaper options — un-ignoring the probe names, and sweeping in
`check:fast`. Neither was taken. The un-ignore trades invisibility for the risk
the ignore exists to prevent; the sweep would put test-harness knowledge inside
a production gate, where this fix instead puts a finding that explains itself.

The reasoning behind the original recommendation, kept because it is what a
later reader needs to judge the choice:

The obvious fix is a `check:integrity` row: it is already the workspace-hygiene
gate, it is fast, and it would name the leftover with a remedy instead of
letting an unrelated rule report a phantom violation. That is the repo's own
standard (ADR-009 rule 2).

**It is not a one-liner, and the reason is worth stating before anyone starts.**
Scenario 6 in `bad-waived-gates.mjs:329` plants `__nonvacuity_probe_nul__.ts`
and runs `check:integrity`, asserting only:

```js
if (!nul.out.includes('__nonvacuity_probe_nul__') || nul.status === 0) { … }
```

— that the output NAMES the probe and the exit is non-zero. Not that the reason
was the raw NUL bytes. Add a "no leftover probe" rule to `check:integrity` and
that fixture goes green on the new rule instead of the one it exists to prove:
a fail-open inside the non-vacuity harness. Tightening it to assert the NUL
reason is correct independently — it is bug 0110's own lesson, "assert the
identifier, not just the exit code" — so this is two changes that must land
together.

Two cheaper options, both real:

- **Un-ignore the probe names.** One line, no gate touched, no fixture
  interaction; a leftover appears in `git status` where anyone would see it.
  The cost is the risk the ignore was added to prevent — a `git add -A`
  sweeping one into a commit. That risk is not hypothetical: it happened in
  this repo on 2026-09-02 with three untracked proposals, and the rewrite to
  undo it was five commits deep.
- **Sweep in `check:fast`.** Cheap and it covers the loop that matters, but it
  puts knowledge of the test harness inside a production gate. Not taken —
  though `check:fast` did gain `check:integrity` (§3), which is the same reach
  without the same coupling: the gate REPORTS the leftover, it does not delete
  it. A sweep would make a failing run silently succeed on the next one, which
  is the wrong direction for a fail-closed instrument.

Recommended: the `check:integrity` row plus the scenario-6 tightening, since it
is the only option that turns the symptom into a finding that says what is
wrong and what to do. The un-ignore is a reasonable complement, not a
substitute.

## Break class

A fix must fail when:

1. A `__nonvacuity_probe*` file exists in the tree outside a run that planted
   it, and a fast gate is invoked.
2. And scenario 6 must still red for the RIGHT reason — the raw NUL bytes —
   not merely because `check:integrity` exited non-zero naming the probe.
   Sabotaging the NUL guard alone must red it.

## Verification

- [x] Red test: `integrity/leftover-probe` was written before the check existed
      and failed with "never named the leftover probe and never gave the
      leftover reason". Green after.
- [x] Scenario 6 asserts the NUL reason specifically, and reds when the NUL
      guard alone is sabotaged — verified by replacing `buf.indexOf(0)` with
      `-1` and watching it report vacuity.
- [x] `check-nonvacuity.mjs`'s docstring corrected.
- [x] Sabotage: neutering the basename test in the new rule reds
      `integrity/leftover-probe`.
- [x] End-to-end: SIGKILL the `guardrails/generic-error` fixture mid-run, then
      `check:integrity` names the survivor with the remedy above, while
      `git status` still shows a clean tree.
- [x] `check:integrity` leads `check:fast`, so the loop where this was felt
      names the leftover instead of reporting the symptom. Demonstrated with a
      probe whose name was NOT on any list, proving the prefix match.
- [x] The three stale `check:fast` descriptions corrected.
- [x] The finding names both causes — a run in flight and a killed fixture —
      after the first wording told a reader to delete a file a live harness
      needed. Caught by a gate sweep racing a background run.

Deferred: none.
