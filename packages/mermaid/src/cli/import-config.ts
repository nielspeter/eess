import { createJiti } from 'jiti'
import {
  isModuleFormatRefusal,
  isTypeScriptSpecifierMiss,
  enableTypeScriptSpecifierResolution,
} from '@nielspeter/eess/internal'

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
 * Native first, and that ordering is the design — though not for the reason
 * this comment used to give. It said a module loaded through jiti gets its own
 * registry; measured, it does not (ADR-015). The reason is that the loader
 * decides which PROGRAMS are valid: jiti transpiles, so it accepts TypeScript
 * Node's strip-only mode refuses. `isModuleFormatRefusal` keeps the fallback
 * narrow — a broad catch would re-execute a file that had already run.
 *
 * The second branch is not a fallback at all. Bug 0223: under `"type": "module"`
 * a config importing `./shared.js` — the specifier TypeScript requires — fails
 * with `ERR_MODULE_NOT_FOUND`, because Node does no `.js` → `.ts` substitution.
 * Teaching the loader that substitution and retrying NATIVELY keeps the single
 * registry the paragraph above is about.
 */
export async function importConfigModule(file: string): Promise<unknown> {
  try {
    return await import(file)
  } catch (error: unknown) {
    if (isTypeScriptSpecifierMiss(error)) {
      enableTypeScriptSpecifierResolution()
      return await import(file)
    }
    if (!isModuleFormatRefusal(error)) throw error
    return createJiti(import.meta.url).import(file)
  }
}
