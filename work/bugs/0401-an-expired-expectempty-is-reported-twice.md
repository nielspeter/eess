# Bug 0401: an expired `.expectEmpty()` is reported twice

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `9d18f0e`. No red test yet.
- **Severity:** Low — no verdict is wrong; the run is red either way. One cause produces two
  findings with two ids and two remedies, against the one-cause-one-finding rule this repo applies
  elsewhere (plan 0074's dedupe; ADR-016's "one per instrument-failure rather than per rule").
- **Origin:** self-found · enforcement review of bug 0400, 2026-10-07.
- **Reported:** 2026-10-07

## Symptom

A rule that runs through the kernel's terminal (kernel rules, eess-md, and the other kernel
dialects), declares `.expectEmpty()`, and then examines something, reports two findings for that
one cause: the rule's own ("this rule declared .expectEmpty() but examined N unit(s) — the
declaration has expired") and `emitter/expired-declaration` ("this verdict was declared empty but
examined N unit(s) — the declaration has expired").

Measured on two rules, an eess-md `links(c)…resolve().expectEmpty()` over one examined unit and a
kernel `correspondence(…).should().beComplete().expectEmpty()` over two (it counts both sides, bug
0400): `2 of 2 rules
failing · 4 violations`, one rule finding and one `emitter/expired-declaration` for each.

## Reproduction

```ts
import { correspondence } from '@nielspeter/eess'
const side = (label: string, names: string[]) => ({
  elements: names.map((name) => ({ name })),
  label,
  identify: (e: { name: string }) => ({ name: e.name }),
})
export default [
  correspondence({ left: side('l', ['x']), right: side('r', ['x']) })
    .should()
    .beComplete()
    .expectEmpty()
    .rule({ id: 'corr/expired' }),
]
```

`node packages/ts/dist/cli/bin.js check <file>` prints `corr/expired` and
`emitter/expired-declaration`.

## Root cause

Two layers each detect the expiry, and nothing tells the second that the first already did.

- The terminal reports it itself: `expiredExpectEmptyViolation` (`packages/core/src/terminal-builder.ts:295`).
- It also marks its receipt `declaredEmpty: true` whenever `.expectEmpty()` was declared, whatever
  it examined (`packages/core/src/terminal-builder.ts:279-282`), and reuses that receipt on the
  expiry return.
- The emitter's gate sees a declared-empty receipt with evidence and adds
  `emitter/expired-declaration` (`packages/core/src/report.ts:113-114`).

**eess-ts already fixed this in its own terminal.** `packages/ts/src/core/terminal-execution.ts:111-121`
returns the expiry with a receipt that carries no `declaredEmpty`, so the emitter adds nothing; its
comment says keeping both "double-reported one fault". This is the same defect, fixed in one terminal
and not the other (read from the code; no eess-ts rule was run).

The emitter finding is documented as "the mirror of the terminal's own
`expiredExpectEmptyViolation`, at the seam a preset's declaration reaches"
(`packages/core/src/emitter-findings.ts:218-219`): it was meant for declarations that never pass
through a terminal, and it also fires for ones that do.

## Fix

Likely the eess-ts shape: the kernel terminal's expiry return drops `declaredEmpty` from its
receipt, so the layer that reported the expiry owns it. One finding per expired declaration, in
every output format.

## Verification

- [ ] Red test written first: a terminal rule with an expired `.expectEmpty()` reports exactly one
      finding for it
- [ ] a preset's declaration that reaches only the emitter still reports
      `emitter/expired-declaration`
- [ ] `npm run validate` green.

Deferred: none.
