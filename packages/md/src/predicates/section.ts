import type { Predicate } from '@nielspeter/eess'
import { checkDepth, matchName } from '../model/name-match.js'
import { contains, sectionsMatching, type MdSectionElement } from '../model/sections.js'
import { declaresSections } from '../model/section-declarations.js'
import { holdingText, holds, type SectionHolding } from '../model/section-holds.js'
import { areInSectionPredicate } from './declared-block.js'

/**
 * Plan 0496: the predicates over sections. Each that reads a section name records it in the
 * section-name registry, so the rule that holds it scans for a heading it cannot read. `areInSection`
 * is not here: it is `areInSectionPredicate` (`declared-block.ts`), one factory for links and
 * sections.
 */

/** The heading text matches `name`: a string exactly, or a `RegExp`, as `haveSection` matches. */
export function sectionsNamed(name: string | RegExp): Predicate<MdSectionElement> {
  return declaresSections(
    { description: `are named "${String(name)}"`, test: (s) => matchName(s.name, name) },
    [{ name }],
  )
}

/**
 * Sections under a heading matching `name`, at any depth above them: the root form of
 * `sections().that().areInSection()`, one factory with `links().areInSection()`.
 */
export function sectionsInSection(name: string | RegExp): Predicate<MdSectionElement> {
  return areInSectionPredicate<MdSectionElement>(name)
}

/** The heading level is `depth` (1 to 6; anything else is refused). */
export function sectionsAtDepth(depth: number): Predicate<MdSectionElement> {
  checkDepth(depth, 'areAtDepth')
  return { description: `are at depth ${String(depth)}`, test: (s) => s.depth === depth }
}

/** Options for a subsection: the depth it must sit at, when it matters. */
export interface SubsectionOptions {
  /** The subsection's heading level (1 to 6). Without it, any depth below the section counts. */
  readonly depth?: number
}

/** The sections inside `section` (its heading line excluded) whose name matches, at `depth` if given. */
export function subsectionsOf(
  section: MdSectionElement,
  name: string | RegExp,
  depth?: number,
): readonly MdSectionElement[] {
  return sectionsMatching(section.doc, name, depth).filter(
    (x) => x.line > section.line && contains(section, x.line),
  )
}

/** How a finding or a description names a subsection: `"X"`, or `"X" at depth 3`. */
export const subsectionText = (name: string | RegExp, depth: number | undefined): string =>
  `"${String(name)}"${depth === undefined ? '' : ` at depth ${String(depth)}`}`

/** Sections that contain a section of `name` (at `depth`, when given). */
export function sectionsWithSubsection(
  name: string | RegExp,
  options: SubsectionOptions = {},
): Predicate<MdSectionElement> {
  checkDepth(options.depth, 'haveSubsection')
  return declaresSections(
    {
      description: `have subsection ${subsectionText(name, options.depth)}`,
      test: (s) => subsectionsOf(s, name, options.depth).length > 0,
    },
    [{ name, ...(options.depth === undefined ? {} : { depth: options.depth }) }],
  )
}

/** Plan 0522: sections that hold what `h` names (`.that().haveLink()` and its siblings). */
export function sectionsHolding(h: SectionHolding): Predicate<MdSectionElement> {
  return { description: `hold ${holdingText(h)}`, test: (s) => holds(s, h) }
}
