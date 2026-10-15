# Bug 0409: md-mermaid blames the author for a gap in eess-mermaid's grammar

## Status

- **State:** Fixed — 2026-10-15, in the PR that closes it, by the first direction below. Measured
  2026-10-12 against this repository's build at `9765605`, with `mermaid` 11.17.2 as the reference
  parser.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism (`BUGS.md`'s
  Medium row), and a wrong remedy (ADR-009 rule 2), not a false green: the build is red when it
  should be. The code states the principle itself — "blaming the author's syntax for a grammar gap
  is the wrong attribution" (`packages/crossvalidate/src/md-mermaid.ts:36-38`) — but its mechanism
  covers one diagram header and no construct inside a diagram. So the finding tells the author their
  valid diagram has a syntax error, and the cheapest path to green is removing a correct construct.
- **Origin:** self-found · architect and enforcement review of
  [proposal 006](../../proposals/006-mermaid-beyond-classdiagram.md)'s Ask C, 2026-10-12 — Ask C and
  that review are in PR #199, not yet on `main`.
- **Reported:** 2026-10-12

## Symptom

`embeddedDiagramsMatchCode` reports a `classDiagram` fence that eess-mermaid's grammar rejects as
`embedded classDiagram does not parse as a Mermaid class diagram: …`, with the suggestion "Fix the
diagram syntax so it parses as a Mermaid class diagram. If this fence is a diagram kind
eess-mermaid does not model, report it rather than deleting the fence"
(`packages/crossvalidate/src/md-mermaid.ts:104`, `:147`). The same constructs, measured against
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

The ER binding has the same shape. **Measured again 2026-10-15, once plan 0214 made `md-mermaid-er`
select an `erDiagram` behind `---` frontmatter:** eess-mermaid's `parseErDiagram` rejects the
frontmatter (`lexer:1:1 unexpected character: ->-<-`), which Mermaid accepts, and the finding says the
diagram "does not parse as standard Mermaid ER syntax". The same holds for a **multi-line**
`%%{init}%%` block ahead of `erDiagram` (found by PR #212's review: "found `\"theme\"`"); a one-line
init block parses. Fixtures:
`packages/crossvalidate/tests/fixtures/table-er/bad-frontmatter-extra-attribute.md` and
`…/bad-multiline-init-extra-attribute.md`. `md-mermaid-er` reports a fence its parser rejects as
`erDiagram does not parse as standard Mermaid ER syntax: …` with "fix the syntax"
(`packages/crossvalidate/src/md-mermaid-er.ts:111-112`). This repository's own fixture for that
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

**Decided 2026-10-15, from ADR-009 rule 2 and this record, overrulable: the first direction.** Until
plan 0413 gives eess Mermaid's own parser, eess cannot tell a syntax error from a construct
eess-mermaid does not model, so the finding says that and no more.

- **Message.** Both bindings now say the fence "does not parse with eess-mermaid's class-diagram
  grammar" (or "ER grammar"), give the parser's detail, and add: "This is either a syntax error in
  the document or valid Mermaid that eess-mermaid does not model yet; eess cannot tell which without
  Mermaid's own parser." The ER message no longer claims what "standard Mermaid ER syntax" accepts.
  The definite clause for `classDiagram-v2` (`KNOWN_UNMODELLED`) stays.
- **Remedy, one for both causes, removing nothing valid** (`grammarGapRemedy`): check the fence in the
  Mermaid Live Editor (`mermaid.parse` in Node needs a DOM, and fails without one, valid or not); if
  Mermaid reports a parse error, fix it; if Mermaid accepts it, keep it and report the construct at
  the eess issue tracker. The finding stays until eess-mermaid models the construct. To be green
  meanwhile, move only that fence into a document of its own and leave that document out, with the
  binding's own option, so the original document's other diagrams are still checked, and put it back
  once the construct is modelled.
  - _Corrected by PR #213's review:_ the first version pointed at `mermaid.parse` alone, which can
    reject valid Mermaid in Node and so lead to "fixing" a correct fence; and it said to leave out the
    whole document, which also stops checking its other diagrams (measured: a false green over a
    second fence's drift). Both are replaced above.
- **`classDiagram-v2`**, the one known gap, keeps its definite clause and gets its own fix: change the
  header to `classDiagram`.
- **The ER finding's remedy is its `suggestion`** (the fix line), and its `because` is a reason. The
  first version passed the remedy where `violationsFor` takes the reason, so it printed under "Why:"
  with no fix line (PR #213's review).
- **Not "waive it".** The first draft of this remedy said to waive the finding with an `eess-exclude`
  comment and a reason. A probe showed the comment does not silence this finding on either reporting
  path, so that remedy would not have worked. Recorded as
  [bug 0422](../0422-a-waiver-does-not-silence-an-md-mermaid-finding.md).
- The two strings live in `packages/crossvalidate/src/shared.ts`, so both bindings say the same
  thing.

The second direction, telling the two causes apart with Mermaid's own parser, is plan 0413's.

## Verification

- [x] Red test first, through `embeddedDiagramsMatchCode`: for a `classDiagram` fence Mermaid accepts
      (`direction RL`, `packages/crossvalidate/tests/fixtures/calc/docs/embedded-grammar-gap.md`),
      neither the message nor the suggestion asserts a syntax error in the document, and the
      suggestion removes no valid content. Exact-string assertions in
      `packages/crossvalidate/tests/md-mermaid.test.ts`; red before the change.
- [x] A fence both parsers reject (`class A; class B`, `embedded-both-reject.md`) is still reported.
- [x] The ER binding's message no longer asserts what "standard Mermaid ER syntax" accepts. Its test
      over `bad-unparseable.md` was rewritten to the new wording on purpose, since Mermaid's parser
      accepts that fixture.
- [x] `npm run validate` green on this branch.

Deferred: none
