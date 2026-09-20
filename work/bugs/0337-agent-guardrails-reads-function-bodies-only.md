# Bug 0337: agentGuardrails reads function bodies only

## Status

- **State:** Draft — measured by the method review of PR #149 and reproduced. The fix is the ruling
  [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) already made, applied to the
  sibling preset.
- **Severity:** High — **false green in a preset sold to agent-focused projects.**
  `agentGuardrails(p, { noInlineLogic: ['eval'] })` reports `eval` inside a function and nothing for
  a bare top-level `eval` or one in a class's static block. Measured on this branch's build:
  `["c"]`, `[]`, `[]`. That is bug 0333's symptom exactly, in the preset whose own documentation
  said to prefer it alone.
- **Origin:** the method review of PR #149, 2026-09-20, which asked why the ruling stopped at one
  preset.
- **Reported:** 2026-09-20

## Symptom

Measured, `agentGuardrails(p, { src: '**/src/**', noInlineLogic: ['eval'], report: 'return' })`.
**Every fixture holds a function**, so the preset has a subject and ADR-010's empty-selection
finding cannot fire — the first version of this table used fixtures with no function at all, where
the `[]` rows were accompanied by an error-severity vacuity finding, which is the opposite of a
silent pass. The delta review of PR #149 caught that; the conclusion survived it, the evidence did
not:

| the file holds                                         | reported |
| ------------------------------------------------------ | -------- |
| `export function c() { eval('x') }`                    | `["c"]`  |
| `eval('x')` at top level, beside an unrelated function | **`[]`** |
| `class S { static { eval('x') } }`, beside a function  | **`[]`** |

## Root cause

Every rule the preset builds is built over `functions()`, which is what 0333 fixed for
`recommended`. The rules that would read more — `moduleNoEval`, `moduleNoSilentCatch` and the
`modules()` builder — already exist; what is missing is the subject decision per rule, which 0333
made for its own SPECS table and did not generalise.

## Fix

Not decided, and the ruling is already written: each rule reads the broadest subject its condition
has a variant for, and exactly one, because the subject kinds nest. Applying it here needs three
answers this record does not presume:

- **Which of this preset's rules have a module variant at all.** `no-stubs`, `no-copy-paste` and
  `no-verdict-outside-rules` are about functions and their bodies by construction; `noInlineLogic`
  and `no-generic-errors` may not be.
- **What it costs this preset's adopters**, who carry baselines too: the same regeneration 0333's
  changeset describes.
- **Whether the two presets should then agree by construction** rather than by two tables that can
  drift — the overlap is documented in `packages/ts/src/presets/recommended.ts:161`, which now warns
  that they read different code.

## Related

- [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) — the same defect in
  `recommended`, fixed; its ruling is the one to apply here.
- [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — why a ruling that binds a
  second preset is hard to find when it lives in a fixed record.

## Verification

- [x] reproduced — the table above, on PR #149's build, with a function present in every
      fixture so that a vacuity finding cannot be mistaken for a report.
- [ ] a pin, asserting the control is reported so a preset gone dead cannot pass
- [ ] a ruling per rule on which subject it reads
- [ ] the fix, with a changeset for the adopters who carry baselines
- [ ] `npm run validate` green.

Deferred: none.
