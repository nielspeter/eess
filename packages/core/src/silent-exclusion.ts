/**
 * Symbol used to tag silent exclusion patterns.
 * Not exported — only isSilent() should inspect this.
 */
const SILENT: unique symbol = Symbol('silent-exclusion')

/**
 * A wrapped exclusion pattern that suppresses the "unused exclusion" warning.
 *
 * Use `silent()` to wrap patterns that intentionally match zero violations in
 * some configurations — for example, shared exclusions across monorepo workspaces
 * where not every workspace triggers every pattern.
 */
export interface SilentExclusion {
  readonly pattern: string | RegExp
  readonly [SILENT]: true
}

/**
 * Wrap an exclusion pattern to suppress the "unused exclusion" warning.
 *
 * By default, `.excluding()` warns when a pattern matches zero violations
 * (stale-exclusion detection). Use `silent()` for patterns that are
 * intentionally broad and may legitimately match nothing in some contexts.
 *
 * @example
 * import { silent } from '\@nielspeter/eess-ts'
 *
 * modules(p)
 *   .should().satisfy(noDeadModules())
 *   .excluding(silent(/\.d\.ts$/), 'index.ts')
 *   .check()
 */
export function silent(pattern: string | RegExp): SilentExclusion {
  return { pattern, [SILENT]: true }
}

/**
 * Check whether a value is a SilentExclusion.
 */
export function isSilent(value: unknown): value is SilentExclusion {
  return typeof value === 'object' && value !== null && SILENT in value
}

/**
 * Record `patterns` into a builder's exclusion state, tracking which are silent.
 *
 * A free function over the two collections rather than a method, because the two
 * builders that need it sit in incompatible class hierarchies — `eess-ts` has
 * `RuleDeclaration -> TerminalBuilder -> RuleBuilder` where the kernel has two
 * levels — so inheritance cannot share it. It mutates only what it is handed,
 * so no private state crosses a package boundary.
 *
 * The two copies were byte-identical (`no-copy-paste` reported 100%).
 */
export function recordExclusions(
  patterns: readonly (string | RegExp | SilentExclusion)[],
  exclusions: (string | RegExp)[],
  silentIndices: Set<number>,
): void {
  for (const p of patterns) {
    if (isSilent(p)) {
      exclusions.push(p.pattern)
      silentIndices.add(exclusions.length - 1)
    } else {
      exclusions.push(p)
    }
  }
}
