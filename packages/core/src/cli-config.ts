import path from 'node:path'
import fs from 'node:fs'
import { registerHooks } from 'node:module'
import type { OutputFormat } from './check-options.js'
import { isRecord } from './type-guards.js'

/**
 * The parts of dialect CLI config handling that are the same everywhere.
 *
 * **Split along the kernel's existing seam, not behind a new injection point.**
 * `PathUniverse` sets the pattern: the kernel takes materialized data and the
 * dialect does the I/O. Here the pure halves are finding the config file and
 * validating what a loaded module claims — both were byte-identical between
 * `eess-ts` and `eess-mermaid` (`findConfigFile` scored 100%). The impure half,
 * actually importing the file, stays in each dialect because it needs `jiti`,
 * which the kernel cannot depend on.
 *
 * That leaves one genuinely shared subtlety in the impure half —
 * {@link isModuleFormatRefusal} — so it lives here too. It is pure, and it is
 * the part that is easy to get dangerously wrong.
 */

/** Config fields every dialect CLI understands. A dialect may add its own. */
export interface SharedCliConfig {
  rules?: string[]
  format?: OutputFormat | 'auto'
  watchDirs?: string[]
}

const FORMATS = new Set(['terminal', 'json', 'github', 'auto'])

/** The first of `filenames` that exists in the working directory. */
export function findConfigFile(filenames: readonly string[]): string | undefined {
  const cwd = process.cwd()
  for (const name of filenames) {
    const candidate = path.join(cwd, name)
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

/** Strings from an unknown array, dropping anything that is not one. */
function stringsOf(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined
}

/**
 * The shared config a loaded module claims, validated.
 *
 * Everything is checked rather than trusted: a config file is arbitrary user
 * code and its default export can be any shape at all. An unrecognised `format`
 * is dropped rather than passed through, so a typo falls back to the default
 * instead of reaching a formatter that has no case for it.
 */
export function extractSharedConfig(mod: unknown): SharedCliConfig {
  if (!isRecord(mod) || !('default' in mod)) return {}
  const defaultExport = mod.default
  if (!isRecord(defaultExport)) return {}

  const config: SharedCliConfig = {}
  const format = defaultExport['format']
  if (typeof format === 'string' && FORMATS.has(format)) {
    // Narrowed by the set above; the cast-free form is this re-check.
    config.format =
      format === 'terminal' || format === 'json' || format === 'github' ? format : 'auto'
  }
  const rules = stringsOf(defaultExport['rules'])
  if (rules) config.rules = rules
  const watchDirs = stringsOf(defaultExport['watchDirs'])
  if (watchDirs) config.watchDirs = watchDirs
  return config
}

/**
 * Did Node refuse this file for its MODULE FORMAT, rather than for anything the
 * file does?
 *
 * Narrow on purpose. A broad `catch` that fell back to a transpiling loader on
 * any error would re-execute a rule file that had already run — doubling its
 * output — and would hide a genuine syntax error behind a second,
 * differently-worded failure.
 *
 * The condition it detects is bug 0074: the CONSUMER project is
 * `"type": "commonjs"` (what `npm init -y` writes) and the config or rule file
 * uses ESM syntax.
 */
export function isModuleFormatRefusal(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false
  return (
    error.message.includes('Cannot use import statement outside a module') ||
    error.message.includes("Unexpected token 'export'")
  )
}

/**
 * The extension substitutions TypeScript performs and Node does not.
 *
 * Under `nodenext`, TypeScript REQUIRES a relative import to name the emitted
 * `.js` file even when the file on disk is `.ts`. Node performs no such
 * substitution, so the specifier that `tsc` demands is the one Node cannot
 * resolve.
 */
const TS_SPECIFIER_SUBSTITUTIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ['.js', ['.ts', '.tsx']],
  ['.jsx', ['.tsx']],
  ['.mjs', ['.mts']],
  ['.cjs', ['.cts']],
])

