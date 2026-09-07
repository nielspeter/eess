# Mermaid dialect — `eess-mermaid`

Architecture testing for **Mermaid class diagrams** — the Mermaid dialect of the [eess](/) family. It runs on the same shared kernel as `eess-ts`, so it speaks the same fluent `.that().should().check()` DSL.

A class diagram in your repo is a specification of intended structure. `eess-mermaid` treats it as executable: parse the `.mmd`, then assert rules over its classes, stereotypes, and relationships — and the diagram itself is validated for internal consistency (valid class references, stereotypes, relationships) via a Langium grammar.

> Formerly published as `@nielspeter/mermaidunit`.

## Install

```bash
npm install -D @nielspeter/eess-mermaid
```

## Example

Parse a Mermaid class diagram and assert structural rules over its classes:

```typescript
import { diagram, classes } from '@nielspeter/eess-mermaid'

const d = diagram('docs/architecture.mmd')

// every class marked <<repository>> must be named ...Repository
classes(d).that().haveStereotype('repository').should().haveNameEndingWith('Repository').check()
```

Because it's the same kernel, the combinators (`not`, `and`, `or`) and the terminal `.check()` behave exactly as they do in `eess-ts` — the only thing that changes is the element type (Mermaid classes instead of TypeScript declarations).

## Running it from the CLI

The example above calls `.check()` at module scope, which is the shape for a test
file. The `eess-mermaid check` binary takes a **rule file** instead: a module
whose default export is an **array of un-terminated builders**, which the command
runs and reports once.

```typescript
// mermaid.rules.ts
import { diagram, classes } from '@nielspeter/eess-mermaid'

const d = diagram('docs/architecture.mmd')

export default [
  classes(d).should().haveStereotype('kernel').rule({
    id: 'diagram/kernel-stereotype',
    because: 'the architecture diagram depicts kernel classes only',
  }),
]
```

```bash
npx eess-mermaid check mermaid.rules.ts
```

Two shapes the command refuses, both unsuppressable, because each is a gate that
cannot fail:

- **A file that contributes no rules** — an empty array, or a default export that
  is neither an array nor a function returning one. A single un-arrayed builder
  is not accepted; wrap it: `export default [ builder ]`.
- **An entry that cannot report what it examined** — anything that is not a
  builder. It is named by its index and refused, rather than skipped: a silently
  dropped entry is a rule that stopped existing while the denominator still
  counted it.

A builder from this package's fluent API always satisfies both.

## Where it fits

- **On its own** — enforce naming and stereotype conventions on a diagram, and catch a malformed diagram before it's committed.
- **Bound to code** — pair a diagram with the TypeScript that implements it so either side drifting fails the build. That's the job of [`eess-crossvalidate`](/crossvalidate).

See the [package README](https://github.com/NielsPeter/eess/tree/main/packages/mermaid) for the full DSL surface.
