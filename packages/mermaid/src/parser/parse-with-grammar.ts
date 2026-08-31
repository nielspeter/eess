import type { AstNode, LangiumCoreServices, LangiumGeneratedCoreServices, Module } from 'langium'
import { grammarServices } from './langium-services.js'

export class MermaidUnitParseError extends Error {
  constructor(public readonly errors: readonly string[]) {
    super(`MermaidUnit parse failed:\n${errors.join('\n')}`)
    this.name = 'MermaidUnitParseError'
  }
}

/**
 * Parse one Mermaid source against one grammar, or throw with every diagnostic.
 *
 * `parseClassDiagram` and `parseErDiagram` were the same body but for the
 * grammar module and the AST type — `no-copy-paste` reported them at 100%,
 * one level above the service container `langium-services.ts` already unified.
 *
 * It throws rather than returning a result, and collects BOTH lexer and parser
 * errors before doing so: Langium reports a malformed diagram as a lexer error
 * on one line and a parser error on another, and a parser that surfaced only
 * the first would send an author to fix the symptom. The line/column prefix on
 * the lexer half is what makes the message locatable at all — the parser half
 * carries no position, which is why the two are formatted differently rather
 * than uniformly.
 */
export function parseWithGrammar<T extends AstNode>(
  generatedModule: Module<LangiumCoreServices, LangiumGeneratedCoreServices>,
  text: string,
): T {
  const services = grammarServices(generatedModule)
  const result = services.parser.LangiumParser.parse<T>(text)
  const errors = [
    ...result.lexerErrors.map((e) => `lexer:${e.line}:${e.column} ${e.message}`),
    ...result.parserErrors.map((e) => `parser: ${e.message}`),
  ]
  if (errors.length > 0) {
    throw new MermaidUnitParseError(errors)
  }
  return result.value
}
