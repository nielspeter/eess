import { collectResult, type CollectResult, type Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import {
  collectTaskItems,
  validateMarks,
  type BoxMarkState,
  type TaskItemOptions,
} from '../model/task-items.js'
import { stampedByDocument } from '../model/by-document.js'
import { atLine, type MdLocation } from '../conditions/not-exist.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
import { inScope, unreadFindings, type ReadBox, type UnreadBox } from './box-mark-findings.js'

/**
 * A read box: what a `taskItems()` rule sees. Its `state` is only `'open'` or `'done'`; an unread
 * box is reported, never handed to a rule. To select an undeclared box, test `t.mark`.
 */
export type MdTaskItem = ReadBox

const isRead = (state: string): state is BoxMarkState => state === 'open' || state === 'done'

const areOpen = (): Predicate<MdTaskItem> => ({
  description: 'are open',
  test: (t) => t.state === 'open',
})
const areChecked = (): Predicate<MdTaskItem> => ({
  description: 'are checked',
  test: (t) => t.state === 'done',
})

/**
 * Rule builder over the corpus's boxes: GFM's `- [ ]` / `- [x]`, and the marks the caller declares
 * (plan 0454). A box with a mark no one declared, or a near-GFM box, is never an element: a rule
 * whose predicates reach it reports it.
 */
export class TaskItemRuleBuilder extends CorpusRuleBuilder<MdTaskItem> {
  constructor(
    corpus: Corpus,
    private readonly opts: TaskItemOptions = {},
  ) {
    super(corpus)
    validateMarks(opts.marks, 'taskItems')
  }

  private boxes(): UnreadBox[] {
    const marks = this.opts.marks
    return stampedByDocument(this.project, (doc) =>
      collectTaskItems(doc.root, { marks, source: doc.text }),
    )
  }

  protected getElements(): MdTaskItem[] {
    const out: MdTaskItem[] = []
    for (const box of this.boxes()) {
      const state = box.state
      if (isRead(state)) out.push({ ...box, state })
    }
    return out
  }

  /** The kernel's verdict, plus a finding for each unread box this rule's predicates reach. */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    const unread = this.boxes().filter((box) => !isRead(box.state))
    const reached = inScope(unread, this._predicates)
    if (reached.length === 0) return base
    // The kernel's evidence, passed through whole.
    return collectResult([...base, ...unreadFindings(reached, base.examined === 0)], base)
  }

  protected locate(t: MdTaskItem): MdLocation {
    return atLine(t)
  }

  /** Filter to open boxes: `[ ]`, and every mark declared `'open'`. */
  areOpen(): this {
    return this.addPredicate(areOpen())
  }

  /** Filter to done boxes: `[x]`, and every mark declared `'done'`. */
  areChecked(): this {
    return this.addPredicate(areChecked())
  }
}

/**
 * Entry point: build rules over the corpus's boxes. Declare each box mark beyond GFM's in `marks`,
 * open or done: `taskItems(c, { marks: { '~': 'open' } })`.
 */
export function taskItems(corpus: Corpus, options: TaskItemOptions = {}): TaskItemRuleBuilder {
  return new TaskItemRuleBuilder(corpus, options)
}
