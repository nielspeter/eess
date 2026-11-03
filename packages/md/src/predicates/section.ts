import { ArchConfigError, type Predicate, type Undecided } from '@nielspeter/eess'
import { checkDepth, matchName } from '../model/name-match.js'
import { contains, sectionsMatching, type MdSectionElement } from '../model/sections.js'
import { declaresSections } from '../model/section-declarations.js'
import { holdingText, holds, undecidingLinks, type SectionHolding } from '../model/section-holds.js'
import { unreadLinkReason, unreadLinkRemedy } from '../model/unread-link.js'
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

/**
 * Plan 0522: sections that hold what `h` names (`.that().haveLink()` and its siblings). A section
 * whose only links are HTML links eess-md cannot read is undecided for `link` (plan 0580, R6;
 * ADR-021): the rule reports each site rather than drop the section, and `test` refuses it, so a
 * wrapper written around `test` cannot drop it silently.
 */
export function sectionsHolding(h: SectionHolding): Predicate<MdSectionElement> {
  const undecided = (s: MdSectionElement): readonly Undecided[] =>
    undecidingLinks(s, h).map((u) => ({
      file: u.doc.file,
      line: u.line,
      element: `${u.doc.relPath}:${String(u.line)}`,
      message: `${unreadLinkReason(u)}, so whether its section holds a link cannot be judged. ${unreadLinkRemedy(u)}`,
    }))
  // Only `link` can be undecided: declaring it for the others would turn off the kernel's two-valued
  // fast path for every `haveContent()` and its siblings, for nothing.
  if (h.kind !== 'link') return { description: `hold ${holdingText(h)}`, test: (s) => holds(s, h) }
  return {
    description: `hold ${holdingText(h)}`,
    undecided,
    test: (s) => {
      const [first] = undecided(s)
      if (first !== undefined) {
        throw new ArchConfigError(
          first.element,
          `haveLink cannot judge section "${s.name}": ${first.message}. Apply it through a rule, which ` +
            'reports this, or forward its undecided() with its test() (ADR-021).',
        )
      }
      return holds(s, h)
    },
  }
}
