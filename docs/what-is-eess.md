# What is eess?

_A five-minute, plain-language intro. For the full design read the
[manifesto](/manifesto); to watch it built step by step, follow the
[calculator walkthrough](/eess-walkthrough-calculator)._

## The problem: your docs lie (eventually)

You write an architecture decision: _"the domain layer must never import from the
database layer."_ Six months later someone adds a quick import to grab a type.
Then another. The decision record still says the rule; the code quietly breaks
it. Nobody notices — until an audit, or an outage.

This is **semantic drift**. Intent — architecture decisions, business rules,
workflows, constraints — lives in prose. Prose doesn't run. So the code slowly
becomes the _only_ source of truth: diagrams go stale, ADRs describe a system
that no longer exists, READMEs point at files that moved.

## The idea: make the spec runnable

eess flips that. A spec — a rule, an ADR, a diagram, a doc — becomes something
you can **execute against the code**. A validator confirms the two agree, and
**drift in either direction fails the build**.

That's the whole pitch: _specifications you can run_. Not prose that hopes to
stay true — a check that goes red the moment the code and the spec disagree.

## The smallest possible example

The decision _"domain must not import from infrastructure"_ becomes one rule:

```ts
modules(project('tsconfig.json'))
  .that()
  .resideInFolder('src/domain/**')
  .should()
  .notDependOn('src/infrastructure/**')
  .check()
```

Run it in CI. The day someone adds that import, the build fails — on the pull
request that introduces it, not eighteen months later in a manual review. The
decision and the code can no longer disagree in silence.

## "But not everything is a code rule"

True — and this is the honest part most tools skip. _"Payments must be
idempotent"_ is runtime behavior, not a static fact. _"We chose PostgreSQL"_ is a
rationale nothing should check. _"Error messages must be helpful"_ is judgment.

eess doesn't pretend everything is statically checkable. Instead it asks every
clause to declare **three things**:

- **Tier** — what _kind_ of fact it is: `1` static · `2` behavioral · `3`
  operational · `4` semantic (judgment) · `5` ratification (the choice itself).
- **Mechanism** — what actually checks it: an eess-ts rule, a contract test, a
  policy check, an LLM reviewer, or governance.
- **Status** — `gated` (enforced, blocks CI) · `pending` (decided, not green yet
  — honest debt) · `manual` · `n/a` · …

The gate fails on a **missing declaration**, not on low hardness. A Tier-5 _"we
chose PostgreSQL / mechanism: governance"_ clause passes; a clause with _no
tier_ fails. That single move turns "what is actually enforced here?" from a
guess into a queryable list — and the unenforced clauses are exactly the ones an
AI agent will silently optimize away.

`pending` is the quiet star. A rule can be correct, correctly Tier 1, and still
not gate today because the code doesn't satisfy it _yet_. You ship it as a
tracked, skipped rule — honest debt that ratchets green when the code catches up.
Marking it `gated` when it isn't would be a lie, and a lie is the thing eess
exists to prevent.

## The family: one kernel, several dialects

Different artifacts need different validators, so eess is a family on one shared
kernel:

| Dialect                | Validates                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **eess-ts**            | TypeScript source — imports, layers, forbidden calls, types (the flagship dialect)     |
| **eess-mermaid**       | Mermaid class diagrams still match the code                                            |
| **eess-md**            | your Markdown corpus — links resolve, `file:line` pointers hit real lines, ADRs honest |
| **eess-crossvalidate** | binds two dialects so drift in _either_ fails (e.g. diagram ↔ code)                    |

## It practices what it preaches

This repository validates _itself_ with these tools, in CI: the kernel diagram
matches the code, the ADRs cite tests that really exist, the README's package
table stays in sync with the workspace. If eess drifts from its own specs, its
own build fails. See [eess validates eess](/dogfooding).

## Where to next

- **[Getting Started](/getting-started)** — install eess-ts and write your first
  rule in five minutes.
- **[The calculator walkthrough](/eess-walkthrough-calculator)** — watch a
  project grow specs-first, from an empty directory.
- **[The manifesto](/manifesto)** — the full design: principles, architecture,
  enforcement tiers, executable ADRs.
