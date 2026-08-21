export type { RuleSeverity, PresetBaseOptions } from './shared.js'
export { validateOverrides } from './shared.js'

export type { LayeredArchitectureOptions } from './layered.js'
export { layeredArchitecture } from './layered.js'

export type { DataLayerIsolationOptions } from './data-layer.js'
export { dataLayerIsolation } from './data-layer.js'

export type { StrictBoundariesOptions } from './boundaries.js'
export { strictBoundaries } from './boundaries.js'

export type { AgentGuardrailsOptions } from './agent-guardrails.js'
export { agentGuardrails } from './agent-guardrails.js'

export type { RecommendedOptions } from './recommended.js'
export { recommended } from './recommended.js'

// Published on the `/presets` subpath before the engine copy and dropped by it.
// `restore-the-published-ts-surface` audited the ROOT barrel only, so a named
// import of either from `@nielspeter/eess-ts/presets` was a link-time error that
// no changeset declared. Found by an adopter review diffing every subpath, not
// just `.`.
export { dispatchRule, throwIfViolations } from '@nielspeter/eess'

// The preset delivery mode, on the subpath the docs actually teach
// (`docs/getting-started.md` imports presets from here). It was on the root
// barrel only, so an adopter writing `report: 'builders'` and reaching for the
// type hit a link error on the natural import.
export type { PresetDelivery } from './shared.js'
