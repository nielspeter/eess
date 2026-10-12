# Bug 0409: md-mermaid blames the author for a gap in eess-mermaid's grammar

## Status

- **State:** Draft — measured 2026-10-12 against this repository's build at `9765605`, with `mermaid`
  11.17.2 as the reference parser. No red test yet.
- **Severity:** Medium — a wrong remedy (ADR-009 rule 2), not a false green. The build is red when it
  should be, but the finding tells the author their diagram has a syntax error when the diagram is
  valid Mermaid that eess-mermaid's grammar does not model. Following the remedy means removing a
  correct construct from the document to satisfy the tool — an agent's cheapest path to green.
- **Origin:** self-found · architect and enforcement review of proposal 006, Ask C, 2026-10-12.
- **Reported:** 2026-10-12

## Symptom

`embeddedDiagramsMatchCode` reports a `classDiagram` fence that eess-mermaid's grammar rejects as
`embedded classDiagram does not parse as a Mermaid class diagram: …`, with the suggestion "Fix the
diagram syntax so it parses as a Mermaid class diagram"
(`packages/crossvalidate/src/md-mermaid.ts:136`, `:147`). The same constructs, measured against
Mermaid's own parser and against `diagram()` from `@nielspeter/eess-mermaid`, the parse md-mermaid
uses:

| Fence content                     | `mermaid.parse()` | eess-mermaid `diagram()` |
| --------------------------------- | ----------------- | ------------------------ |
| `class A` / `class B` / `A --> B` | accepts           | accepts                  |
| `direction RL`                    | accepts           | **rejects**              |
| a generic class, `class Box~T~`   | accepts           | **rejects**              |
| `namespace N { class A }`         | accepts           | **rejects**              |
| `style A fill:#f9f`               | accepts           | **rejects**              |
| `classDiagram-v2`                 | accepts           | **rejects**              |
| `note for A "a note"`             | accepts           | accepts                  |
| `class A; class B`                | rejects           | rejects                  |

Five valid constructs are reported as the author's syntax error. Only `classDiagram-v2` gets the
added clause "this is legal Mermaid that eess-mermaid does not model yet"
(`KNOWN_UNMODELLED`, `md-mermaid.ts:39`), and its suggestion still says to fix the syntax.

The ER binding has the same shape. `md-mermaid-er` reports a fence its parser rejects as
`erDiagram does not parse as standard Mermaid ER syntax: …` with "fix the syntax"
(`packages/crossvalidate/src/md-mermaid-er.ts:104-105`). This repository's own fixture for that
path, `packages/crossvalidate/tests/fixtures/table-er/bad-unparseable.md`, whose one relation is
`JobSchedule o{--o{ Bonus`, is accepted by `mermaid.parse()` (`{"diagramType":"er"}`), so the message's claim about
"standard Mermaid ER syntax" is false for the case it was written to test.

## Reproduction

With `mermaid` and `jsdom` installed outside the repository and a `jsdom` window on `globalThis`
before `mermaid` is imported, call `await mermaid.parse(text)` and
`diagram(text)` from `@nielspeter/eess-mermaid` on each row above; for the ER case, parse the fence
in `bad-unparseable.md`.

## Root cause

eess-mermaid parses with its own Langium grammars, which cover part of Mermaid's syntax. A fence the
grammar rejects is one of two things — a syntax error in the document, or valid Mermaid the grammar
does not cover — and without a reference parser md-mermaid cannot tell which. Its message asserts
the first. `KNOWN_UNMODELLED` lists one known gap by its header and covers no construct inside a
diagram.

## Fix

Not designed. Two directions, which do not exclude each other:

- **Without a reference parser:** say what eess knows — the fence is not readable by eess-mermaid's
  grammar, which may be a syntax error or Mermaid eess-mermaid does not model — and give a remedy for
  each, none of them removing valid content. The ER message stops claiming what "standard Mermaid"
  accepts.
- **With one:** proposal 006's Ask C (every Mermaid fence parses, by Mermaid's own parser) would let
  the two cases be told apart. Its review held it on, among other things, the rule for which parser
  owns `classDiagram` syntax; this bug is that rule's first consequence, and does not wait for it.

## Verification

- [ ] Red test first, through `embeddedDiagramsMatchCode`: a `classDiagram` fence using
      `direction RL`, valid Mermaid, does not tell the author to fix its syntax
- [ ] a fence with a real syntax error (`class A; class B`) is still reported, and its remedy still
      names the syntax
- [ ] the ER binding no longer claims a fence Mermaid accepts is not "standard Mermaid ER syntax"
- [ ] no remedy removes valid content from the document (ADR-009 rule 2)
- [ ] `npm run validate` green.

Deferred: none.
