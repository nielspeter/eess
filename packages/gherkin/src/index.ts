/**
 * @nielspeter/eess-gherkin — the Gherkin dialect of the eess family
 * (plan 0069 Phase 1).
 *
 * Loads `.feature` files and exposes features/scenarios as first-class
 * elements, so a markdown corpus's scenario citations can be cross-validated
 * against the real behavior specs (see `@nielspeter/eess-crossvalidate`'s
 * md↔gherkin pairing), and scenario hygiene (unique, citable titles) can be
 * gated like any other architecture rule.
 */
export type { GherkinFeature, GherkinScenario } from './model.js'
export { features, parseFeature } from './load.js'
export type { FeatureSet, FeaturesOptions } from './load.js'
export { scenarios, ScenarioRuleBuilder } from './builder.js'

// Kernel re-exports (plan 0089 — standalone sufficiency): every kernel
// symbol builder.ts itself imports, so a caller writing a custom predicate
// or condition over scenarios() never needs a second, direct
// @nielspeter/eess install.
export { RuleBuilder } from '@nielspeter/eess'
// Bug 0276 — the receipt seam, derived from the ADRs rather than from whichever
// symbols a release happened to mention. ADR-014 requires a verdict to carry its
// evidence and names `collectResult`/`mergeCollectResults` as how one is built or
// combined; it also records that this package publishes no binary, so "the seam
// is the preset a caller finishes" — which makes `finishPreset` and
// `reportViolations` (ADR-008's one emitter) part of the same obligation. And a
// caller who can be handed a configuration finding needs the guard to catch it.
//
// The first cut of this fix shipped the two constructors alone, so a standalone
// consumer could build a receipt and had nothing to hand it to. An architecture
// review measured that; the set is now what the ADRs ask for.
//
// `check:family` owes none of these, correctly: it is import-driven and this
// package's own source imports none of them.
export {
  collectResult,
  mergeCollectResults,
  finishPreset,
  reportViolations,
  isArchConfigError,
  // The third row of the receipt's own table in `docs/api-reference.md`. An
  // adopter review shipped the first two and found this missing: you could build
  // a receipt and not ask whether it carried evidence.
  hasEvidence,
} from '@nielspeter/eess'
// …and the type, so a consumer can NAME what they hold. Values without their
// type is the callable-but-unnameable defect ADR-011's nameability guard exists
// for, one package out.
export type { CollectResult } from '@nielspeter/eess'
export type { Condition, Predicate, ArchViolation } from '@nielspeter/eess'
