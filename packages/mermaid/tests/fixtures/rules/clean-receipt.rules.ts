/**
 * The green control for bug 0269: a builder with a real receipt and nothing to
 * report must stay green.
 *
 * A fixture file rather than a temp-dir probe, because a rule file importing
 * `@nielspeter/eess` only resolves inside the workspace — and because a control
 * that lives beside `passing.rules.ts` and `failing.rules.ts` is where the next
 * reader will look for it.
 */
import { collectResult } from '@nielspeter/eess'

export default [{ violations: () => collectResult([], { examined: 7 }) }]
