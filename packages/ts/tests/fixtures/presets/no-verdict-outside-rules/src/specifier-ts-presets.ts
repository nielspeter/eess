// RED — `@nielspeter/eess-ts/presets`. This repo's own guardrails script
// imports through this subpath shape.
import { agentGuardrails } from '@nielspeter/eess-ts/presets'

export const build = (p: object): unknown => agentGuardrails(p, { src: '**' })
