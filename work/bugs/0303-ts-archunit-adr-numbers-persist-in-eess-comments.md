# Bug 0303: ts-archunit's ADR numbers persist in eess comments, and one gate message

## Status

- **State:** Draft — measured by grep and classified by reading each site in
  context; no mechanism.
- **Severity:** Low — comment drift, with one exception that prints:
  `scripts/check-review-harness.mjs:173` tells a reader "the ADR-008/009 lens is
  required".
- **Origin:** self-found · correcting one such comment for
  [0233](./0233-an-exclusion-that-suppresses-every-violation-is-silent.md). Known and
  unrecorded before that: `.claude/skills/review/SKILL.md:72-75` notes the same
  off-by-one "still sits in three persona files and one gate message".
- **Reported:** 2026-09-14

## Symptom

eess ported two ADRs from ts-archunit under new numbers. ts-archunit's ADR-008
(agent-first failure surfaces) is eess's
[ADR-009](../../adr/009-agent-first-failure-surfaces.md); its ADR-009 (a pass is
constructed from evidence) is eess's [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md).
eess's own [ADR-008](../../adr/008-caller-owns-reporting.md) is caller-owns-reporting.

`grep -rn 'ADR-008' packages/*/src scripts .claude` returns **67** lines. Read in
context:

- **35** use ts-archunit's numbering — they cite ADR-008 for a false green, a vacuous
  pass, a remedy that must be real, "rule 5", or the agent that does not read warnings;
- **26** mean eess's ADR-008 — reporting, emission, `report` modes;
- **6** are ambiguous without a closer reading.

The classification is a reading, not a mechanism.

### The 35

- `packages/core/src/correspondence-core.ts:12`, `packages/core/src/diff-disclosure.ts:7`,
  `packages/core/src/diff-aware.ts:39`, `packages/core/src/comment-suppression.ts:14`,
  `packages/core/src/violation.ts:297`
- `packages/ts/src/core/element-cache.ts:28`, `packages/ts/src/core/element-cache.ts:44`,
  `packages/ts/src/core/module-edges.ts:257`, `packages/ts/src/core/terminal-builder.ts:160`,
  `packages/ts/src/core/terminal-builder.ts:214`, `packages/ts/src/core/terminal-builder.ts:241`,
  `packages/ts/src/core/rule-declaration.ts:32`, `packages/ts/src/core/rule-builder.ts:255`,
  `packages/ts/src/core/execute-rule.ts:166`, `packages/ts/src/core/diagnose.ts:167`
- `packages/ts/src/builders/correspondence-builder.ts:114`,
  `packages/ts/src/builders/correspondence-builder.ts:388`,
  `packages/ts/src/builders/slice-rule-builder.ts:39`,
  `packages/ts/src/builders/slice-rule-builder.ts:367`,
  `packages/ts/src/builders/slice-rule-builder.ts:386`,
  `packages/ts/src/builders/correspondence-findings.ts:311`,
  `packages/ts/src/builders/slice-discovery-message.ts:45`
- `packages/ts/src/models/slice.ts:177`, `packages/ts/src/cli/index.ts:284`,
  `packages/ts/src/graphql/resolver-rule-builder.ts:176`,
  `packages/ts/src/conditions/cross-layer.ts:25`, `packages/ts/src/conditions/cross-layer.ts:187`,
  `packages/ts/src/presets/boundaries.ts:201`, `packages/ts/src/presets/shared.ts:110`,
  `packages/ts/src/helpers/baseline.ts:717`
- `scripts/check-review-harness.mjs:17`, `scripts/check-review-harness.mjs:173`
- `.claude/agents/reviewer-enforcement.md:8`, `.claude/agents/reviewer-testing.md:26`,
  `.claude/skills/review/SKILL.md:39`

### The 6 ambiguous

`packages/core/src/violation.ts:129`, `packages/md/src/index.ts:34`,
`packages/ts/src/core/glob-diagnosis.ts:18`, `packages/ts/src/core/empty-project-advice.ts:35`,
`packages/ts/src/helpers/baseline-diagnostics.ts:123`, `packages/ts/src/presets/shared.ts:174`

### Not measured

- `ADR-009` mentions that mean eess's ADR-010.
- Plan numbers carried the same way. `packages/ts/src/core/execute-rule.ts:153`,
  `:159` and `:219` cite "plan 0104", and no plan 0104 exists in `work/` — the only
  0104 is a bug. Likely the same carry-over; not verified.

## Fix

One sweep that reads each site, not a find-and-replace — 26 of the 67 are correct.
A guard is possible for the unambiguous shapes (`ADR-008/009`, `ADR-008 rule N`,
since eess's ADR-008 has no numbered rules) and not for the rest. One site was
already fixed in the change that filed this: `packages/ts/src/core/execute-rule.ts:228`.

## Verification

- [ ] the 35 corrected, and the 6 read and dispositioned
- [ ] the gate message at `scripts/check-review-harness.mjs:173` corrected
- [ ] a decision on a guard for the unambiguous shapes
- [ ] `npm run validate` green.

Deferred: none.
