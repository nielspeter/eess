# ADR-013: The kernel takes the fact, not the project

## Status

**Accepted** — 2026-08-31.

The second of the two decisions [plan 0188](../work/plans/0188-unify-the-duplicated-engine-modules.md)
says it "cannot settle by writing code". [ADR-012](./012-the-kernel-borrows-a-lexer-it-cannot-own.md)
settled the first.

## Context

`RuleBuilder` and `TerminalBuilder` exist twice — once in `packages/core`, once
in `packages/ts` — and the copies are 93–100% similar. They cannot be unified
while one of them names a type the kernel has no concept of: `ArchProject`.

Plan 0188 framed this as needing "a project abstraction for the kernel", and
warned that "giving it one constrains all five dialects forever". **Measured, the
coupling is far smaller than that framing implies.** Six references across the two
builders, and following each one to what it actually reads:

| reference                                                            | what it needs                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| `rule-builder.ts` — `import type`, constructor param, `getProject()` | pass-through; the builder stores it and hands it back |
| `terminal-builder.ts` — `import type`, `getProject()`                | same                                                  |
| `terminal-builder.ts` — `zeroSubjectsViolation(project)`             | the only real read                                    |

That last one reaches `empty-project-advice.ts`, and the **entire** `ArchProject`
surface it touches is two members:

```
project.getSourceFiles()   -> one question:  did this project load nothing?
project.tsConfigPath       -> one message:   name the config in the advice
```

One boolean and one string. That is not a project abstraction; it is two facts a
dialect already knows.

## Decision

**The kernel does not gain a project concept. It takes the facts.**

The zero-subject path accepts an optional description of the subject universe:

```ts
interface SubjectUniverse {
  /** Did the source of subjects yield nothing at all? */
  readonly isEmpty: boolean
  /** Why nothing can match, and what to do — the dialect's own words. */
  emptinessAdvice(): string
}
```

A dialect materialises it; the kernel reads it. `eess-ts` builds one from its
`ArchProject`, keeping `empty-project-advice.ts` and its tsconfig-specific
wording exactly where they are. A dialect with no such notion passes nothing and
gets the generic zero-subject advice, which is today's behaviour for the four
that never had a project.

**This is `PathUniverse`'s seam, applied a second time.** The kernel already
takes "every path a glob could legitimately match" as materialized data rather
than taking a project and walking it. The same shape answers this: the kernel
takes what it needs to _say_, not the thing it would have to _understand_.

## Alternatives rejected

**A `Project` interface in the kernel.** What plan 0188 anticipated. Rejected on
the measurement: a two-member interface named `Project` invites growth — the next
caller that wants a third member has a place to put it, and five dialects inherit
the constraint. Naming the fact instead of the source keeps the surface honest
about what it is.

**Structural duck-typing (`{ getSourceFiles(): unknown[] }`).** Smaller, and
still wrong: it makes the kernel's vocabulary "source files", which four dialects
do not have. `eess-md` has documents, `eess-gherkin` has scenarios. `isEmpty` is
true in all five.

**Leave the builders duplicated.** The status quo, and the reason this ADR
exists: it is how `fork()` cleared conditions in one copy for months (bug 0156),
how `setCallerAggregatesReports` went half-wired (bug 0163), and how a bare
`eess-exclude-start` stayed silent in `eess-ts` (bug 0227).

## Consequences

- `RuleBuilder` and `TerminalBuilder` can be unified, which is the six remaining
  cross-package `no-copy-paste` pairs this ADR unblocks.
- `eess-ts` keeps `ArchProject`, `getProject()` and its tsconfig-aware advice.
  Nothing about the TS dialect's own surface changes.
- The kernel gains a vocabulary word — `SubjectUniverse` — that four dialects can
  implement and none is forced to.
- A dialect that passes nothing gets weaker advice than `eess-ts` does. That is
  the honest position: the kernel cannot know why _your_ universe is empty, and
  inventing a reason is what ADR-008 rule 2 refuses.

## Enforcement

| Clause                                                                  | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status    |
| ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| The kernel names no project type                                        | 1    | `arch.internal.rules.ts` — the kernel's own rule file; a rule asserting no module under `packages/core/src` declares or imports a `Project`/`ArchProject` symbol. `check:integrity` already blocks the dependency half (no bare imports), but not a hand-rolled interface                                                                                                                                                                                                            | `pending` |
| `eess-ts` keeps its tsconfig-aware empty-project advice                 | 2    | `packages/ts/tests/core/empty-project-advice.test.ts` runs unchanged against the unified builders                                                                                                                                                                                                                                                                                                                                                                                    | `pending` |
| A dialect that supplies no universe still gets zero-subject advice      | 2    | `packages/core/tests/` — the kernel's existing zero-subject tests call the builders with no universe, so they already assert this path; the parameter is additive                                                                                                                                                                                                                                                                                                                    | `pending` |
| Exactly one `RuleBuilder` and one `TerminalBuilder` exist in the family | 1    | `check:guardrails` — `no-copy-paste` reports six cross-package pairs today — the two builders' select, addPredicate, buildConditionContext and excluding methods, plus declaredGlobsOf and viewsFor. Them disappearing from that report is the observable. (Written without backticked dotted names on purpose: the ADR gate reads a backticked token containing a dot as a file path, which CLAUDE.md records catching once already.) `warn`, not `gated`: the rule ships `.warn()` | `pending` |
| The kernel gains no dependency in the process                           | 1    | `check:integrity`'s phantom-dependency check: `@nielspeter/eess` declares no dependencies, so any bare import in its `src/` fails                                                                                                                                                                                                                                                                                                                                                    | `gated`   |
