import path from 'node:path'
import { importRuleModule } from './import-rule-module.js'
import { isNullaryCallable } from '@nielspeter/eess'
import type { RuleBuilderLike } from '../core/rule-builder-like.js'

// Re-exported for existing importers; the type lives in core so presets can
// return RuleBuilderLike[] without depending on CLI infrastructure.
export type { RuleBuilderLike } from '../core/rule-builder-like.js'

export interface LoadOptions {
  /** Use cache-busting imports for watch mode. Default: false */
  fresh?: boolean
}

/**
 * Load rule files (supports `.ts` and `.js`/`.mjs`).
 *
 * Rule files must export a default array of rule builders or a function
 * returning one. When `fresh` is true, the module cache is busted so watch-mode
 * re-runs pick up file changes.
 */
export async function loadRuleFiles(
  files: string[],
  options?: LoadOptions,
): Promise<RuleBuilderLike[]> {
  const builders: RuleBuilderLike[] = []

  for (const file of files) {
    const resolved = path.resolve(file)
    const mod: unknown = await importRuleModule(resolved, options?.fresh === true)

    const exported = extractDefault(mod)
    const items = resolveExported(exported, file)
    // A non-builder value in the default-export array is a LOUD ERROR, never a
    // silent skip (plan 0061 Phase 0). A silently-dropped rule is a
    // green-but-empty gate, which is the defect this tool exists to forbid — a
    // void preset call (`preset(...)` returning `undefined`) is the classic
    // offender and must fail here rather than vanish.
    //
    // **eess deliberately diverges from ts-archunit here**, which skips
    // non-builders and returns `[]` for a malformed default export. Plan 0165's
    // wholesale engine copy reverted this in both directions at once — source
    // AND the tests that pinned it — so the fail-open landed green. Restored,
    // with `tests/cli/load-rules.test.ts` carrying eess's assertions.
    items.forEach((item, index) => {
      if (!isRuleBuilderLike(item)) {
        throw new Error(
          `Rule file "${file}": default export entry [${index}] is not a rule builder ` +
            `(got ${describeValue(item)}). Every entry must be a builder with a .check() ` +
            `method — e.g. \`modules(p).that()…\`. A preset that returns void cannot be placed ` +
            `directly in the array; call it in its own statement, or export a builder.`,
        )
      }
      builders.push(item)
    })
  }

  return builders
}

/**
 * Resolve the exported value to an array of unknowns.
 * Supports: direct arrays, or factory functions returning arrays.
 *
 * A default export of the wrong shape (not an array, or a function that does
 * not return an array) is a loud error — otherwise the rule file contributes
 * zero gates silently.
 */
function resolveExported(exported: unknown, file: string): unknown[] {
  if (Array.isArray(exported)) {
    return exported
  }
  if (isNullaryCallable(exported)) {
    const result: unknown = exported()
    if (Array.isArray(result)) {
      return result
    }
    throw new Error(
      `Rule file "${file}": default-exported function must return an array of rule builders ` +
        `(got ${describeValue(result)}).`,
    )
  }
  throw new Error(
    `Rule file "${file}": default export must be an array of rule builders, or a function ` +
      `returning one (got ${describeValue(exported)}). Add \`export default [ …builders ]\`.`,
  )
}

/** Short human-readable description of an unexpected value, for error messages. */
function describeValue(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value
}

function extractDefault(mod: unknown): unknown {
  if (mod === null || mod === undefined || typeof mod !== 'object') {
    return undefined
  }
  // Dynamic import returns a module namespace object — 'in' narrows safely
  if ('default' in mod) {
    return mod.default
  }
  return undefined
}

function isRuleBuilderLike(value: unknown): value is RuleBuilderLike {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false
  }
  // Structural type check: must have a 'violations' method
  return 'violations' in value && typeof value.violations === 'function'
}
