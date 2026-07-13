import {
  EmptyFileSystem,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
} from 'langium'
import {
  ErDiagramGrammarGeneratedModule,
  MermaidUnitGeneratedSharedModule,
} from './generated/module.js'
import type { ErDiagram } from './generated/ast.js'
import { MermaidUnitParseError } from './parse-class-diagram.js'

let cachedServices: LangiumCoreServices | undefined

function getServices(): LangiumCoreServices {
  if (cachedServices) return cachedServices
  const shared: LangiumSharedCoreServices = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    MermaidUnitGeneratedSharedModule,
  )
  const services: LangiumCoreServices = inject(
    createDefaultCoreModule({ shared }),
    ErDiagramGrammarGeneratedModule,
  )
  shared.ServiceRegistry.register(services)
  cachedServices = services
  return services
}

/** Parse a Mermaid `erDiagram` source into the generated AST (plan 0069 Phase 3). */
export function parseErDiagram(text: string): ErDiagram {
  const services = getServices()
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
