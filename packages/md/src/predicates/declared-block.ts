import type { Predicate } from '@nielspeter/eess'
import type { MdLink } from '../model/links.js'
import { labelPattern } from '../model/label.js'
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

/** Links owned by a block whose label is exactly `label` (case-sensitive), in any label form. */
export function areLabelledPredicate(label: string): Predicate<MdLink> {
  const re = new RegExp(labelPattern(label))
  return {
    description: `are declared under the label "${label}"`,
    test: (l) => l.block !== undefined && re.test(l.block.text),
  }
}

/** Links under a heading matching `name` (a string exactly, or a `RegExp`), at any depth beneath it. */
export function areInSectionPredicate(name: string | RegExp): Predicate<MdLink> {
  return {
    description: `are in section "${String(name)}"`,
    test: (l) => inSection(l, name),
  }
}
