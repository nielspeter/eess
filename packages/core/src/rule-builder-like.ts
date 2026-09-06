import type { CollectResult } from './collect-result.js'

/**
 * Minimal shape the CLI runner and presets collect violations from: anything
 * exposing a non-throwing, severity-stamped `.violations()`. Lives in core (not
 * `cli/`) so presets can return `RuleBuilderLike[]` without depending on CLI
 * infrastructure.
 *
 * **The single member carries the evidence** — plan 0235's D1. An accessor
 * beside it could be walked around: a caller keeps calling `violations()`,
 * never asks for the count, and the evidence is optional again by another
 * route. One member, and it hands back the receipt, so a rule file that cannot
 * say what it examined does not compile.
 */
export interface RuleBuilderLike {
  violations: () => CollectResult
}
