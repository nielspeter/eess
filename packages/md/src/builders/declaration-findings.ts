import type { ConditionContext } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { collectLinkBlocks, type MdLinkBlock } from '../model/links.js'
import { isLabelAlone, isNearMiss, labelPattern, wrappedLabelOf } from '../model/label.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import { decidingBlock } from '../predicates/declared-block.js'

/** What an `areLabelled()`/`areInSection()` call declared, kept for the declaration scan. */
export type LinkDeclaration =
  | { readonly kind: 'label'; readonly label: string }
  | { readonly kind: 'section'; readonly name: string | RegExp }

/** One key per distinct declaration, so a label declared twice is scanned once. */
export function declarationKey(d: LinkDeclaration): string {
  if (d.kind === 'label') return `label:${d.label}`
  return typeof d.name === 'string' ? `section:${d.name}` : `section-re:${String(d.name)}`
}

/**
 * Plan 0405 — findings about the declarations themselves, scanned over the whole
 * corpus (not the rule's selection: a misspelt declaration is, by definition, not
 * selected). Each names something the selector could not read (ADR-016 rule 7):
 *
 * - **a near-miss label:** a wrapped label (`**Label:**`, `**Label**:`,
 *   `__Label__:`) opening a block that matches the declared one except for case
 *   or inner spacing. The plain `Label:` form is never a near-miss: prose
 *   beginning "related to:" is common;
 * - **a label inside the declaration:** a different wrapped label nested inside
 *   a declaration takes the links under it out of the declaration;
 * - **a label where no block starts:** the label, exact or near, later in a
 *   paragraph, in a table cell or in a heading, where it declares nothing — or
 *   at a block's start in a form the grammar does not read (`**_Label:_**`, a
 *   whole line in bold);
 * - **reference-style links:** a declaration holding `[text][ref]` links, which
 *   eess-md does not read;
 * - **an empty declaration:** a wrapped label selecting no link — it names no
 *   record, or it stands alone with no list directly under it;
 * - **a near-miss section:** a heading that misses a string declaration by case
 *   or spacing (a `RegExp` states its own tolerance).
 */
export function declarationFindings(
  corpus: Corpus,
  declarations: readonly LinkDeclaration[],
  context: ConditionContext,
): ArchViolation[] {
  const out: ArchViolation[] = []
  for (const doc of corpus.documents()) {
    const { links, references, blocks, unreadLabels } = collectLinkBlocks(doc.root, doc.text)
    // Each finding names its kind in its element, so one `.excluding()` sanctions one kind
    // (`→ label "Supersedes" (empty)`), and carries its own remedy as the suggestion.
    const report = (line: number, element: string, message: string, suggestion: string): void => {
      out.push(
        mdViolation({
          file: doc.file,
          line,
          sourceText: doc.text,
          context: { ...context, suggestion },
          element,
          message,
        }),
      )
    }
    for (const d of declarations) {
      if (d.kind === 'section') {
        if (typeof d.name !== 'string') continue
        const declared = d.name
        for (const section of doc.sections) {
          if (!isNearMiss(section.name, declared)) continue
          report(
            section.line,
            `${doc.relPath} → section "${section.name}" (near miss)`,
            `the heading "${section.name}" is not the declared section "${declared}", so the links under it are not checked`,
            `write it "${declared}"`,
          )
        }
        continue
      }
      const L = d.label
      const declared = new RegExp(labelPattern(L))
      const element = (found: string, kind: string): string =>
        `${doc.relPath} → label "${found}" (${kind})`

      for (const block of blocks) {
        const found = wrappedLabelOf(block.text)
        if (found === undefined || !isNearMiss(found, L)) continue
        report(
          block.line,
          element(found, 'near miss'),
          `the label "${found}" is not the declared "${L}", so the links under it are not checked`,
          `write it "${L}"`,
        )
      }

      // Which declaration blocks select a link, which hold a reference, which enclose anything.
      const selects = new Set<number>()
      const holdsReference = new Set<number>()
      const encloses = new Set<number>()
      const taken = new Map<number, string>()
      const classify = (path: readonly MdLinkBlock[], isReference: boolean): void => {
        for (const b of path) encloses.add(b.line)
        const decision = decidingBlock(path, declared)
        if (decision === undefined) return
        if (decision.matches) {
          ;(isReference ? holdsReference : selects).add(decision.block.line)
          return
        }
        const found = wrappedLabelOf(decision.block.text)
        const outer = path.slice(0, decision.at).some((b) => declared.test(b.text))
        if (found !== undefined && outer && !isNearMiss(found, L)) {
          taken.set(decision.block.line, found)
        }
      }
      for (const l of links) classify(l.blockPath ?? [], false)
      for (const path of references) classify(path, true)

      for (const [line, found] of taken) {
        report(
          line,
          element(found, `inside "${L}"`),
          `the label "${found}" sits inside the "${L}" declaration and takes the links under it out of it`,
          `drop the label, or move it out of the "${L}" list`,
        )
      }
      for (const block of blocks) {
        if (!declared.test(block.text)) continue
        if (holdsReference.has(block.line)) {
          report(
            block.line,
            element(L, 'reference links'),
            `the "${L}" declaration holds reference-style links, which eess-md does not read`,
            'write them as inline links ([text](path))',
          )
        } else if (
          wrappedLabelOf(block.text) === L &&
          !selects.has(block.line) &&
          // A link under it that is not selected is already a finding of its own.
          !encloses.has(block.line)
        ) {
          const alone = isLabelAlone(block.text)
          report(
            block.line,
            element(L, 'empty'),
            alone
              ? `the "${L}" label stands alone with no list directly under it, so it declares nothing`
              : `the "${L}" declaration names no record`,
            alone
              ? 'put its list right after it, or its links on its line'
              : 'add the links it declares, or remove the label',
          )
        }
      }
      for (const u of unreadLabels) {
        if (u.label !== L && !isNearMiss(u.label, L)) continue
        report(
          u.line,
          element(u.label, u.reason === 'format' ? 'formatting' : 'not at a block start'),
          u.reason === 'format'
            ? `the label "${u.label}" is written with formatting eess-md does not read, so the links after it are not read as a declaration`
            : `the label "${u.label}" is not at the start of a paragraph or list item, so the links after it are not read as a declaration`,
          u.reason === 'format' ? `write it **${L}:**` : 'start a paragraph or list item with it',
        )
      }
    }
  }
  return out
}
