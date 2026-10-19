import type { Condition, Predicate } from '@nielspeter/eess'
import { stateless } from '../model/name-match.js'
import type { MdDocument } from '../model/document.js'
import { mdViolation } from '../model/violation.js'

/**
 * Plan 0503 — the free predicate twin of `taskItems().haveTextMatching()` (ADR-023 clause 2: the
 * method keeps the plain word): elements whose `text` matches the caller's pattern: a box's text (all of its own
 * content, bug 0507), and any other element that carries one. The pattern is read without `g` and
 * `y`, so `lastIndex` never carries from one element to the next. eess-md fixes no words: each
 * caller passes its own pattern.
 */
export function predicateHaveTextMatching<T extends { readonly text: string }>(
  re: RegExp,
): Predicate<T> {
  const pattern = stateless(re)
  return { description: `have text matching ${String(re)}`, test: (e) => pattern.test(e.text) }
}

/** `taskItems().haveTextMatching()` after `.should()`: every selected element's text matches, or it is a finding. */
export function haveTextMatchingCondition<
  T extends { readonly text: string; readonly doc: MdDocument; readonly line: number },
>(re: RegExp, noun: string): Condition<T> {
  const pattern = stateless(re)
  return {
    description: `have text matching ${String(re)}`,
    evaluate: (elements, ctx) =>
      elements
        .filter((e) => !pattern.test(e.text))
        .map((e) =>
          mdViolation({
            element: `${e.doc.relPath}:${String(e.line)}`,
            file: e.doc.file,
            line: e.line,
            message: `the ${noun}'s text does not match ${String(re)}: "${e.text}"`,
            sourceText: e.doc.text,
            context: ctx,
          }),
        ),
  }
}
