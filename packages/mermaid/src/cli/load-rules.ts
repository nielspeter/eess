import path from 'node:path'
import { createJiti } from 'jiti'
import type { CheckOptions } from '@nielspeter/eess'

export interface RuleBuilderLike {
  check: (opts?: CheckOptions) => void
  describeRule?: () => unknown
}

export interface LoadOptions {
  fresh?: boolean
}

let cachedJiti: ReturnType<typeof createJiti> | undefined

function getJiti(fresh: boolean): ReturnType<typeof createJiti> {
  if (fresh) return createJiti(import.meta.url, { fsCache: false, moduleCache: false })
  if (!cachedJiti) cachedJiti = createJiti(import.meta.url)
  return cachedJiti
}

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
    const items = resolveExported(exported)
    for (const item of items) {
      if (isRuleBuilderLike(item)) {
        builders.push(item)
      }
    }
  }

  return builders
}

/**
 * Resolve the exported value to an array of unknowns.
 * Supports: direct arrays, or factory functions returning arrays.
 */
function resolveExported(exported: unknown): unknown[] {
  if (Array.isArray(exported)) {
    return exported
  }
  if (typeof exported === 'function') {
    // Runtime validated: exported is a function. Invoke via Function.prototype.call
    // so the unknown-signature factory yields `any`, narrowed here to `unknown`.
    const result: unknown = exported.call(undefined)
    if (Array.isArray(result)) {
      return result
    }
  }
  return []
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
  // Structural type check: must have a 'check' method
  return 'check' in value && typeof value.check === 'function'
}
