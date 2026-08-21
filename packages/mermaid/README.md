# @nielspeter/eess-mermaid

Architecture testing for **Mermaid class diagrams** — the Mermaid dialect of the [eess](https://github.com/nielspeter/eess/blob/main/README.md) family. _Specifications you can run._

Formerly published as `@nielspeter/mermaidunit`. Runs on the shared [`@nielspeter/eess`](https://www.npmjs.com/package/@nielspeter/eess) kernel, so it speaks the same fluent DSL as the other dialects.

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

The diagram is validated for internal consistency (valid class references, stereotypes, relationships) via the Langium grammar. Cross-validation against TypeScript code — binding a diagram to its implementation so either side drifting fails the build — ships as `diagramMatchesCode()` in [`@nielspeter/eess-crossvalidate`](https://www.npmjs.com/package/@nielspeter/eess-crossvalidate) (design history: [plan 0059](https://github.com/nielspeter/eess/blob/main/work/plans/completed/0059-cross-validation-eess-crossvalidate.md)).

## License

MIT
