import {
  EmptyFileSystem,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
  type LangiumGeneratedCoreServices,
  type Module,
} from 'langium'
import { MermaidUnitGeneratedSharedModule } from './generated/module.js'

/**
 * Langium services for one grammar, built once and cached.
 *
 * `parse-class-diagram.ts` and `parse-er-diagram.ts` each carried this, byte for
 * byte apart from the generated module they injected — `no-copy-paste` reported
 * it at 100%. The grammar is now the parameter, which is what it always was.
 *
 * The cache is per grammar module, not global: two grammars need two service
 * containers, and a single `cachedServices` shared between them would hand the
 * ER parser the class-diagram services (or the reverse) depending on which file
 * was imported first. That is the bug this shape has to avoid, so the cache is
 * keyed rather than a lone `let`.
 */
type GeneratedGrammarModule = Module<LangiumCoreServices, LangiumGeneratedCoreServices>

const cache = new WeakMap<GeneratedGrammarModule, LangiumCoreServices>()

export function grammarServices(generatedModule: GeneratedGrammarModule): LangiumCoreServices {
  const cached = cache.get(generatedModule)
  if (cached) return cached

  const shared: LangiumSharedCoreServices = inject(
    createDefaultSharedCoreModule(EmptyFileSystem),
    MermaidUnitGeneratedSharedModule,
  )
  const services: LangiumCoreServices = inject(createDefaultCoreModule({ shared }), generatedModule)
  shared.ServiceRegistry.register(services)
  cache.set(generatedModule, services)
  return services
}
