# Bug 0401: an expired `.expectEmpty()` is reported twice

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `9d18f0e`. No red test yet.
- **Severity:** Low — no verdict is wrong; the run is red either way. One cause produces two
  findings with two ids and two remedies, against ADR-009 rule 4 ("identities, never totals").
- **Origin:** self-found · enforcement review of bug 0400, 2026-10-07.
- **Reported:** 2026-10-07

## Symptom

Any rule that declares `.expectEmpty()` and then examines something reports two findings for that
one cause: the rule's own ("this rule declared .expectEmpty() but examined N unit(s) — the
declaration has expired") and `emitter/expired-declaration` ("this verdict was declared empty but
examined N unit(s) — the declaration has expired").

Measured on two rules, an eess-md `links(c)…resolve().expectEmpty()` and a kernel
`correspondence(…).should().beComplete().expectEmpty()`, each over one examined unit: `2 of 2 rules
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
  it examined (`packages/core/src/terminal-builder.ts:279-281`).
- The emitter's gate sees a declared-empty receipt with evidence and adds
  `emitter/expired-declaration` (`packages/core/src/report.ts:114`).

The emitter finding is documented as "the mirror of the terminal's own
`expiredExpectEmptyViolation`, at the seam a preset's declaration reaches"
(`packages/core/src/emitter-findings.ts:218-219`): it was meant for declarations that never pass
through a terminal, and it also fires for ones that do.

## Fix

Not designed. One finding per expired declaration, from whichever layer owns the declaration, in
every output format.

## Verification

- [ ] Red test written first: a terminal rule with an expired `.expectEmpty()` reports exactly one
      finding for it
- [ ] a preset's declaration that reaches only the emitter still reports
      `emitter/expired-declaration`
- [ ] `npm run validate` green.

Deferred: none.
