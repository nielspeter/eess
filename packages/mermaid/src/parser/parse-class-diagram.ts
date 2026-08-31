import { ClassDiagramGrammarGeneratedModule } from './generated/module.js'
import type { Diagram } from './generated/ast.js'
import { grammarServices } from './langium-services.js'

export class MermaidUnitParseError extends Error {
  constructor(public readonly errors: readonly string[]) {
    super(`MermaidUnit parse failed:\n${errors.join('\n')}`)
    this.name = 'MermaidUnitParseError'
  }
}

export function parseClassDiagram(text: string): Diagram {
  const services = grammarServices(ClassDiagramGrammarGeneratedModule)
  const result = services.parser.LangiumParser.parse<Diagram>(text)
  const errors = [
    ...result.lexerErrors.map((e) => `lexer:${e.line}:${e.column} ${e.message}`),
    ...result.parserErrors.map((e) => `parser: ${e.message}`),
  ]
  if (errors.length > 0) {
    throw new MermaidUnitParseError(errors)
  }
  return result.value
}
