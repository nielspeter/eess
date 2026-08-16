import picomatch from 'picomatch'
import type { GlobLeaf, GlobNode, GlobSite, PathUniverse } from '@nielspeter/eess'
import { isGlobNode, isOpaqueGlob, viewsFor } from '@nielspeter/eess'
import { syntacticFault } from './glob-diagnosis.js'

/**
 * Whether a glob tree can never match anything in this project.
 *
 * This is checked exhaustively rather than argued about: soundness is the
 * requirement — a fault is justified only if the expression selects the
 * empty set for every possible value of the leaves this function cannot
 * see, since all it knows is that a dead site matches nothing. A confident
 * but unsound verdict here fails a working rule, which is worse than the
 * silence this whole subsystem exists to remove.
 *
 * The three rules, and what each one is load-bearing for:
 *
 * - **A negative site is never dead.** `not(unsatisfiable)` selects
 *   *everything*; that is over-selection, not vacuity.
 * - **An opaque leaf is never dead**, and is never dropped. See `OpaqueGlob`.
 * - **`all` is dead if any child is; `any` is dead only if every child is.**
 *   Which is why `negateGlobs` has to invert `op` and not just polarity.
 */
export function isDeadGlobTree(node: GlobNode, universe: PathUniverse): boolean {
  return node.op === 'all'
    ? node.children.some((child) => isDeadChild(child, universe))
    : // `every` on an empty array is `true`, which would fault a rule that
      // declares no globs at all. Unreachable, because every combinator
      // contributes one child per input and a missing declaration becomes
      // an opaque leaf rather than nothing — but stated, not assumed.
      node.children.length > 0 && node.children.every((child) => isDeadChild(child, universe))
}

function isDeadChild(child: GlobNode | GlobLeaf<GlobSite>, universe: PathUniverse): boolean {
  if (isGlobNode(child)) return isDeadGlobTree(child, universe)
  if (isOpaqueGlob(child)) return false
  return isDeadSite(child, universe)
}

/**
 * Whether one site's glob matches nothing in the project.
 *
 * Two independent ways to be dead, and both are needed:
 *
 * 1. **Syntactically** — a project-relative glob on a predicate that
 *    matches absolute paths can never match, whatever the project contains.
 * 2. **Against the universe** — anchored, well-formed, and nothing there.
 *
 * The syntactic check is not redundant: the universe carries a
 * tsconfig-relative view so that a wrong `base` cannot make a glob look
 * unmatched, and a project-relative-looking glob can match that view while
 * matching nothing at runtime, where the real predicate reads absolute
 * paths. Unanchored globs are the commonest real mistake, so a design that
 * quietly calls them satisfiable defeats the whole point.
 *
 * Only `file-path` and `parent-dir` are checkable; `viewsFor` returns no
 * views for the others, and a site with no views is never dead.
 */
export function isDeadSite(site: GlobSite, universe: PathUniverse): boolean {
  if ((site.polarity ?? 'positive') === 'negative') return false
  const views = viewsFor(universe, site.kind)
  if (views.length === 0) return false
  if (syntacticFault(site.glob, site.kind, site.base) !== undefined) return true
  const isMatch = picomatch(site.glob)
  // Never `view.some(isMatch)` — picomatch reads the array index as its
  // second argument and returns a truthy object from index 1 onwards.
  return !views.some((view) => view.some((candidate) => isMatch(candidate)))
}

/** Every site in a tree, in declaration order. Opaque leaves are skipped. */
export function globSitesOf(node: GlobNode): GlobSite[] {
  const sites: GlobSite[] = []
  const walk = (current: GlobNode): void => {
    for (const child of current.children) {
      if (isGlobNode(child)) walk(child)
      else if (!isOpaqueGlob(child)) sites.push(child)
    }
  }
  walk(node)
  return sites
}
