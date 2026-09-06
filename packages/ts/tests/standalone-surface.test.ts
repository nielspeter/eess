import { describe, it, expect } from 'vitest'
import * as kernel from '@nielspeter/eess'
import * as kernelInternal from '@nielspeter/eess/internal'
import * as tsRoot from '../src/index.js'
import * as tsPresets from '../src/presets/index.js'
import {
  KERNEL_INTERNAL,
  FAMILY_ONLY,
  ANSI_INTERNAL,
  KERNEL_PRIVATE_BEFORE_THE_SPLIT,
} from '../../../scripts/lib/kernel-surface.mjs'

/**
 * Plan 0088's Success Definition (binding invariant): `@nielspeter/eess-ts`
 * alone is a complete tool — a user who installs only it runs the whole
 * engine, with no second install and no awareness that `@nielspeter/eess`
 * exists. Phase 4 names the mechanism explicitly: "a guard test enumerates
 * eess-ts's re-exports against the kernel's index and fails on a gap."
 *
 * This only checks VALUE exports — `import * as ns` only captures what
 * exists at runtime, so type-only kernel exports (`CollectResult`,
 * `Matcher`, etc.) aren't covered here; a missing type-only re-export is
 * still a real standalone-sufficiency gap, just one this guard can't see.
 */

/**
 * The exclusion sets are IMPORTED, not restated.
 *
 * `npm run check:family` enforces the same invariant from the other side and
 * needs the same lists. They used to be two copies kept in step by a comment
 * that said so; plan 0165 Phase 2 moved 30 modules into the kernel and grew one
 * of them by 47 names, which is exactly when a hand-synced pair drifts. See
 * `scripts/lib/kernel-surface.mjs` for what each set means and why a name is on
 * it.
 */

const EXCLUDED = new Set([
  ...FAMILY_ONLY,
  ...KERNEL_INTERNAL,
  ...ANSI_INTERNAL,
  ...KERNEL_PRIVATE_BEFORE_THE_SPLIT,
])

describe('standalone sufficiency: eess-ts re-exports the kernel surface it owns (plan 0088)', () => {
  it('every non-excluded kernel value export is reachable from eess-ts (root or presets subpath)', () => {
    const reachable = new Set([...Object.keys(tsRoot), ...Object.keys(tsPresets)])
    const missing = Object.keys(kernel).filter(
      (name) => !EXCLUDED.has(name) && !reachable.has(name),
    )
    expect(missing).toHaveLength(0)
  })

  // ADR-011 clause 2. The three lists above are empty now, so the staleness test
  // below can no longer fail on them — this is the assertion that replaced the
  // bookkeeping they used to do. The boundary is structural: a plumbing symbol is
  // absent from the kernel root entirely, and a dialect that forwards one from
  // `@nielspeter/eess/internal` puts it back on a published surface, which is the
  // exact duplication the split removed.
  it('no symbol behind @nielspeter/eess/internal is reachable from eess-ts', () => {
    const reachable = new Set([...Object.keys(tsRoot), ...Object.keys(tsPresets)])
    const forwarded = Object.keys(kernelInternal).filter((name) => reachable.has(name))
    expect(forwarded).toEqual([])
  })

  it('the internal entry point is non-empty, so the guard above can actually fail', () => {
    // Without this, deleting internal.ts's contents would make the clause-2 test
    // pass over an empty set — a green built from nothing (ADR-010).
    expect(Object.keys(kernelInternal).length).toBeGreaterThan(20)
  })

  it('the exclusion lists themselves stay real — every excluded name still exists in the kernel', () => {
    // Guards against the inverse staleness: an excluded name that no longer
    // exists in the kernel silently over-excuses nothing (a passing test for
    // the wrong reason), so pin that every excluded name is still real.
    const kernelNames = new Set(Object.keys(kernel))
    const stale = [...EXCLUDED].filter((name) => !kernelNames.has(name))
    expect(stale).toEqual([])
  })
})
