import type { Predicate, Undecided } from '@nielspeter/eess'
import { membership, type Membership } from '@nielspeter/eess/internal'
import type { MdDocument } from './document.js'
import { sectionsMatching, type MdSectionElement } from './sections.js'

/**
 * Strong Kleene `any` over sections (ADR-021): true when one is true, else the causes of those that
 * cannot be judged, else false. The one fold `inSections` and `haveSection`'s `satisfying` option
 * read (plan 0582), so "some section satisfies p" is decided one way.
 */
export function anyMembership(memberships: readonly Membership[]): Membership {
  if (memberships.some((m) => m === true)) return true
  const causes: Undecided[] = memberships.flatMap((m) => (m === true || m === false ? [] : [...m]))
  return causes.length > 0 ? causes : false
}

/** Each section's membership under `p`, by the kernel's one truth table. */
export function sectionVerdicts(
  sections: readonly MdSectionElement[],
  p: Predicate<MdSectionElement>,
): Membership[] {
  return sections.map((s) => membership([p], 'all', s))
}

/** The sections of `doc` matching `name` (at `depth`), each judged by `p`, and the document's verdict. */
interface SatisfyingReading {
  readonly matching: readonly MdSectionElement[]
  readonly verdicts: readonly Membership[]
  /** Strong Kleene `any` over `verdicts`. */
  readonly membership: Membership
}

/**
 * How `haveSection(name, { satisfying: p })` reads one document (plan 0582), memoised per document
 * for one predicate, so its `undecided()` and `test()` and the condition read it once.
 */
export function satisfyingReader(
  name: string | RegExp,
  depth: number | undefined,
  p: Predicate<MdSectionElement>,
): (doc: MdDocument) => SatisfyingReading {
  const memo = new WeakMap<MdDocument, SatisfyingReading>()
  return (doc) => {
    const known = memo.get(doc)
    if (known !== undefined) return known
    const matching = sectionsMatching(doc, name, depth)
    const verdicts = sectionVerdicts(matching, p)
    const fresh = { matching, verdicts, membership: anyMembership(verdicts) }
    memo.set(doc, fresh)
    return fresh
  }
}

/** The description's suffix for the option: ` satisfying "hold a code pointer"`. */
export const satisfyingText = (p: Predicate<MdSectionElement>): string =>
  ` satisfying "${p.description}"`
