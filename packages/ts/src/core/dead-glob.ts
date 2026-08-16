import type { GlobNode, GlobSite, PathUniverse } from '@nielspeter/eess'
import type { ArchProject } from './project.js'
import type { DiskSet } from '@nielspeter/eess'
import { pathUniverse } from './path-universe.js'
import { diskSet } from './disk-set.js'
import { isDeadGlobTree, isDeadSite, globSitesOf } from './glob-evaluator.js'
import { diagnoseGlob, FAULT_ADVICE, ON_DISK_ADVICE } from './glob-diagnosis.js'

/**
 * A rule examined zero elements. If one of its declared globs
 * (`RuleBuilder.globs()`) is diagnosably dead, name it and why — the
 * specific reason `TerminalBuilder.deadGlobViolation()` prefers over the
 * generic "examined zero units" message.
 *
 * `undefined` means "no diagnosis" — no glob was declared, or every declared
 * glob is live (so the zero-examined result is a real, empty corpus, not a
 * broken selector). Only the FIRST dead site across all declared trees is
 * reported: `evidencedViolations()` only has room for one message, and the
 * first declared predicate/condition is the one a reader fixes first anyway.
 */
export function diagnoseDeadGlobs(
  project: ArchProject,
  trees: readonly GlobNode[],
): string | undefined {
  const universe = pathUniverse(project)
  for (const tree of trees) {
    if (!isDeadGlobTree(tree, universe)) continue
    // Only materialized once a tree is confirmed dead — `diskSet()` walks
    // the filesystem, and most rules never reach this line at all (this
    // whole function only runs when a rule already examined zero elements).
    const disk = diskSet(project)
    for (const site of globSitesOf(tree)) {
      if (isDeadSite(site, universe)) return describeDeadSite(site, universe, disk)
    }
  }
  return undefined
}

function describeDeadSite(site: GlobSite, universe: PathUniverse, disk: DiskSet): string {
  const diagnosis = diagnoseGlob(site, universe, disk)
  const advice = FAULT_ADVICE[diagnosis.fault]
  const onDiskAdvice = diagnosis.onDisk !== undefined ? ON_DISK_ADVICE[diagnosis.onDisk] : ''
  const onDiskNote = onDiskAdvice !== '' ? ` ${onDiskAdvice}.` : ''
  return `${site.origin} — "${site.glob}" can never match: ${advice}.${onDiskNote}`
}
