# @nielspeter/eess-mermaid

Architecture testing for **Mermaid class diagrams** — the Mermaid dialect of the [eess](../../README.md) family. _Specifications you can run._

Formerly published as `@nielspeter/mermaidunit`. Runs on the shared [`@nielspeter/eess`](../core) kernel, so it speaks the same fluent DSL as the other dialects.

## Install

```bash
npm install -D @nielspeter/eess-mermaid
```

## Example

Parse a Mermaid class diagram and assert structural rules over its classes, stereotypes, and relationships:

```typescript
import { diagram, classes } from '@nielspeter/eess-mermaid'

const d = diagram('docs/architecture.mmd')

classes(d).that().haveStereotype('repository').should().haveNameEndingWith('Repository').check()
```

The diagram is validated for internal consistency (valid class references, stereotypes, relationships) via the Langium grammar. Cross-validation against TypeScript code — binding a diagram to its implementation so either side drifting fails the build — is [plan 0059](../../plans/0059-cross-validation-eess-crossvalidate.md).

## License

MIT
