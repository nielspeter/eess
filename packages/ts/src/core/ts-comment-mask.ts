import path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'

/**
 * `eess-ts`'s comment masker, injected into the kernel's one exclusion-comment
 * parser (ADR-012).
 *
 * The kernel has no AST and cannot get one — it declares zero dependencies so
 * that `eess-md` does not inherit a TypeScript parser. Its default masker is a
 * regex scan, which is correct but coarse. This is the accurate version for
 * TypeScript, and it is all that ever justified `eess-ts` carrying a second copy
 * of the parser. Now only the masker is this package's; the parsing is not.
 *
 * The kernel composes: this runs first, its default runs over the output. So
 * this can only blank MORE than the default, never less.
 */
/**
 * Every string-like literal, blanked — [ts-archunit bug 0043](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0043-an-exclusion-directive-inside-a-string-literal-suppresses.md).
 *
 * The scan below is line-based, and a line-based scan cannot tell a directive
 * from the same characters inside a string. Measured before this existed: all
 * three of `"…"`, `'…'` and `` `…` `` containing the directive text produced a
 * **live exclusion** that silenced a real finding — silently, because a
 * directive carrying a reason never triggers the undocumented-exclusion warning.
 *
 * **Newlines are preserved**, and that is the load-bearing part: the scan below
 * is line-based and reports `line` on every exclusion, so a mask that dropped a
 * newline would misreport every directive after it.
 *
 * Characters are replaced with spaces rather than removed, which keeps
 * intra-line offsets stable too — but nothing downstream consumes a column, so
 * that half is defence in depth rather than a guarded property. Measured:
 * collapsing the blanks to `''`, and masking one character short, both leave the
 * suite green. Recorded rather than dressed up — a sabotage row that survives
 * for a real reason is a different thing from a missing guard.
 *
 * ## Why a parse, and not a scan
 *
 * The first attempt used `ts.createScanner`, which is the real lexer and fixed
 * the three plain cases. It left two: `` `${x} // …` `` and JSX text. A bare
 * scanner has no parser context, so it cannot know when to re-scan a template
 * middle or JSX children, and both were classified as code — meaning the `//`
 * inside them became a comment. Measured, not predicted.
 *
 * So: parse, and blank the literals. Everything remaining is code, where `//`
 * genuinely does start a comment.
 *
 * A **ts-morph** project rather than the raw compiler API, per
 * [ADR-002](../../../../adr/002-ts-morph-ast-engine.md), reusing one in-memory project
 * across calls so the cost is a parse rather than a project construction. The
 * whole scan is gated on a rule having already produced a violation in the file,
 * so nothing is parsed for a clean run.
 *
 * A `TemplateExpression` is blanked **whole**, including its `${…}`
 * substitutions. A comment is legal inside a substitution, so this can miss a
 * real directive there — it errs toward *not* suppressing, which is the safe
 * direction for a mechanism whose failure mode is a silent green.
 */
const LITERAL_KINDS = [
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.TemplateExpression,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.JsxText,
] as const

let scratch: Project | undefined

export function maskTsLiterals(sourceText: string, filePath: string): string {
  scratch ??= new Project({ useInMemoryFileSystem: true })
  // `.tsx` so JSX parses; a `.ts` parse reads `<div>` as a type assertion and
  // the JsxText case silently stops being covered.
  const sourceFile = scratch.createSourceFile(`/scan/${path.basename(filePath)}.tsx`, sourceText, {
    overwrite: true,
  })

  const out = sourceText.split('')
  for (const kind of LITERAL_KINDS) {
    for (const node of sourceFile.getDescendantsOfKind(kind)) {
      for (let i = node.getStart(); i < node.getEnd(); i++) {
        if (out[i] !== undefined && out[i] !== '\n') out[i] = ' '
      }
    }
  }
  const withoutLiteralText = out.join('')

  // Block comments too, and this is not tidying — it is the difference between
  // documenting the feature and invoking it.
  //
  // The grammar is `//`-only and always has been (a `/* … */` directive produced
  // no exclusion before this fix and still produces none). But a JSDoc block
  // that *mentions* the directive in prose puts the characters on a line, and
  // the line scan below cannot tell prose from a directive.
  //
  // Found the hard way: this very file's docstring explains the bug, contains
  // the directive text, and the moment comments started being read correctly it
  // declared a live exclusion against `preset/boundaries/no-cross-boundary` —
  // caught by this repo's own preset fan-out test. Any user writing a code
  // comment about the feature would hit the same thing.
  //
  // Safe to do with a regex here, and only here: every string, template and
  // regex literal has already been blanked, so a surviving `/*` is a real
  // block-comment start.
  return withoutLiteralText.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}
