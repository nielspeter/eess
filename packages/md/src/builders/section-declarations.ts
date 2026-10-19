import type { ConditionContext } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
import { isNearMiss } from '../model/label.js'
import { hasSection } from '../model/query.js'
import { headingNotes } from '../model/sections.js'
import type { SectionDeclaration } from '../model/section-declarations.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'

/** What the scan needs from the rule that holds the declarations. */
export interface SectionScan {
  readonly corpus: Corpus
  readonly declarations: readonly SectionDeclaration[]
  /** The documents the rule's document scopes admit: the container and depth notes read only these. */
  readonly visible: readonly MdDocument[]
  readonly context: ConditionContext
  /** Why a near miss matters, for this builder's elements: `the links under it are not checked`. */
  readonly missReason: string
  /** `file:line` of every heading a condition's finding already names (ADR-009 rule 2). */
  readonly cited: ReadonlySet<string>
  /** Whether a heading in a container is named. `links()` reads them until bug 0502 is fixed. */
  readonly containerNotes: boolean
}

/**
 * Plan 0496 — one scan for a section name a rule cannot read, shared by every builder over a
 * corpus (it was `links().areInSection()`'s, plan 0405). Reports once per heading, in two reaches:
 *
 * - **over the whole corpus**, a heading that misses a string name only by case or spacing: a
 *   misspelling is by definition not selected, so the scan looks everywhere (a `RegExp` states its
 *   own tolerance);
 * - **over the documents the rule can see**, a heading of the name inside a list item, blockquote
 *   or footnote definition, which does not start a section; and, for a declaration with a depth, a
 *   document whose headings of the name are all at other depths.
 *
 * It examines nothing the rule asserts over, so it never raises `examined`. What it does not see: a
 * literal predicate built by hand records nothing, a depth alone names no heading, and a document
 * outside the rule's scopes gets only the case/spacing note.
 */
export function sectionDeclarationFindings(scan: SectionScan): ArchViolation[] {
  const out: ArchViolation[] = []
  const reported = new Set<string>(scan.cited)
  const visible = new Set(scan.visible)
  const report = (
    doc: MdDocument,
    line: number,
    element: string,
    message: string,
    suggestion: string,
  ): void => {
    const key = `${doc.file}:${String(line)}`
    if (reported.has(key)) return
    reported.add(key)
    out.push(
      mdViolation({
        file: doc.file,
        line,
        sourceText: doc.text,
        context: { ...scan.context, suggestion },
        element,
        message,
      }),
    )
  }
  for (const doc of scan.corpus.documents()) {
    for (const d of scan.declarations) {
      if (typeof d.name !== 'string') continue
      const declared = d.name
      for (const section of doc.sections) {
        if (!isNearMiss(section.name, declared)) continue
        report(
          doc,
          section.line,
          `${doc.relPath} → section "${section.name}" (near miss)`,
          `the heading "${section.name}" is not the declared section "${declared}", so ${scan.missReason}`,
          `write it "${declared}"`,
        )
      }
    }
    if (!visible.has(doc)) continue
    for (const d of scan.declarations) {
      // A document that has the name at the declared depth reads it: its other-depth headings are
      // subsections or other sections, not a misplaced one.
      const atDepth = d.depth === undefined || hasSection(doc, d.name, d.depth)
      for (const n of headingNotes(doc, d.name, atDepth ? {} : { depth: d.depth })) {
        if (n.kind === 'depth') {
          report(
            doc,
            n.line,
            `${doc.relPath} → section "${n.heading}" (depth ${String(n.depth)})`,
            `${n.note}, and this rule reads depth ${String(d.depth)}`,
            `make it a depth-${String(d.depth)} heading, or declare the depth this document uses`,
          )
        } else if (scan.containerNotes) {
          report(
            doc,
            n.line,
            `${doc.relPath} → section "${n.heading}" (in a ${n.kind})`,
            `${n.note}, so this rule does not read it`,
            `move the heading out of the ${n.kind}, or write it as text`,
          )
        }
      }
    }
  }
  return out
}
