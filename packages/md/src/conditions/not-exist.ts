import type { Condition } from '@nielspeter/eess'
import { notExistCondition } from '@nielspeter/eess/internal'
import type { MdDocument } from '../model/document.js'
import { mdViolation } from '../model/violation.js'

/** Where an md element is, and what to call it in a finding. */
export interface MdLocation {
  readonly doc: MdDocument
  readonly line: number
  readonly name: string
}

/**
 * `notExist()` for any md element, reported at its own line under the name
 * `locate` gives (plan 0456). A document is named by its `relPath` at line 1;
 * every other element `relPath:line` at its own line.
 */
export function mdNotExist<T>(locate: (e: T) => MdLocation): Condition<T> {
  return notExistCondition<T>({
    name: (e) => locate(e).name,
    toViolation: (e, message, context) => {
      const { doc, line, name } = locate(e)
      return mdViolation({ element: name, file: doc.file, line, message, context })
    },
  })
}

/** The location of an element that sits on one line of its document. */
export const atLine = (e: { readonly doc: MdDocument; readonly line: number }): MdLocation => ({
  doc: e.doc,
  line: e.line,
  name: `${e.doc.relPath}:${String(e.line)}`,
})
