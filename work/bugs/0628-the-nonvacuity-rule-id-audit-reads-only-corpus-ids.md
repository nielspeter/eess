# Bug 0628: the non-vacuity rule-id audit reads only corpus ids

## Status

- **State:** Draft — read from the source 2026-11-06 by the enforcement review of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s build, and measured the
  same day by its method re-check: ten declared rule ids have no row today.
- **Severity:** Medium — ten rules can be gutted with no fixture to go red: six in `arch.rules.ts`
  (`eess/kernel-no-engine-deps`, `eess/kernel-no-dialects`, `eess/ts-isolated`,
  `eess/mermaid-isolated`, `eess/md-isolated`, `eess/gherkin-isolated`) and four in `spec.rules.ts`
  (`spec/readme-packages-match-workspace`, `spec/readme-status-matches-version`,
  `spec/adr-index-matches-files`, `spec/adr-index-links-resolve`). Measured by grepping
  `scripts/check-nonvacuity.mjs` for each `id:` the rule files declare; none of the ten appears there,
  quoted or built from a pattern. Whether each rule fires is not known; that no check proves it is.
- **Origin:** self-found · the enforcement review of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s build, 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

`scripts/check-nonvacuity.mjs:6767` audits that every rule id `check-corpus.mjs` can emit carries a
fixture: it reads `corpus/…` ids from that script and compares them with the ids rows assert
(`ASSERTED_RULE_IDS`, `scripts/check-nonvacuity.mjs:544`). The ids `arch.rules.ts` and the other rule
files declare are not read, so a rule declared there with no row asserting its id passes the audit.
The gate-coverage check does not catch it either: it asks for a row per gating script, not per rule,
so one row for `check:arch` covers every rule in that file. The ten ids under Severity are that gap,
present today.

## Root cause

The audit's id source is `check-corpus.mjs` alone; the rule files are not read.

## Fix

Not designed. Read the ids the rule files declare (`.rule({ id })`) and require each to be asserted
by a row, or listed with a reason it has none, as the vacuity matrix lists exports.

## Verification

- [ ] Red first: a rule added to `arch.rules.ts` with no row asserting its id fails the audit.
- [ ] Every existing rule-file id (the ten above among them) is asserted or listed with its reason.
- [ ] `npm run validate` green.

Deferred: none
