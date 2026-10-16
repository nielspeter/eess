// A resolve hook that sends `mermaid` to a stub at another version. Loaded with `--import`, so the
// worker inherits it: the version mermaidParser() declares and the one its worker loads differ.
import { register } from 'node:module'

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier === 'mermaid') return { url: ${JSON.stringify(new URL('./stub-mermaid/index.mjs', import.meta.url).href)}, shortCircuit: true }
      return next(specifier, context)
    }`)}`,
)
