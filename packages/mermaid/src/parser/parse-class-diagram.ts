import {
  EmptyFileSystem,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
} from 'langium'
import {
  ClassDiagramGrammarGeneratedModule,
  MermaidUnitGeneratedSharedModule,
} from './generated/module.js'
import type { Diagram } from './generated/ast.js'

let cachedServices: LangiumCoreServices | undefined

function getServices(): LangiumCoreServices {
  if (cachedServices) return cachedServices
  const shared: LangiumSharedCoreServices = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    MermaidUnitGeneratedSharedModule,
  )
  const services: LangiumCoreServices = inject(
    createDefaultCoreModule({ shared }),
    ClassDiagramGrammarGeneratedModule,
  )
  shared.ServiceRegistry.register(services)
  cachedServices = services
  return services
}

export class MermaidUnitParseError extends Error {
  constructor(public readonly errors: readonly string[]) {
    super(`MermaidUnit parse failed:\n${errors.join('\n')}`)
    this.name = 'MermaidUnitParseError'
  }
}

export function parseClassDiagram(text: string): Diagram {
  const services = getServices()
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
