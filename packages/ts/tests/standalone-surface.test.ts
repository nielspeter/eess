import { describe, it, expect } from 'vitest'
import * as kernel from '@nielspeter/eess'
import * as tsRoot from '../src/index.js'
import * as tsPresets from '../src/presets/index.js'

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

// The dialect-family-only surface (plan 0088 Phase 4's own named exception):
// serves crossvalidate/md's two-sided binding, not a standalone ts user.
// correspondence()/matchSelections()/applyFixes() and their direct
// companions stay kernel-only on purpose.
const FAMILY_ONLY = new Set([
  'correspondence',
  'CorrespondenceBuilder',
  'matchSelections',
  'applyFixes',
])

// Kernel-internal plumbing the kernel's own index.ts comments name as
// "used by dialects and covered by kernel tests" — implementation detail,
// not part of the surface a standalone ts consumer builds against.
const KERNEL_INTERNAL = new Set([
  'applyFilters',
  'escapeGitHub',
  'hashViolation',
  'writeStderr',
  'registerCacheReset',
  'clearRegisteredCaches',
  'selectionMemo',
])

// ANSI color helpers — terminal-formatting internals, not part of the
// programmatic surface.
const ANSI_INTERNAL = new Set(['bold', 'red', 'dim', 'yellow', 'cyan', 'gray'])

const EXCLUDED = new Set([...FAMILY_ONLY, ...KERNEL_INTERNAL, ...ANSI_INTERNAL])

describe('standalone sufficiency: eess-ts re-exports the kernel surface it owns (plan 0088)', () => {
  it('every non-excluded kernel value export is reachable from eess-ts (root or presets subpath)', () => {
    const reachable = new Set([...Object.keys(tsRoot), ...Object.keys(tsPresets)])
    const missing = Object.keys(kernel).filter(
      (name) => !EXCLUDED.has(name) && !reachable.has(name),
    )
    expect(missing).toEqual([])
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
