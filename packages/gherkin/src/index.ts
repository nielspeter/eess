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
