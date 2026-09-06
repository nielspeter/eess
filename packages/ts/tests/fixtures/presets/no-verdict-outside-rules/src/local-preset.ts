// GREEN when named in `ruleFiles` — a preset module. Narrowing 1 asserted, not
// assumed: `dispatchRule` is off the banned call regex, but this module imports
// it at RUNTIME, so the import leg reds it unless the exemption covers it. A
// preset module is a verdict file by definition.
import { dispatchRule } from '@nielspeter/eess'

export function myPreset(builders: object[], overrides?: Record<string, 'off'>): unknown[] {
  return builders.map((b) => dispatchRule(b, 'my/rule', 'error', overrides))
}
