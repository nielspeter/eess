# Bug 0577: a preset under `report: 'warn'` exits 0 on a configuration finding

## Status

- **State:** Draft — reproduced 2026-11-01 on [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  branch; no red test yet.
- **Severity:** High — a false green: a finding that the rule's own text calls unsuppressable,
  such as an unmet `expectNonEmpty`, is printed and the run passes.
- **Origin:** self-found · [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  architect review, which found it by reading; reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

A builder's `.warn()` throws for every finding that carries `bypassFilters`
(`packages/core/src/execute-rule.ts:404`: "a config finding whose own text promises 'not by
.warn()' must still fail the build"). A preset's `report: 'warn'` goes through `finishPreset`,
which throws under warn only for the emitter's own five findings (`EMITTER_IDS`,
`packages/core/src/emitter-findings.ts:115`). Every other `bypassFilters` finding is printed and
the preset returns. The §5 comment in `finishPreset` (`packages/core/src/report.ts:319`) says
"an unsuppressable configuration finding printed above a zero exit is exactly the silent green
this ADR closes"; the code beneath it closes that case for the emitter's findings only.

## Reproduction

`adrCitationsResolve` over an ADR corpus whose `dir` matches nothing, with
`{ expectNonEmpty: true, report: 'warn' }`, on the fixtures in
`packages/crossvalidate/tests/fixtures/citations`: the finding is printed once to stderr and
nothing is thrown. The same options with `report: 'return'` hand back the
`crossval/adr-citations-resolve` finding, so the finding exists; only the warn path lets it pass.
The defect is in `finishPreset`, so it applies to every preset in the family.

## Fix

Not designed. The direction: under `report: 'warn'`, `finishPreset` fails on every finding
`severityFor(v, 'warn')` escalates, exactly as `executeWarn` does, so the two warn paths cannot
disagree.

## Verification

- [ ] Red test written first: a preset with an unmet `expectNonEmpty` under `report: 'warn'` throws.
- [ ] An ordinary finding under `report: 'warn'` still prints without throwing.
- [ ] The two warn paths share one escalation rule.
- [ ] A changeset naming `@nielspeter/eess`.
- [ ] `npm run validate` green.

Deferred: none
