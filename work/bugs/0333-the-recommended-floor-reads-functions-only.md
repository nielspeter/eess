# Bug 0333: the recommended floor reads functions only

## Status

- **State:** Draft — measured on PR #148's build and pinned by a KNOWN-GAP test. The fix is not
  decided.
- **Severity:** High — **false green on the floor every adopter installs.** `recommended` builds
  every rule it ships with `functions(p, …)`, so `eval` in a class's static block or in a callback
  handed to a call at module level passes it, while `noEval()` on `classes()` and `moduleNoEval()`
  on `modules()` — rules this package already ships — read both. The preset's own name for the rule
  is `no-eval`, and an adopter reading that reasonably believes it means no eval.
- **Origin:** self-found · [0321](./fixed/0321-function-positions-no-function-rule-reads.md) ruled
  that those positions belong to the class and module rules rather than to the function collection,
  which leaves the floor not running them.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #148's build, `recommended(p, { report: 'return' })`, findings under
`preset/recommended/no-eval`:

| file                                              | findings |
| ------------------------------------------------- | -------- |
| `export function reads() { eval('1') }` (control) | 1        |
| `export class S { static { eval('1') } }`         | **0**    |
| `app.get('/', () => eval('1'))` at module level   | **0**    |

The same two positions are reported by `classes().should().satisfy(noEval())` and
`modules().should().satisfy(moduleNoEval())`.

## Root cause

`packages/ts/src/presets/recommended.ts:152` builds each spec with
`functions(p, { includeObjectLiteralFunctions: true })`. There is one collection and one subject
kind, so a condition that exists for classes or modules is never constructed. The four floor rules
are `no-eval`, `no-function-constructor`, `no-silent-catch` and `no-empty-bodies`; the first has a
class twin and a module twin, the second has a class twin, and the last two are function-shaped by
nature.

## Fix

Not decided. The shape of it is a preset that builds more than one subject kind, which raises three
questions worth answering together:

- **Which rules gain a twin.** `no-eval` has both; `no-function-constructor` has a class twin only.
  A rule with no twin must not look as though it gained one.
- **What a finding reports under.** A class-rule finding under `preset/recommended/no-eval` shares
  the id with the function rule's, which is what the preset's fan-out already does (one id, several
  builders) — so the question is whether an adopter's baseline and `excluding()` patterns survive
  the extra subjects, which they will not silently.
- **What it costs.** Three more rules over the same files is measurable; the floor gate is on the
  critical path of `check:baseline`.

## Related

- [0321](./fixed/0321-function-positions-no-function-rule-reads.md) — the ruling that leaves this
  open, with the measured table of which position each rule kind reads.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/presets/the-floor-reads-functions-only.test.ts` ·
      `it('KNOWN GAP — eval in a static block or a module-level callback passes the floor')`, which
      asserts the control is reported, so a floor gone dead could not pass it.
- [ ] a ruling on which subject kinds the floor runs
- [ ] the fix, with the KNOWN-GAP test inverted
- [ ] a changeset — the floor reporting more is a breaking change for an adopter's baseline
- [ ] `npm run validate` green.

Deferred: none.
