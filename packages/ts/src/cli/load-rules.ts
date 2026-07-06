import path from 'node:path'
import { createJiti } from 'jiti'
import type { CheckOptions, ArchViolation } from '@nielspeter/eess'

/** Minimal interface for rule builders — needs .check(); .violations() enables --fix. */
// eess-exclude eess/no-unused-exports: return-element type of the exported loadRuleFiles API (must stay exported for declaration emit)
export interface RuleBuilderLike {
  check: (opts?: CheckOptions) => void
  /** Collect violations without printing/throwing — used by --fix. */
  violations?: () => ArchViolation[]
}

// eess-exclude eess/no-unused-exports: parameter type of the exported loadRuleFiles API (must stay exported for declaration emit)
export interface LoadOptions {
  /** Use cache-busting imports for watch mode. Default: false */
  fresh?: boolean
}

// jiti so rule files can be authored in TypeScript (`arch.rules.ts`) — native
// `import()` cannot load `.ts`. Cached, except in watch mode where a fresh
// instance busts the module cache to pick up edits.
let cachedJiti: ReturnType<typeof createJiti> | undefined
function getJiti(fresh: boolean): ReturnType<typeof createJiti> {
  if (fresh) return createJiti(import.meta.url, { fsCache: false, moduleCache: false })
  if (!cachedJiti) cachedJiti = createJiti(import.meta.url)
  return cachedJiti
}

/**
 * Load rule files via jiti (supports `.ts` and `.js`/`.mjs`).
 *
 * Rule files must export a default array of rule builders or a function
 * returning one. When `fresh` is true, a cache-busting jiti instance is used so
 * watch-mode re-runs pick up file changes.
 */
export async function loadRuleFiles(
  files: string[],
  options?: LoadOptions,
): Promise<RuleBuilderLike[]> {
  const builders: RuleBuilderLike[] = []
  const jiti = getJiti(options?.fresh === true)

  for (const file of files) {
    const resolved = path.resolve(file)
    const mod: unknown = await jiti.import(resolved)

    const exported = extractDefault(mod)
    const items = resolveExported(exported, file)
    // A non-builder value in the default-export array is a loud error, never a
    // silent skip: a silently-dropped rule is a green-but-empty gate, which the
    // whole point of this tool is to forbid (plan 0061, Phase 0). Every entry
    // must be a `.check()`-able builder — a void preset call (`preset(...)`
    // returning `undefined`) is the classic offender and must fail here, not
    // vanish.
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
  if (typeof exported === 'function') {
    // Runtime validated: exported is a function, call it and check result
    // eess-exclude eess/adr005-no-type-assertions: exported is runtime-verified as callable (typeof check); the static `Function` type is not callable with a typed signature
    const result: unknown = (exported as () => unknown)()
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
    return mod['default']
  }
  return undefined
}

function isRuleBuilderLike(value: unknown): value is RuleBuilderLike {
  if (value === null || value === undefined || typeof value !== 'object') {
    return false
  }
  // Structural type check: must have a 'check' method ('in' narrows the read)
  return 'check' in value && typeof value['check'] === 'function'
}
