import { ErDiagramGrammarGeneratedModule } from './generated/module.js'
import type { ErDiagram } from './generated/ast.js'
import { MermaidUnitParseError } from './parse-class-diagram.js'
import { grammarServices } from './langium-services.js'

/** Parse a Mermaid `erDiagram` source into the generated AST (plan 0069 Phase 3). */
export function parseErDiagram(text: string): ErDiagram {
  const services = grammarServices(ErDiagramGrammarGeneratedModule)
  const result = services.parser.LangiumParser.parse<ErDiagram>(text)
  const errors = [
    ...result.lexerErrors.map((e) => `lexer:${e.line}:${e.column} ${e.message}`),
    ...result.parserErrors.map((e) => `parser: ${e.message}`),
  ]
  if (errors.length > 0) {
    throw new MermaidUnitParseError(errors)
  }
  return result.value
}
