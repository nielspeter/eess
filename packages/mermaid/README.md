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

## Does every Mermaid block parse?

`mermaidParser()` is Mermaid's own parser (the `mermaid` package GitHub renders with) for
[`@nielspeter/eess-md`](https://www.npmjs.com/package/@nielspeter/eess-md)'s `parseCodeBlocks`. It
says whether a block parses; `parseClassDiagram` above is eess's own grammar, used to bind a
diagram to code.

```bash
npm i -D @nielspeter/eess-md mermaid@11 jsdom
```

```typescript
import { corpus, parseCodeBlocks, codeBlocks } from '@nielspeter/eess-md'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'] }), {
  language: 'mermaid',
  parser: mermaidParser(),
})
codeBlocks(parsed).should().parse().check()
```

`mermaid` and `jsdom` are optional peers, about 179 MB installed (`mermaid` 83 MB, `jsdom`
8.3 MB), and load only inside a worker thread, so your process never gets a DOM. What it reports,
and its limits (a block with a trailing `%%` comment claims no line; `parse` is not `render`; the
canaries cover one kind per error shape), are in the
[guide](https://github.com/nielspeter/eess/blob/main/docs/mermaid.md#does-every-mermaid-block-parse).

## License

MIT
