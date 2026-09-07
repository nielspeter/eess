import path from 'node:path'
import { createJiti } from 'jiti'
import { ArchConfigError } from '@nielspeter/eess'
import type { CollectResult } from '@nielspeter/eess'

export interface RuleBuilderLike {
  /**
   * The receipt — bug 0269.
   *
   * Required, not optional, and this is the whole fix. The loader used to key on
   * `check`, which any hand-rolled object satisfies, so
   * `export default [{ check: () => {} }]` was counted as a rule and the run
   * printed `✓ eess-mermaid — 1 rule across 1 file · 0 failing`.
   *
   * Every real builder already has this: `ClassRuleBuilder extends RuleBuilder`,
   * which extends the kernel's `TerminalBuilder`, where `violations()` has
   * returned a `CollectResult` since ADR-014. The receipt was there the whole
   * time and the CLI never asked for it — which is why this is a wiring fix and
   * not the dialect-wide contract change the bug record first supposed.
   */
  violations: () => CollectResult
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
    const items = resolveExported(exported, resolved)
    // A non-builder in the default-export array is a LOUD ERROR, never a silent
    // skip — the rule `eess-ts`'s loader states and this one did not have.
    //
    // Measured on the branch that tightened the guard without porting the
    // loudness: a rule file holding one real builder and one hand-rolled
    // `{ check() { throw … } }` went from **exit 1** (the hand-rolled rule ran
    // and threw) to `✓ eess-mermaid — 1 rule across 1 file · 0 failing`, exit 0.
    // A rule that ran and failed simply stopped existing, under a denominator
    // that still said one rule was there. A silently-dropped rule is a
    // green-but-empty gate, which is the defect this tool exists to forbid.
    items.forEach((item, index) => {
      if (!isRuleBuilderLike(item)) {
        throw new ArchConfigError(
          'loadRuleFiles',
          `Rule file "${resolved}": default export entry [${index}] is not a rule builder ` +
            `(got ${describeValue(item)}). Every entry must be a builder that can report what ` +
            `it examined — e.g. \`classes(diagram(…)).should()…\`. An object with only a ` +
            `\`check()\` method cannot say what it examined, so it cannot be gated.`,
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
 */
function resolveExported(exported: unknown, file: string): unknown[] {
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
  // Loud, for the same reason as the entry check above: a default export of the
  // wrong shape used to make the file contribute zero rules silently.
  throw new ArchConfigError(
    'loadRuleFiles',
    `Rule file "${file}": default export must be an array of rule builders, or a ` +
      `function returning one (got ${describeValue(exported)}). Add ` +
      '`export default [ …builders ]`.',
  )
}

function describeValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
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
  // Structural, and keyed on the RECEIPT rather than on `check` — bug 0269. A
  // builder that cannot say what it examined cannot be gated, and counting it as
  // a rule is how a hand-rolled no-op earned a green tick and a denominator.
  return 'violations' in value && typeof value.violations === 'function'
}
