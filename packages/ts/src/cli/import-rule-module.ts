import { createJiti } from 'jiti'
import { importFresh } from './watch.js'
import { isModuleFormatRefusal } from '@nielspeter/eess/internal'

/**
 * Load a rule file or config module — natively when Node can, via jiti when it cannot.
 *
 * **Native first, and that ordering is the whole design.** A rule file loaded
 * through jiti gets jiti's own module registry, so the copy of eess-ts it imports
 * is a DIFFERENT instance from the CLI's. Two things break silently when that
 * happens, both measured (plan 0165):
 *
 *  - `instanceof ArchRuleError` is false for an error that is one, so
 *    `check.ts` skipped `ruleFileTruncated()` and a truncated run said nothing
 *    about the rules that never ran — bug 0029 reopened by the loader.
 *    (`isArchRuleError` in `core/errors.ts` fixes that half structurally, and it
 *    is worth keeping regardless: a consumer with two copies of eess-ts on disk
 *    hits it with no jiti involved.)
 *  - `execute-rule.ts`'s module-level `callerAggregatesReports` flag is set on
 *    the CLI's copy and read on the rule file's, so every configuration finding
 *    was written twice — once by the rule file and once by the CLI re-reporting
 *    the thrown error. That half CANNOT be fixed structurally: module state has
 *    no cross-registry identity to compare.
 *
 * So jiti is the fallback, not the default, and it is entered on exactly one
 * condition: Node refused the file because the CONSUMER project is
 * `"type": "commonjs"` and the file uses ESM syntax — bug 0074, what
 * `npm init -y` writes. Everything else rethrows, including an `ArchRuleError`
 * thrown by a self-executing rule file, which must never be retried (a second
 * execution would print its findings twice).
 */
export async function importRuleModule(file: string, fresh: boolean): Promise<unknown> {
  try {
    return fresh ? await importFresh(file) : await import(file)
  } catch (error: unknown) {
    if (!isModuleFormatRefusal(error)) throw error
    // jiti transpiles to CJS, so the host's `"type": "commonjs"` stops mattering.
    // `fsCache`/`moduleCache` off when fresh, for the same reason `importFresh`
    // exists: watch mode must re-execute an edited file.
    const jiti = fresh
      ? createJiti(import.meta.url, { fsCache: false, moduleCache: false })
      : createJiti(import.meta.url)
    return jiti.import(file)
  }
}
