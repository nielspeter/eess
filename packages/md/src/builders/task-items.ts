import { RuleBuilder, type Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
import { collectTaskItems, type MdTaskItemRef } from '../model/task-items.js'

/** A task-item element: a task-list item plus its containing document. */
export interface MdTaskItem extends MdTaskItemRef {
  readonly doc: MdDocument
}

const areOpen = (): Predicate<MdTaskItem> => ({
  description: 'are open',
  test: (t) => !t.checked,
})
const areChecked = (): Predicate<MdTaskItem> => ({
  description: 'are checked',
  test: (t) => t.checked,
})

/**
 * Rule builder over the corpus's GFM task-list items (`- [ ]` / `- [x]`).
 */
export class TaskItemRuleBuilder extends RuleBuilder<MdTaskItem, Corpus> {
  protected getElements(): MdTaskItem[] {
    return this.project
      .documents()
      .flatMap((doc) => collectTaskItems(doc.root).map((t) => ({ ...t, doc })))
  }

  /** Filter to open boxes (`- [ ]`). */
  areOpen(): this {
    return this.addPredicate(areOpen())
  }

  /** Filter to checked boxes (`- [x]`). */
  areChecked(): this {
    return this.addPredicate(areChecked())
  }
}

/** Entry point: build rules over the corpus's task-list items. */
export function taskItems(corpus: Corpus): TaskItemRuleBuilder {
  return new TaskItemRuleBuilder(corpus)
}
