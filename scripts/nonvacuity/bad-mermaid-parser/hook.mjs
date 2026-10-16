// A resolve hook that sends `mermaid` to a stub at 11.99.0 (bad-mermaid-parser.mjs, loaded-not-declared).
import { register } from 'node:module'

const stub = new URL('./hook-stub/index.mjs', import.meta.url).href
register(
  `data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, next) {
    if (specifier === 'mermaid') return { url: ${JSON.stringify(stub)}, shortCircuit: true }
    return next(specifier, context)
  }`)}`,
)
