---
'@nielspeter/eess-crossvalidate': minor
---

Fix `embeddedDiagramsMatchCode()` aborting on any non-`classDiagram` mermaid fence, and give it non-vacuity evidence.

It selected fences by language alone and passed the body to `diagram()` — which only ever parses a class diagram — with no error handling. A single `sequenceDiagram`, `flowchart`, `graph`, `stateDiagram-v2` or `gantt` fence anywhere in the corpus threw out of the preset and abandoned every class diagram in it, including ones already validated.

Three changes. The error handling and the stats export follow the `md-mermaid-er` sibling; the **selection** deliberately does not — the sibling uses an allowlist and has the same fail-open hole, tracked as bug 0210.

- fences are selected on **content**, by excluding the diagram kinds that are known to be something else (`sequenceDiagram`, `flowchart`, `gantt`, …) rather than by requiring the `classDiagram` keyword. An allowlist would be fail-open — it drops whatever it fails to recognise, and a `%%{init}%%` theme directive ahead of the keyword is enough to do it. An unrecognised header still reaches the parser, so a new Mermaid diagram kind costs a loud finding, never silent coverage loss;
- a fence that _does_ declare `classDiagram` and still fails to parse now reports a violation against the markdown file and fence line instead of throwing;
- new `embeddedDiagramStats(corpus)` returns `{ documents, diagrams, skipped }` so a caller can tell "no drift" from "nothing examined" — the binding previously had no `examined` notion, so skipping foreign fences would otherwise have converted a loud crash into a silent green (ADR-010). Guard on it:

```ts
if (embeddedDiagramStats(corpus).diagrams === 0) throw new Error('examined zero diagrams')
```

**No fence that was previously compared is now skipped.** Everything the denylist excludes is a kind `diagram()` would have thrown on, so the only behaviour changes are crash → skip and crash → attributed violation; both strictly widen the set of corpora that work. Fences opening with a `%%` comment, an `%%{init}%%` directive (single- or multi-line) or a `---` frontmatter block are handled and remain in scope.

Note that this preset does **not** fail on an empty selection: a corpus with no class diagrams returns no violations. Guard on `embeddedDiagramStats` if a non-empty run is what you mean to assert.
