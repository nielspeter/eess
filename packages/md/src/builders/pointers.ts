import { RuleBuilder, type Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { extractPointers, type MdPointer, type MdPointerRef } from '../model/pointers.js'
import { pointerResolves, type PointerResolveOptions } from '../conditions/pointer-resolve.js'

/** A code-pointer element: a pointer occurrence plus its containing document. */
export type { MdPointer } from '../model/pointers.js'

const areLive = (): Predicate<MdPointer> => ({
  description: 'are live (not in a frozen folder)',
  test: (p) => !p.doc.frozen,
})
const areFrozen = (): Predicate<MdPointer> => ({
  description: 'are frozen (historical record)',
  test: (p) => p.doc.frozen,
})

/**
 * Rule builder over the corpus's `path:line` code pointers.
 */
export class PointerRuleBuilder extends RuleBuilder<MdPointer, Corpus> {
  protected getElements(): MdPointer[] {
    return this.project
      .documents()
      .flatMap((doc) =>
        extractPointers(doc.text, doc.root).map((p: MdPointerRef) => ({ ...p, doc })),
      )
  }

  /** Filter to pointers in live documents (not in a frozen folder). */
  areLive(): this {
    return this.addPredicate(areLive())
  }

  /** Filter to pointers in frozen documents (historical records). */
  areFrozen(): this {
    return this.addPredicate(areFrozen())
  }

  /**
   * Condition: pointers resolve to a real file with the line in range. By
   * default a pointer resolves by unique path-suffix (`admin/index.vue` matches
   * the one file ending in it); pass `{ paths: 'exact' }` to require full
   * repo-relative paths.
   */
  resolve(options?: PointerResolveOptions): this {
    return this.addCondition(pointerResolves(this.project, options))
  }
}

/** Entry point: build rules over the corpus's code pointers. */
export function pointers(corpus: Corpus): PointerRuleBuilder {
  return new PointerRuleBuilder(corpus)
}
