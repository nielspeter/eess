# Bug 0606: the terminal formats never print a rule id

## Status

- **State:** Draft — measured 2026-11-03 on `main` at 1a2c1817 against `packages/core/dist`; no red
  test yet.
- **Severity:** Medium — no false green. The id is what an author needs to act on a finding:
  `// eess-exclude <id>`, a baseline entry, a preset's `overrides: { <id>: … }`, an ADR row citing
  it. On the default output an author has to guess it from the rule's description.
- **Origin:** inbound · a consuming project, 2026-11-03. It hand-prints `[ruleId ?? rule]` in five
  gates and found that moving them to `reportViolations` would drop the id from the terminal.
- **Reported:** 2026-11-03

## Symptom

For a violation `{ rule: 'long description', ruleId: 'status-folder/bugs/placement', … }`:

| Formatter                | prints `rule`            | prints `ruleId`            |
| ------------------------ | ------------------------ | -------------------------- |
| `formatViolations`       | `Rule: long description` | no                         |
| `formatViolationsPlain`  | no                       | no                         |
| `formatViolationsJson`   | yes                      | yes (`ruleId`)             |
| `formatViolationsGitHub` | only without a `ruleId`  | yes (the annotation title) |

`formatViolations` is the terminal output of `reportViolations` and `finishPreset`
(`packages/core/src/report.ts:228`), of a builder's `.check()` (`packages/core/src/execute-rule.ts:400`),
and so of every dialect CLI. A finding whose `rule` is its own id (the `emitter/*` findings) shows
the id only because the two fields hold the same string.

The family works around it itself: `eess-ts check --fix` prints `v.ruleId ?? v.rule` by hand
(`packages/ts/src/cli/commands/check.ts:450`).

## Root cause

`formatSingleViolation` renders `v.rule` alone (`packages/core/src/format.ts:26`), and
`formatViolationsPlain` renders `element: message (file:line)` with no rule at all
(`packages/core/src/format.ts:112`).

## Fix

Not designed. The direction: when `ruleId` is set and differs from `rule`, both text formats print
it, the terminal as `Rule: <ruleId> — <rule>`. The fix decides the plain format's shape and keeps
an `emitter/*` finding from printing its id twice.

## Verification

- [ ] Red first: `formatViolations` and `formatViolationsPlain` print a violation's `ruleId`.
- [ ] A violation without a `ruleId` reads as before; one whose `rule` equals its `ruleId` prints it
      once.
- [ ] The `check --fix` hand printer is measured against the new output and kept or removed, said
      either way.
- [ ] A changeset naming `@nielspeter/eess`, and every dialect whose terminal output changes.
- [ ] `npm run validate` green.

Deferred: none
