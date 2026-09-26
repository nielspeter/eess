/**
 * The census of path-glob surfaces, and their classification — bug 0036.
 *
 * A module rather than a test file because TWO tests read it, and they check
 * different halves of the same claim:
 *
 * - `tests/core/every-path-glob-surface-is-classified.test.ts` — every surface
 *   in `src/` appears in `CLASSIFIED`, and nothing stale remains.
 * - `tests/core/globs-under-a-dot-directory.test.ts` — every classified surface
 *   BEHAVES as classified, measured from two project paths.
 *
 * The second reader is why this file exists (bug 0339). The census asserted
 * `'normalized'` for `conditions/structural.ts`, `conditions/function.ts` and
 * `smells/smell-builder.ts` while the code under those keys matched the absolute
 * path alone — for `smell-builder.ts` that is one of the two detectors it covers
 * (`inconsistentSiblings`; `duplicateBodies` did normalize, since bug 0036), which
 * is the sharper version of the point: one key, two behaviours, one letter of
 * classification. Nothing could tell, because a classification with no mechanism
 * is a comment with a type annotation. Splitting the table out is what let a
 * behavioural test bind to the same list, so a new surface cannot be classified
 * without also being measured.
 *
 * **A module, never a suite.** `vitest.config.ts` excludes `tests/matrix/**` and
 * `vitest.matrix.config.ts` claims it, so a file named `*.test.ts` in this
 * directory is dropped from `npm test` and collected only by `test:matrix`. This
 * file is safe because it is not one; do not rename it into one.
 */
import fs from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve(import.meta.dirname, '../../src')
const kernelSrcDir = path.resolve(import.meta.dirname, '../../../core/src')

/** A scanned file's census key: dialect paths bare, kernel paths prefixed. */
const rel = (full: string): string =>
  full.startsWith(kernelSrcDir)
    ? 'core:' + path.relative(kernelSrcDir, full)
    : path.relative(srcDir, full)

/**
 * Every place in `src/` that declares a path glob, read off the source.
 *
 * The point of deriving rather than listing: bug 0036 exists because the
 * uniformity table in `relative-globs-are-uniform.test.ts` is an `it.each` over
 * a **hand-written** array, and its stated purpose is that "a new surface added
 * without normalization fails". It cannot do that — a new surface adds no row.
 * A table over a hand-maintained list has exactly the defect it was written to
 * remove.
 *
 * `tests/docs/doc-globs-are-anchored.test.ts` already solves this shape, and
 * says why: it "knows which APIs it is classifying, so a new one is not
 * silently unchecked".
 */
export function pathGlobSurfaces(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.ts')) {
        const text = fs.readFileSync(full, 'utf8')
        // Per FILE, not per line: a line-based scan missed
        // `cross-layer-builder.ts` the moment prettier split its `globAnyOf(`
        // call across lines, which is a scan that silently stops covering a
        // surface — the exact failure this census exists to prevent.
        //
        // Both conditions, so `path-universe.ts` — which names the kinds in a
        // signature but declares nothing — is not counted as a surface.
        // `glob-site.ts` DEFINES `globAnyOf`/`globNode`; it is the mechanism,
        // not a surface. Excluded by name so the exclusion is visible rather
        // than encoded in a cleverer pattern.
        if (rel(full) === 'core/glob-site.ts' || rel(full) === 'core:glob-site.ts') continue
        const declares = text.includes('globAnyOf(') || text.includes('globNode(')
        const pathKind = text.includes("'file-path'") || text.includes("'parent-dir'")
        if (declares && pathKind) found.push(rel(full))
      }
    }
  }
  walk(srcDir)
  // The KERNEL too, since plan 0165 Phase 2. `define.ts` moved into
  // `@nielspeter/eess` and the census stopped seeing it — reported by this
  // file's own "nothing is classified that no longer declares a path glob",
  // which is the direction that matters: a surface eess-ts still ships must not
  // drop out of the census by changing package.
  walk(kernelSrcDir)
  return found.sort()
}

/** What a project-relative glob means at a surface. */
export type PathGlobBase = 'normalized' | 'rewritten' | 'fixed'

/**
 * Every path-glob surface, and what a project-relative glob means there.
 *
 * `normalized` — resolves against the project root.
 * `rewritten`  — `matching()`, which prefixes `'**\/'` instead. Looser, and
 *                deliberately not aligned: `'src/x/*'` there also matches a
 *                nested `src/x`, so aligning it NARROWS existing matches and
 *                needs its own release rather than a ride along with a fix.
 * `fixed`      — the library's own constant, not user input.
 */
export const CLASSIFIED: Readonly<Record<string, PathGlobBase>> = {
  'predicates/identity.ts': 'normalized',
  'conditions/structural.ts': 'normalized',
  'conditions/function.ts': 'normalized',
  'conditions/reverse-dependency.ts': 'normalized',
  'builders/cross-layer-builder.ts': 'normalized',
  'smells/smell-builder.ts': 'normalized',
  'builders/slice-rule-builder.ts': 'rewritten',
  'graphql/resolver-rule-builder.ts': 'rewritten',
  'core:define.ts': 'fixed',
}
