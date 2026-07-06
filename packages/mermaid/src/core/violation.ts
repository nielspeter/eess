import { generateCodeFrame, type ArchViolation } from '@nielspeter/eess'

// `ArchViolation` is the kernel's central data type; re-exported so existing
// `import { ArchViolation } from '.../core/violation.js'` sites keep working.
// `createViolation` below is the Mermaid dialect's element→violation adapter.
export type { ArchViolation }

export function createViolation(
  fields: {
    element: string
    file: string
    line: number
    sourceText?: string
  },
  message: string,
  context: {
    rule: string
    because?: string
    suggestion?: string
    ruleId?: string
    docs?: string
  },
): ArchViolation {
  return {
    rule: context.rule,
    ruleId: context.ruleId,
    element: fields.element,
    file: fields.file,
    line: fields.line,
    message,
    because: context.because,
    suggestion: context.suggestion,
    docs: context.docs,
    codeFrame: fields.sourceText ? generateCodeFrame(fields.sourceText, fields.line) : undefined,
  }
}
