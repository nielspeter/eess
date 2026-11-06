# Bug 0628: the non-vacuity rule-id audit reads only corpus ids

## Status

- **State:** Draft — read from the source 2026-11-06 by the enforcement review of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s build; not reproduced
  as a failure, because nothing fails yet.
- **Severity:** Low — no gate passes that should fail: every architecture rule id this harness checks
  is asserted by a row. But a new `eess/…` rule with no row is noticed only by its gate's coverage
  claim, not by its id, so a rule could ship with a row that never asserts it.
- **Origin:** self-found · the enforcement review of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s build, 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

`scripts/check-nonvacuity.mjs:6751` audits that every rule id `check-corpus.mjs` can emit carries a
fixture: it reads `corpus/…` ids from that script and compares them with the ids rows assert
(`ASSERTED_RULE_IDS`, `scripts/check-nonvacuity.mjs:544`). The ids `arch.rules.ts` and the other rule
files declare (`eess/…`) are not read, so a rule added there with no row asserting its id passes the
audit; only the gate-coverage check, which counts rows per `check:*`, would notice a missing row, and
not a row that asserts the wrong id.

## Root cause

The audit's id source is `check-corpus.mjs` alone; the rule files are not read.

## Fix

Not designed. Read the ids the rule files declare (`.rule({ id })`) and require each to be asserted
by a row, or listed with a reason it has none, as the vacuity matrix lists exports.

## Verification

- [ ] Red first: a rule added to `arch.rules.ts` with no row asserting its id fails the audit.
- [ ] Every existing `eess/…` id is asserted or listed with its reason.
- [ ] `npm run validate` green.

Deferred: none
