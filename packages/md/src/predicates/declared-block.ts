import type { ConditionContext, Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdLink } from '../model/links.js'
import { collectLinkBlocks } from '../model/links.js'
import { isNearMiss, labelPattern, wrappedLabelOf } from '../model/label.js'
import { matchName } from '../model/query.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'

/**
 * Plan 0405 — select the links a block declares.
 *
 * These factories are deliberately NOT exported from the package root, the same
 * as `areInternal`/`areLive`: the near-miss check lives in `LinkRuleBuilder`,
 * which records the declaration when `areLabelled()`/`areInSection()` is called.
 * A raw predicate composed through `satisfy()`/`not()`/`or()` would select
 * without recording anything, and so without the near-miss check.
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
    test: (l) => (l.sectionPath ?? []).some((h) => matchName(h, name)),
  }
}

/** What an `areLabelled()`/`areInSection()` call declared, kept for the near-miss scan. */
export type LinkDeclaration =
  | { readonly kind: 'label'; readonly label: string }
  | { readonly kind: 'section'; readonly name: string | RegExp }

/**
 * Findings about the declarations themselves, scanned over the whole corpus (not
 * the rule's selection — a misspelt declaration is, by definition, not selected):
 *
 * - **a near-miss label:** a wrapped label (`**Label:**`, `**Label**:`,
 *   `__Label__:`) that matches the declared one except for case or inner
 *   spacing. The plain `Label:` form is never a near-miss: prose beginning
 *   "related to:" is common;
 * - **a near-miss section:** a heading that does the same for a string
 *   declaration (a `RegExp` states its own tolerance);
 * - **a declaration nothing can read:** a wrapped label matching exactly whose
 *   block holds only reference-style links, or no link at all (ADR-016 rule 7:
 *   an instrument says what it cannot see).
 */
export function declarationFindings(
  corpus: Corpus,
  declarations: readonly LinkDeclaration[],
  context: ConditionContext,
): ArchViolation[] {
  const out: ArchViolation[] = []
  for (const doc of corpus.documents()) {
    const { blocks } = collectLinkBlocks(doc.root, doc.text)
    for (const d of declarations) {
      if (d.kind === 'label') {
        for (const block of blocks) {
          const found = wrappedLabelOf(block.text)
          if (found === undefined) continue
          const at = { file: doc.file, line: block.line, sourceText: doc.text, context }
          if (isNearMiss(found, d.label)) {
            out.push(
              mdViolation({
                ...at,
                element: `${doc.relPath} → label "${found}"`,
                message:
                  `the label "${found}" is not the declared "${d.label}", so the links under it are not checked — ` +
                  `write it "${d.label}"`,
              }),
            )
          } else if (found === d.label && block.links === 0) {
            out.push(
              mdViolation({
                ...at,
                element: `${doc.relPath} → label "${found}"`,
                message:
                  block.references > 0
                    ? `the "${found}" declaration holds only reference-style links, which eess-md does not read — ` +
                      'write them as inline links ([text](path))'
                    : `the "${found}" declaration names no record — add the links it declares, or remove the label`,
              }),
            )
          }
        }
      } else if (typeof d.name === 'string') {
        const declared = d.name
        for (const section of doc.sections) {
          if (!isNearMiss(section.name, declared)) continue
          out.push(
            mdViolation({
              file: doc.file,
              line: section.line,
              sourceText: doc.text,
              context,
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
