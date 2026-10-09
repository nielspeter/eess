import type { Predicate } from '@nielspeter/eess'
import type { MdLink, MdLinkBlock } from '../model/links.js'
import { labelPattern, wrappedLabelOf } from '../model/label.js'
import { inSection } from '../model/query.js'

/**
 * Plan 0405 — select the links a block declares.
 *
 * These factories are deliberately NOT exported from the package root, the same
 * as `areInternal`/`areLive`: the declaration scan lives in `LinkRuleBuilder`,
 * which records the declaration when `areLabelled()`/`areInSection()` is called.
 * A raw predicate composed through `satisfy()`/`not()`/`or()` would select
 * without recording anything, and so without the scan.
 */

/**
 * The block that decides whether a link with this `path` is declared under the
 * label `declared` matches: walking from the innermost block outwards, the first
 * that either matches it (any form, exact case) or opens with a wrapped label of
 * its own. A plain line that is not the label — `bug 0402: [b](b.md)`,
 * `Metadata:`, a URL — never decides, so it neither hides a declaration nor
 * captures one.
 */
export function decidingBlock(
  path: readonly MdLinkBlock[],
  declared: RegExp,
): { readonly block: MdLinkBlock; readonly at: number; readonly matches: boolean } | undefined {
  for (let at = path.length - 1; at >= 0; at--) {
    const block = path[at]
    if (block === undefined) continue
    if (declared.test(block.text)) return { block, at, matches: true }
    if (wrappedLabelOf(block.text) !== undefined) return { block, at, matches: false }
  }
  return undefined
}

/** Links declared under `label` (case-sensitive), in any label form, at any depth below it. */
export function areLabelledPredicate(label: string): Predicate<MdLink> {
  const re = new RegExp(labelPattern(label))
  return {
    description: `are declared under the label "${label}"`,
    test: (l) => decidingBlock(l.blockPath ?? [], re)?.matches === true,
  }
}

/** Links under a heading matching `name` (a string exactly, or a `RegExp`), at any depth beneath it. */
export function areInSectionPredicate(name: string | RegExp): Predicate<MdLink> {
  return {
    description: `are in section "${String(name)}"`,
    test: (l) => inSection(l, name),
  }
}
