export type { RuleSeverity, PresetBaseOptions } from './shared.js'
export { dispatchRule, validateOverrides, throwIfViolations, finishPreset } from './shared.js'

// A standalone consumer building a custom preset (the same pattern this
// package's own presets use) needs the underlying reporting primitive too.
export { reportViolations } from '@nielspeter/eess'
export type { ReportMode, ReportOptions, PresetReportOptions } from '@nielspeter/eess'

export type { RecommendedOptions } from './recommended.js'
export { recommended } from './recommended.js'

export type { AgentGuardrailsOptions } from './agent-guardrails.js'
export { agentGuardrails } from './agent-guardrails.js'

export type { LayeredArchitectureOptions } from './layered.js'
export { layeredArchitecture } from './layered.js'

export type { DataLayerIsolationOptions } from './data-layer.js'
export { dataLayerIsolation } from './data-layer.js'

export type { StrictBoundariesOptions } from './boundaries.js'
export { strictBoundaries } from './boundaries.js'
