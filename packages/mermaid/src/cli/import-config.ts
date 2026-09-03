import { createJiti } from 'jiti'
import { isModuleFormatRefusal } from '@nielspeter/eess/internal'

/**
 * Load a config or rule module — natively when Node can, via jiti when it cannot.
 *
 * **This closes a live bug, not just a duplication.** `resolve-config.ts` used a
 * bare `await import()`, and `CONFIG_FILENAMES` lists `.ts` files — so an
 * `eess-mermaid.config.ts` in a `"type": "commonjs"` project (what `npm init -y`
 * writes) was refused by Node and the config silently did not load. `eess-ts`
 * has handled that since bug 0074; this package had `jiti` as a dependency the
 * whole time and never used it.
 *
 * Native first, and that ordering is the design: a module loaded through jiti
 * gets jiti's own registry, so the copy of the kernel it imports is a different
 * instance from the CLI's. `isModuleFormatRefusal` keeps the fallback narrow —
 * a broad catch would re-execute a file that had already run.
 */
export async function importConfigModule(file: string): Promise<unknown> {
  try {
    return await import(file)
  } catch (error: unknown) {
    if (!isModuleFormatRefusal(error)) throw error
    return createJiti(import.meta.url).import(file)
  }
}
