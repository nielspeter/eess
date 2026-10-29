import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'

/**
 * A condition on `docs()` whose own findings the builder collects after the kernel's run (plans 0495
 * and 0556): `agreeWithFolder` and `agreeWithPath`. The kernel's `examined` (the documents selected)
 * stands; an agreement that judged none of a non-empty selection says so through `findings`, so that
 * neither `.expectEmpty()` nor another condition's count can make it pass.
 *
 * An instance is shared by the forks of one chain (`copy()` is shallow): `start()` resets its run
 * state, and a run is synchronous, so each run reads only its own.
 */
export interface Agreement {
  readonly condition: Condition<MdDocument>
  /** Before a run: refuse a malformed declaration, and forget the last run. */
  start(): void
  /** After the kernel's run: the agreement's own findings, each unsuppressable. */
  findings(context: ConditionContext): ArchViolation[]
}

/** A declaration finding: about the rule, not a document, so no suppression reaches it. */
export function declarationViolation(
  element: string,
  message: string,
  context: ConditionContext,
  file = '',
  line = 0,
): ArchViolation {
  return { ...mdViolation({ element, file, line, message, context }), bypassFilters: true }
}
