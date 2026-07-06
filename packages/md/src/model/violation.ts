import { generateCodeFrame, type ArchViolation, type ArchFix } from '@nielspeter/eess'

// `ArchViolation` is the kernel's central data type; re-exported so the dialect's
// conditions can build one. `mdViolation` is the Markdown dialect's
// element→violation adapter.
export type { ArchViolation }

/**
 * Build an `ArchViolation` for a markdown-corpus finding. `sourceText` (the
 * document text) yields a code frame around `line` when provided. `fix` attaches
 * a deterministic autofix (plan 0066) when the repair is unique.
 */
export function mdViolation(args: {
  element: string
  file: string
  line: number
  message: string
  sourceText?: string
  fix?: ArchFix
  context: {
    rule: string
    because?: string
    suggestion?: string
    ruleId?: string
    docs?: string
  }
}): ArchViolation {
  return {
    rule: args.context.rule,
    ruleId: args.context.ruleId,
    element: args.element,
    file: args.file,
    line: args.line,
    message: args.message,
    because: args.context.because,
    suggestion: args.context.suggestion,
    docs: args.context.docs,
    fix: args.fix,
    codeFrame:
      args.sourceText !== undefined ? generateCodeFrame(args.sourceText, args.line) : undefined,
  }
}
