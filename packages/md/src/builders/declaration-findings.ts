import type { ConditionContext } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { collectLinkBlocks } from '../model/links.js'
import { isLabelAlone, isNearMiss, labelPattern, wrappedLabelOf } from '../model/label.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'

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
 * selected). Each says what the selector could not read (ADR-016 rule 7):
 *
 * - **a near-miss label:** a wrapped label (`**Label:**`, `**Label**:`,
 *   `__Label__:`) that matches the declared one except for case or inner
 *   spacing. The plain `Label:` form is never a near-miss: prose beginning
 *   "related to:" is common;
 * - **a label inside a paragraph:** a wrapped label, exact or near, on a
 *   paragraph's second or later line, where it owns nothing;
 * - **reference-style links:** a block declared under the label, in any form,
 *   that holds `[text][ref]` links, which eess-md does not read;
 * - **an empty declaration:** a wrapped label with no link in its block — and,
 *   when the label stands alone, no list directly under it;
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
    const { blocks, midBlockLabels } = collectLinkBlocks(doc.root, doc.text)
    const at = (line: number) => ({ file: doc.file, line, sourceText: doc.text, context })
    for (const d of declarations) {
      if (d.kind === 'label') {
        const declared = new RegExp(labelPattern(d.label))
        for (const block of blocks) {
          const found = wrappedLabelOf(block.text)
          const element = `${doc.relPath} → label "${found ?? d.label}"`
          if (found !== undefined && isNearMiss(found, d.label)) {
            out.push(
              mdViolation({
                ...at(block.line),
                element,
                message:
                  `the label "${found}" is not the declared "${d.label}", so the links under it are not checked — ` +
                  `write it "${d.label}"`,
              }),
            )
            continue
          }
          if (!declared.test(block.text)) continue
          if (block.references > 0) {
            out.push(
              mdViolation({
                ...at(block.line),
                element,
                message:
                  `the "${d.label}" declaration holds reference-style links, which eess-md does not read — ` +
                  'write them as inline links ([text](path))',
              }),
            )
          } else if (found === d.label && block.links === 0) {
            out.push(
              mdViolation({
                ...at(block.line),
                element,
                message: isLabelAlone(block.text)
                  ? `the "${d.label}" label stands alone with no list directly under it, so it declares nothing — ` +
                    'put its list right after it, or its links on its line'
                  : `the "${d.label}" declaration names no record — add the links it declares, or remove the label`,
              }),
            )
          }
        }
        for (const mid of midBlockLabels) {
          const found = wrappedLabelOf(mid.text)
          if (found === undefined || (found !== d.label && !isNearMiss(found, d.label))) continue
          out.push(
            mdViolation({
              ...at(mid.line),
              element: `${doc.relPath} → label "${found}"`,
              message:
                `the label "${found}" is inside a paragraph, not at its start, so the links after it are not read as a declaration — ` +
                'start a new paragraph with it',
            }),
          )
        }
      } else if (typeof d.name === 'string') {
        const declared = d.name
        for (const section of doc.sections) {
          if (!isNearMiss(section.name, declared)) continue
          out.push(
            mdViolation({
              ...at(section.line),
              element: `${doc.relPath} → section "${section.name}"`,
              message:
                `the heading "${section.name}" is not the declared section "${declared}", so the links under it are not checked — ` +
                `write it "${declared}"`,
            }),
          )
        }
      }
    }
  }
  return out
}
