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

## Residue — NOT fixed

`check:integrity` is not in `check:fast`:

```
check:fast = check:release && check:corpus && check:spec && check:arch && check:family
```

So the fast loop — the one an agent actually runs, and the one where this bug
was felt — still reports the phantom `check:arch` violation and never reaches
the gate that can explain it. `npm run validate` and any direct
`npm run check:integrity` do.

Measured: `check:integrity` costs **0.17s** against `check:fast`'s 2.1s. Adding
it, first in the chain so the leftover is named before `check:arch` reports the
symptom, is a one-line change to `package.json`. It is left undone because
widening what "fast" means is a decision about that loop's contract, not a
consequence of this bug.

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
  puts knowledge of the test harness inside a production gate.

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
- [ ] `deferred→` the Residue section — `check:integrity` in `check:fast` is a
      decision about that loop's contract, priced at 0.17s and left to the
      maintainer.

Deferred: the Residue section (one line in `package.json`, priced, not taken).