/** The TypeScript file a JS-family URL stands for, if one is on disk. */
function typeScriptSourceFor(url: string): string | undefined {
  for (const [emitted, sources] of TS_SPECIFIER_SUBSTITUTIONS) {
    if (!url.endsWith(emitted)) continue
    const stem = url.slice(0, -emitted.length)
    for (const source of sources) {
      const candidate = `${stem}${source}`
      if (fs.existsSync(new URL(candidate))) return candidate
    }
  }
  return undefined
}

/**
 * Did Node fail to resolve a specifier that TypeScript requires be written that
 * way — a `./sibling.js` whose file on disk is `./sibling.ts`?
 *
 * Narrow for the same reason {@link isModuleFormatRefusal} is, and narrower
 * still: it answers yes only when the TypeScript source is ACTUALLY on disk. A
 * genuinely missing module is still a genuinely missing module, reported the way
 * it always was, and nothing is retried on its behalf.
 *
 * This is bug 0223, reported by a consuming project. `"type": "module"` plus the
 * `.js` specifier is not an exotic combination — it is the one TypeScript
 * mandates for ESM, so every project that splits its rules across files reaches
 * it on the first attempt. The failure is `ERR_MODULE_NOT_FOUND` rather than a
 * `SyntaxError`, which is why the format-refusal predicate above cannot see it.
 */
export function isTypeScriptSpecifierMiss(error: unknown): boolean {
  if (!isRecord(error)) return false
  if (error['code'] !== 'ERR_MODULE_NOT_FOUND') return false
  const url = error['url']
  return typeof url === 'string' && typeScriptSourceFor(url) !== undefined
}

/** Registered at most once per process; the hook is global and idempotent. */
let specifierResolutionEnabled = false

/**
 * Teach this process's loader the substitution, so `./sibling.js` resolves to
 * `./sibling.ts` when that is the file that exists.
 *
 * **`registerHooks`, deliberately, and not a transpiling loader.** The hook is
 * synchronous and in-thread, so a rule file still loads into THIS module
 * registry. That is the invariant plan 0165 and bug 0029 paid for and the reason
 * the alternative fix was rejected: a second registry makes
 * `instanceof ArchRuleError` false and sets `callerAggregatesReports` on one
 * copy while it is read on the other, printing every configuration finding
 * twice. Resolution is the only thing being changed here; execution is
 * untouched.
 *
 * The hook rewrites nothing unless the emitted path is absent AND the
 * TypeScript source is present, so a real `.js` file beside a `.ts` of the same
 * name always wins, and a specifier naming neither is left alone to fail as it
 * would have.
 */
export function enableTypeScriptSpecifierResolution(): void {
  if (specifierResolutionEnabled) return
  specifierResolutionEnabled = true
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        return nextResolve(specifier, context)
      }
      const parentURL = context.parentURL
      if (parentURL === undefined) return nextResolve(specifier, context)
      const emitted = new URL(specifier, parentURL)
      if (fs.existsSync(emitted)) return nextResolve(specifier, context)
      const source = typeScriptSourceFor(emitted.href)
      if (source === undefined) return nextResolve(specifier, context)
      return nextResolve(source, context)
    },
  })
}

/**
 * Refuse a run that named no rule files, saying where to name them.
 *
 * Sets `process.exitCode` rather than throwing: the caller is a CLI entry point
 * that still wants to return normally. Returns whether the run may proceed.
 *
 * `configName` is the dialect's own config filename, because "set them in
 * config" is not an instruction — the two copies of this differed in exactly
 * that word, one naming the file and one not.
 */
export function requireRuleFiles(ruleFiles: readonly string[], configName: string): boolean {
  if (ruleFiles.length > 0) return true
  console.error(
    `Error: No rule files specified. Pass rule files as arguments or set them in ${configName}.`,
  )
  process.exitCode = 1
  return false
}
