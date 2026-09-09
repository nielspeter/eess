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
export { dispatchRule } from '@nielspeter/eess'

// `finishPreset` joins it, and the reason is this same subpath's history one
// paragraph up. Plan 0263 Phase 5 removed `throwIfViolations` from HERE as well
// as the two roots, and `finishPreset(v, { report: 'throw' })` is the migration
// the changeset prints — which did not compile on this barrel, because the alias
// was published here and its replacement never was. `docs/api-reference.md`
// documented the alias under "Presets (`eess-ts/presets`)", so the adopter who
// followed the docs is exactly the one the migration would have failed. Found by
// an adopter review, the second time this subpath has been audited separately
// from the root and the second time that was the only way to see it.
export { finishPreset } from '@nielspeter/eess'

// The preset delivery mode, on the subpath the docs actually teach
// (`docs/getting-started.md` imports presets from here). It was on the root
// barrel only, so an adopter writing `report: 'builders'` and reaching for the
// type hit a link error on the natural import.
export type { PresetDelivery } from './shared.js'
