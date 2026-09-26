import { describe, it, expect } from 'vitest'
import { CLASSIFIED, pathGlobSurfaces } from '../matrix/path-glob-surfaces.js'

/**
 * Every place in `src/` that declares a path glob is classified — bug 0036.
 *
 * The census itself, and the reason it is derived from the source rather than
 * listed, now live beside the table in `tests/matrix/path-glob-surfaces.js`.
 * `tests/core/globs-under-a-dot-directory.test.ts` reads the same table and
 * measures whether each surface behaves the way it is classified, which is the
 * half that was missing when bug 0339 landed.
 */
describe('every path-glob surface is classified (bug 0036)', () => {
  it('the census finds the surfaces it is meant to', () => {
    // A floor and a known member, so a broken scan cannot report "nothing to
    // classify" and pass — which is how a census turns into decoration.
    const files = pathGlobSurfaces()
    expect(files.length).toBeGreaterThanOrEqual(8)
    expect(files).toContain('predicates/identity.ts')
    expect(files).toContain('builders/cross-layer-builder.ts')
  })

  it('no surface is unclassified', () => {
    // THE guard. Adding a path-glob entry point without deciding what a
    // relative spelling means there fails here, naming the file and line —
    // which is the one thing the hand-written table could never do.
    expect(pathGlobSurfaces().filter((f) => CLASSIFIED[f] === undefined)).toEqual([])
  })

  it('nothing is classified that no longer declares a path glob', () => {
    // The other direction: a stale entry makes the table look more complete
    // than it is, and would mask a surface that later stops normalizing.
    const files = new Set(pathGlobSurfaces())
    expect(Object.keys(CLASSIFIED).filter((f) => !files.has(f))).toEqual([])
  })
})
