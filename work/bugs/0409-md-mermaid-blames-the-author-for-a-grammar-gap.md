# Bug 0409: md-mermaid blames the author for a gap in eess-mermaid's grammar

## Status

- **State:** Draft — measured 2026-10-12 against this repository's build at `9765605`, with `mermaid`
  11.17.2 as the reference parser. No red test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism (`BUGS.md`'s
  Medium row), and a wrong remedy (ADR-009 rule 2), not a false green: the build is red when it
  should be. The code states the principle itself — "blaming the author's syntax for a grammar gap
  is the wrong attribution" (`packages/crossvalidate/src/md-mermaid.ts:36-38`) — but its mechanism
  covers one diagram header and no construct inside a diagram. So the finding tells the author their
  valid diagram has a syntax error, and the cheapest path to green is removing a correct construct.
- **Origin:** self-found · architect and enforcement review of
  [proposal 006](../proposals/006-mermaid-beyond-classdiagram.md)'s Ask C, 2026-10-12 — Ask C and
  that review are in PR #199, not yet on `main`.
- **Reported:** 2026-10-12

## Symptom

`embeddedDiagramsMatchCode` reports a `classDiagram` fence that eess-mermaid's grammar rejects as
`embedded classDiagram does not parse as a Mermaid class diagram: …`, with the suggestion "Fix the
diagram syntax so it parses as a Mermaid class diagram. If this fence is a diagram kind
eess-mermaid does not model, report it rather than deleting the fence"
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
`JobSchedule o{--o{ Bonus`, is accepted by `mermaid.parse()` (`{"diagramType":"er"}`). Whether it is
"standard" is disputed rather than false: Mermaid's documented cardinality table lists `o{` only on
the right-hand side, and the fixture labels itself "non-standard cardinality", so the parser is
looser than the docs. That is the same question proposal 006's review held Ask C on — which parser
owns syntax — and this record does not settle it. What holds either way: a fence Mermaid's parser
accepts and renders is not fixed by "fix the syntax". The test over that fixture
(`packages/crossvalidate/tests/md-mermaid-er.test.ts:80-84`) asserts the current message.

## Reproduction

With `mermaid` and `jsdom` installed outside the repository and a `jsdom` window on `globalThis`
before `mermaid` is imported, call `await mermaid.parse(text)` and
`diagram(text)` from `@nielspeter/eess-mermaid` on each fence below; for the ER case, parse the
fence in `bad-unparseable.md`.

```text
classDiagram\n  class A\n  class B\n  A --> B
classDiagram\n  direction RL\n  class A\n  class B\n  A --> B
classDiagram\n  class Box~T~\n  class B\n  Box --> B
classDiagram\n  namespace N {\n    class A\n  }
classDiagram\n  class A\n  note for A "a note"
classDiagram\n  class A\n  style A fill:#f9f
classDiagram-v2\n  class A\n  class B\n  A --> B
classDiagram\n  class A; class B
```

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

These hold whichever direction the fix takes.

- [ ] Red test first, through `embeddedDiagramsMatchCode`: for a `classDiagram` fence Mermaid accepts
      (`direction RL`), neither the message nor the suggestion asserts a syntax error in the
      document, and the suggestion removes no valid content — exact-string assertions
- [ ] a fence both parsers reject (`class A; class B`) is still reported
- [ ] the ER binding's message no longer asserts what "standard Mermaid ER syntax" accepts for a
      fence Mermaid's parser accepts; its test (`md-mermaid-er.test.ts:80-84`) is either kept on a
      fence Mermaid's parser rejects, or rewritten to the new wording on purpose
- [ ] `npm run validate` green.

Deferred: none.
