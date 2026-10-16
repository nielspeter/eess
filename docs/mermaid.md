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

## Does every Mermaid block parse?

`mermaidParser()` is **Mermaid's own parser**, the `mermaid` package GitHub renders with, for
eess-md's [`parseCodeBlocks`](/markdown#code-blocks-that-parse). It answers one question: does each
` ```mermaid ` block in your docs parse? It is not `parseClassDiagram`, which is eess's own grammar
and binds a class diagram to code.

```bash
npm i -D @nielspeter/eess-md @nielspeter/eess-mermaid mermaid@11 jsdom
```

```ts
import { corpus, parseCodeBlocks, codeBlocks } from '@nielspeter/eess-md'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'] }), {
  language: 'mermaid',
  parser: mermaidParser(),
})
codeBlocks(parsed).should().parse().check()
console.error(parsed.summary()) // "N mermaid blocks parsed with mermaid 11.17.2"
```

**What it costs.** `mermaid` and `jsdom` are optional peers, about 179 MB installed (`mermaid` is
83 MB, `jsdom` 8.3 MB, the rest their dependencies). Nothing loads them until `parse` runs, and
then only inside a worker thread, so the DOM globals Mermaid needs never reach your test process.
A worker's start-up is about half a second; spike 0411 parsed 39 blocks in 0.6 to 1 s, start-up
included.

**What it reports.** A block Mermaid accepts is valid. For one it rejects:

| the block                                                           | reported as                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| a syntax error                                                      | `invalid`, on the block's Markdown line                                       |
| a misspelt kind, or one not in core Mermaid (`zenuml`)              | `unrecognised`: check the spelling, or it needs a newer `mermaid` or a plugin |
| empty, or nothing but comments, directives or frontmatter           | `unrecognised`, saying which                                                  |
| frontmatter Mermaid cannot read: no closing `---`, or none after it | `invalid`, on the block's first line                                          |
| a `%%{` directive never closed                                      | `unrecognised`                                                                |

Everything else is the instrument, one finding that says no block was judged, naming its cause:
`mermaid` or `jsdom` not installed, or a dependency of theirs missing; a `mermaid` outside major
11, or a `package.json` with no readable version; a loader hook that loads a different `mermaid`
from the one installed; the worker exiting, or a parse running past the budget, each naming the
block it was on; and a throw from Mermaid that is not a syntax error. Each says how to clear it.

**The line.** Mermaid counts an error's line on the text it has preprocessed, not on your block.
eess-mermaid maps it back through frontmatter, directives and comments, using Mermaid 11.17.2's
own rules. On every run it first parses blocks of its own whose true line is known, and if a
newer `mermaid` stops agreeing with the map, that is the instrument, not a misplaced line. It
catches only a change in what those blocks hold.

**Limits, stated.**

- **A block with a `%%` comment after other text on any line claims no line.** Two of Mermaid's
  lexers (`flowchart`, `erDiagram`) count lines wrongly after one. The finding names the block and
  quotes the line Mermaid gave. This is conservative: it also withholds the line in kinds that
  count right, and for a `%%` inside a label.
- **It parses; it does not render.** Three things parse and fail at render: a `gantt` task dated
  `nonsense`, a `journey` step with a score that is not a number, and an unclosed `mindmap` root.
- **The canaries cover one kind per error shape.** `mermaidParser()` declares a broken
  `sequenceDiagram`, a broken `packet-beta` and a misspelt kind, which catch a `mermaid` that
  stopped throwing. A regression confined to another kind passes them.
- **A stub can still lie.** A parser that answers `valid` for everything except its own canaries
  passes; the canaries make a forged pass deliberate, not impossible.
- **No block, no parse.** When the corpus has no ` ```mermaid ` block, nothing is parsed, so a
  missing `mermaid` is not reported: the rule reports that it examined nothing, or, with
  `.expectEmpty()`, passes having judged nothing.

## Where it fits

- **On its own** — enforce naming and stereotype conventions on a diagram, and catch a malformed diagram before it's committed.
- **Bound to code** — pair a diagram with the TypeScript that implements it so either side drifting fails the build. That's the job of [`eess-crossvalidate`](/crossvalidate).

See the [package README](https://github.com/NielsPeter/eess/tree/main/packages/mermaid) for the full DSL surface.
