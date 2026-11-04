# Bug 0606: the terminal formats never print a rule id

## Status

- **State:** Fixed — both text formats print a violation's rule id (2026-11-04). Measured 2026-11-03
  on `main` at 1a2c1817.
- **Severity:** Medium — no false green. The id is what an author needs to act on a finding:
  `// eess-exclude <id>`, a preset's `overrides: { <id>: … }`, an ADR row citing it. (A baseline is
  keyed by `rule`, the description, not by the id: `packages/core/src/baseline.ts:18`.) On the default output an author has to guess it from the rule's description.
- **Origin:** inbound · a consuming project, 2026-11-03. It hand-prints `[ruleId ?? rule]` in five
  gates and found that moving them to `reportViolations` would drop the id from the terminal.
- **Reported:** 2026-11-03

## Symptom

For a violation `{ rule: 'long description', ruleId: 'records/placement', … }`:

| Formatter                | prints `rule`            | prints `ruleId`            |
| ------------------------ | ------------------------ | -------------------------- |
| `formatViolations`       | `Rule: long description` | no                         |
| `formatViolationsPlain`  | no                       | no                         |
| `formatViolationsJson`   | yes                      | yes (`ruleId`)             |
| `formatViolationsGitHub` | only without a `ruleId`  | yes (the annotation title) |

`formatViolations` is the terminal output of `reportViolations` (`packages/core/src/report.ts:228`),
which a builder's `.check()` prints through; of `finishPreset` (`packages/core/src/report.ts:316`);
and of `.warn()` (`executeWarn`, `packages/core/src/execute-rule.ts:400`). So it is the terminal
output of every dialect CLI. A finding whose `rule` is its own id (the `emitter/*` findings) shows
the id only because the two fields hold the same string.

The family has two hand printers of its own. `eess-ts check --fix` prints `v.ruleId ?? v.rule`
(`packages/ts/src/cli/commands/check.ts:450`); `eess-ts baseline` prints `rule` only
(`packages/ts/src/cli/commands/baseline.ts:125`).

## Root cause

`formatSingleViolation` renders `v.rule` alone (`packages/core/src/format.ts:26`), and
`formatViolationsPlain` renders `element: message (file:line)` with no rule at all
(`packages/core/src/format.ts:112`).

## Fix

The terminal format prints `Rule: <ruleId> — <rule>` when the id is set and differs from the
description (`namedRule`, `packages/core/src/format.ts`), so an `emitter/*` finding, whose
description is its id, prints it once. The plain format prefixes `[<ruleId>] ` to a violation's
line when it has an id. It is not quite the reporter's hand printer (`[ruleId ?? rule]`): a finding
that carries its id in `rule` and leaves `ruleId` unset, as eess-md's ledger findings do, gets no
prefix; that gap is [bug 0619](../0619-ledger-findings-carry-no-rule-id.md). Of the two hand
printers, `eess-ts check --fix` (`ruleId ?? rule`) is kept, and `eess-ts baseline` (the
description) is kept too: a first change to it had no test that could fail, so it was taken back
(the review). `docs/violation-reporting.md` showed the id as a header the terminal never printed;
it now shows the `Rule:` line.

## Verification

- [x] Red first: `formatViolations` and `formatViolationsPlain` print a violation's `ruleId`: `packages/core/tests/format-rule-id.test.ts` ·
      `it('the terminal format prints the id before the description')` and
      `it('the plain format prints the id')`, red on main.
- [x] A violation without a `ruleId` reads as before; one whose `rule` equals its `ruleId` prints it
      once: `it('a violation without an id reads as before')` and
      `it('a finding whose description is its id prints it once')`.
- [x] The `check --fix` and `baseline` hand printers are measured against the new output and each
      kept, changed or removed, said either way: see Fix.
- [x] A changeset naming `@nielspeter/eess`, and every dialect whose terminal output changes:
      `.changeset/the-text-formats-print-the-rule-id.md`, the kernel. eess-ts prints through the kernel's formatter and takes the dependency bump; none of its own code changes.
- [x] `npm run validate` green.

Deferred: none
