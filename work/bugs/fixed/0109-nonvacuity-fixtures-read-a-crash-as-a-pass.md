# Bug 0109: the non-vacuity harness reads a crashed fixture as a detected violation — the meta-gate has the defect it exists to catch

## Status

- **State:** Fixed — sentinel required at the harness, both catch-alls typed,
  three weak assertions strengthened, and a self-check that proves the harness.
- **Severity:** High — **false green**, in the one gate whose entire job is
  proving the others cannot go falsely green.
- **Origin:** self-found · while fixing [0107](./fixed/0107-number-allocation-scans-one-lane.md),
  whose own red test caught this class in itself on its first run
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-12 (PR #40)

## Symptom

`gateNode` (`scripts/check-nonvacuity.mjs:151`) asserts an exit code and nothing
else:

```js
function gateNode(script, ruleNote) {
  const r = sh(process.execPath, [join('scripts', 'nonvacuity', script)])
  return { ok: r.code === 1, detail: `exit ${r.code} (${ruleNote})` }
}
```

Its comment states the contract it relies on — _"The fixture scripts exit 1 only
on the intended violation (2 = unexpected error, 0 = vacuous)"_ — and that
contract does not hold. Node exits `1` on an unhandled throw, a syntax error,
and a failed module resolution, none of which are the intended violation. Five
gates run through `gateNode`: `crossval`, `crossval/gherkin-ts`, `corpus/adr`,
`corpus/links`, `corpus/pointers`.

## Reproduction

**1 — A catch-all that reports any error as the expected one.**
`scripts/nonvacuity/bad-crossval.mjs:23` catches every error and exits 1. Run it
where its fixture diagram is unreachable:

```
bad-crossval: drift detected as expected — MermaidUnit parse failed:
exit 1        ← the harness prints "OK (fails on violating input)"
```

A **parse failure** announced itself as the intended drift. The comment directly
above that catch asserts `ArchRuleError from the correspondence check` without
ever checking the error's type. `scripts/nonvacuity/bad-gherkin-ts.mjs:25` has
the identical shape. Delete or rename either fixture's input and its gate stays
green forever while proving nothing.

**2 — A failed import, which no `try`/`catch` in the fixture can intercept.**
A top-level `import` is resolved before the module body runs, so even the
well-structured fixtures never reach their own error handling:

```
bad-links.mjs with an unresolvable import → exit 1
```

`bad-links.mjs`, `bad-adr.mjs` and `bad-pointers.mjs` are correctly built — they
exit 2 on a load error and 1 only on a real violation, and all three honestly
report themselves vacuous when their inputs are unreachable. The import mode
defeats them anyway, because it precedes their first statement.

Every fixture importing a workspace package (`bad-crossval`, `bad-gherkin-ts`,
`bad-adr`, `bad-links`, `bad-pointers`) is affected. `npm run validate` builds
first, so CI is not currently lying; `npm run check:nonvacuity` alone on a fresh
clone reports all gates healthy while five of them never executed.

## Root cause

An exit code is a one-bit channel carrying two different meanings — "I ran and
found what I was looking for" and "I died" — and the harness reads only that
bit. Every gate that adds a second signal is sound; every gate that does not is
not:

| Gate                     | Assertion beyond `exit 1`                                       | Sound  |
| ------------------------ | --------------------------------------------------------------- | ------ |
| `spec`                   | `--format json`, requires ruleId `spec/nonvacuity-probe`        | yes    |
| `internal arch`          | probe filename **and** the phrase `silent catch`                | yes    |
| `review-harness`         | child exit 1 **and** `/foreign-project token/`; cwd-independent | yes    |
| `arch`                   | probe filename only — never the rule                            | weak   |
| `baseline`               | probe filename only — never the rule                            | weak   |
| `diagram`                | `/violation/i` anywhere in the output                           | weak   |
| the five `gateNode` ones | nothing                                                         | **no** |

`gateInternalArch` shows the author already knew: its comment says _"Exit 1
alone is weak here (in-flight violations exist), so require the probe itself to
be named AND the silent-catch rule to have fired on it."_ The stronger assertion
was applied where a known confound forced it, and not generalised.

`gateDiagram`'s `/violation/i` is weak in a second way: it never checks that
`diagram/kernel-stereotype` fired, though its `detail` string claims so. Any
future rule failing in that fixture would keep it green.

## Why it matters

This is the cardinal sin from [BUGS.md](./BUGS.md)'s severity scale — a check
that passes while the drift it exists to catch is present — located in the gate
that exists to prove the other gates cannot do that. Everything downstream of it
inherits its confidence: the harness prints _"all gates fail on violating input
— no gate is vacuous"_, which is the sentence the whole dogfood chain rests on.

It is not hypothetical. Bug 0107's red test hit this exact class **on its first
run**, reporting `duplicate detected as expected` from a `MODULE_NOT_FOUND`. The
fixture was written correctly by the same convention the five older ones use,
and was wrong for the same reason.

## Fix

**1 — Require the fixture's own sentinel, not just its exit code.** Every
fixture already prints `bad-<name>: …`; `gateNode` should require that prefix in
the output before believing the exit code. One change, covering all five. This
is what `bad-numbers.mjs` already does with the checker's `next-number:`
sentinel.

**2 — Stop the two catch-alls printing that sentinel from the wrong place.** The
sentinel alone will not save `bad-crossval`/`bad-gherkin-ts`, because they print
it _from_ the bad catch. Both must distinguish the intended failure by type:

```js
import { ArchRuleError } from '@nielspeter/eess'
…
} catch (err) {
  if (!(err instanceof ArchRuleError)) {
    console.error(`bad-crossval: unexpected error (not ArchRuleError) — ${err.message}`)
    process.exit(2)
  }
  …
  process.exit(1)
}
```

**3 — Name the rule where a gate only names a file.** `gateDiagram` should
assert `diagram/kernel-stereotype` via `--format json`, exactly as `gateSpec`
already asserts `spec/nonvacuity-probe`. `gateArch` and `gateBaseline` should
require their rule id alongside the probe filename.

**4 — Prove the harness itself.** A self-check that runs a deliberately-crashing
stub through `gateNode` and asserts it is **rejected**. Without it, this defect
can return the moment someone simplifies the sentinel check — the harness proves
every gate but itself.

No changeset — `scripts/` is not a published package.

## Two more defects the hardening surfaced

Strengthening the assertions immediately turned two previously-green gates red,
which is the point of the exercise:

- **`baseline` was asserting a rule id that never appears.** `check-baseline.mjs`
  renders terminal format, which prints a rule's _description_
  (`should not contain call to 'eval'`), not its id. The gate now asserts the
  description's own phrase. Had it been written against `no-eval` originally it
  would have been permanently red; written against the filename alone it was
  permanently weak.
- **`bad-review-harness.mjs` printed nothing at all** — it reported purely
  through its exit code, so it was sound internally (it checks the child's
  output for `foreign-project token`) but impossible to distinguish from a
  crash. It now prints the house sentinel on both paths.

## Verification

- [x] Red test written first: a crashing stub (unresolvable import → exit 1, no
      sentinel) run through `gateNode` must be **rejected**. It is now a
      permanent gate, `harness self-check`, and it is genuinely red without the
      fix — reverting the sentinel line to `const spoke = true` produces
      `FAILED · ACCEPTED a crashing stub — the sentinel check is broken`.
- [x] `bad-crossval` and `bad-gherkin-ts` exit **2**, not 1, when their input is
      unreachable. The original reproduction now reads
      `bad-crossval: unexpected error (not ArchRuleError) — MermaidUnit parse failed:`
      instead of `drift detected as expected`.
- [x] Both still exit 1 on their real, intended violation — `crossval` and
      `crossval/gherkin-ts` remain OK in the harness.
- [x] `gateDiagram` asserts `diagram/kernel-stereotype` via `--format json`;
      `gateArch` asserts `eess/adr002-no-raw-typescript`; `gateBaseline` asserts
      the eval rule's description.
- [x] `npm run check:nonvacuity` reports **13 gates**, all failing on violating
      input — the hardening turned no sound gate red once the two defects above
      were fixed.
- [x] `npm run validate` green.

Deferred: none.
