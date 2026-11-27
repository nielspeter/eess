# Proposal 029 — ts: rules are judged on facts, and the project loads only when a rule needs it

**State:** Draft — filed 2026-11-27 at the maintainer's request, from two days of measurement and a
working prototype on a local, unpushed branch; rewritten the same day to state how the prototype
works. Surveyed and measured; not reviewed. The prototype's code is not part of this record: what
is written here is meant to be enough to judge the design and to build it again.
**Priority:** Medium — a green run means the same after this. What changes is how long it takes,
which decides whether the gates run in an agent's edit loop or only before a commit.
**Origin:** self-found · the maintainer, 2026-11-26: the gates are too slow, and any rewrite that
makes them fast is acceptable.
**Affects:** `@nielspeter/eess-ts`: the project loader, the module edges, the body conditions and
matchers, `haveNoUnusedExports`, and the `ExpressionMatcher` a caller writes. Adds a native
component the package does not have today.

## Problem

An `eess-ts check` builds a full, type-checked model of the project and asks it one question at a
time. Most rules need none of it.

- [Spike 0658](../spikes/0658-which-engine-each-part-of-eess-ts-needs.md) found 87% of what eess-ts
  publishes needs the syntax tree alone and 7% needs types. No dogfood rule uses a type.
- Of one profiled `check:arch`, 75% of the time was inside the TypeScript compiler, 13% in ts-morph
  and under 2% in eess-ts.
- [Proposal 010](./010-ts-performance-at-scale.md) measured the same cost at an adopter's size:
  three seconds and close to a gigabyte before the first rule runs.

So the cost is not in the rules, and tuning them cannot remove it.

## Evidence

Measured 2026-11-26 and 2026-11-27 on this repository at `main` cbc8eed2 (Node 24.22.0, Linux,
12 cores). Every timing is one or two runs. The prototype's scripts and its reader are kept beside
the clone, not in this repository.

**1. A reader that prints facts, compared with the loaded project.** A program of about 350 lines
of Rust parses each file once and prints its imports and the sites the body rules look for.

| measure                                              | loaded project | facts                 |
| ---------------------------------------------------- | -------------- | --------------------- |
| read 1,147 files                                     | 1.2 to 1.6 s   | 0.01 to 0.03 s, 19 MB |
| six rules over 1,119 files, whole process            | 7.8 s          | 0.12 s                |
| eleven import-graph rules, whole process, in eess-ts | 1.73 s, 550 MB | 0.58 s, 235 MB        |

The six rules are no type assertions, no non-null assertions, no `eval`, no `console.log`, no
`process.env` and no dead modules. Their findings (202, 723, 6, 18, 28 and 715) match eess-ts's
own, one for one.

**2. The file list and the import edges can be reproduced exactly.** On three project sets (339,
1,187 and 257 files) the facts path gives the loaded project's file list and all 8,338 of its
`ModuleEdge` records, equal field by field.

**3. The import-graph conditions already run on it, inside eess-ts.** On the local branch a
project hands out files that know their path and their edges. A rule that asks a file for anything
else is run again, from the start, on the loaded project. Checked four ways:

- the JSON and terminal output of all four dogfood rule files is byte-identical between the two
  engines, and so is the output on a tree with four planted violating files (11 findings);
- all 13 architecture rows of `check:nonvacuity` fire;
- the eess-ts suite passes with the engine off, 3,984 of 3,984;
- forced on, 3,977 pass. The seven that fail are in two files that mock the process-spawn module
  or assert that a rule reads no directories.

**4. It does not yet move this repository's own check.**

| rule file                                                  | loaded project | facts engine |
| ---------------------------------------------------------- | -------------- | ------------ |
| `arch.rules.ts` (18 import-graph rules, 4 custom matchers) | 3.27 s         | 2.75 s       |
| `arch.rules.ts` and `arch.internal.rules.ts` together      | 7.87 s         | 7.84 s       |

One rule that needs the loaded project makes the whole run pay for loading it. The four custom
matchers visit every node of every file; the internal file is body rules and unused exports.

**5. Unused exports is the hard one.** From facts alone 1,231 of 2,327 exports are proved used,
never wrongly. A test for "unused" that asks only whether another file mentions the name was wrong
for 25 of 143, and 953 stay undecided.

**6. Two things the comparison turned up about the loaded project.** It resolves every specifier
as a CommonJS file would, in an ES module package too, and a workspace pulls in dependency files
for its first tsconfig only. The prototype copies both to stay identical.

## Existing code survey

- [ADR-002](../../adr/002-ts-morph-ast-engine.md) makes ts-morph the one engine and rules out a
  second parser.
- [ADR-007](../../adr/007-isolate-ast-engine-boundary.md), Proposed with its confinement `pending`,
  already says the engine goes behind one boundary that assumes a call is expensive. It rejects
  maintaining a second engine while no target exists.
- [Proposal 010](./010-ts-performance-at-scale.md)'s ask F, a native engine, was rejected in that
  lane, with re-entry named as an [ADR-007](../../adr/007-isolate-ast-engine-boundary.md) signal
  firing. Its ask C, the unused-exports index, is `Held`.
- [Spike 0417](../spikes/0417-which-engine-reads-python-for-eess-py.md) chose the same shape for
  [proposal 016](./016-eess-py-a-python-dialect.md): a reader in the language's own tooling prints
  facts as JSON, and the rules stay on the kernel.
- The conditions in `packages/ts/src/conditions/dependency.ts` and
  `packages/ts/src/conditions/reverse-dependency.ts` already judge `ModuleEdge` records, not the
  tree. That is why they ran on facts with no change to their own code.

## How the prototype works

Stated as rules, because each one was found by comparing with the loaded project and each is
needed for the outputs to be identical.

### What a fact is

Per file, plain data that can be printed as JSON:

- **Edges:** one per module specifier. Its kind (`import`, `reexport`, `dynamic`,
  `type-expression`, `require`), the specifier as written, the position of the specifier, the line
  of the statement that carries it, the names it binds as the target exports them, the names as
  `ModuleEdge.names` defines them, whether it is erased at compile time, and whether the `type`
  modifier sits on the statement itself.
- **Sites:** each call with the dotted name it calls and the name at the root of that chain, each
  member read the same way, each type assertion that is not `as const`, each non-null assertion,
  and every name the file declares. Each with its line.

A dotted name reads through `as`, `satisfies`, `!`, parentheses and optional chaining, takes the
last operand of a comma expression, reads a string-keyed bracket as a member, and drops leading
`globalThis`, `window`, `self` and `global`. That is `packages/ts/src/rules/security.ts`'s own
definition, restated.

### What counts as an edge

The reader lists what the compiler lists among a file's imports, no more:

- a specifier written as a string or as a template literal with no substitution;
- `require('x')` only in a JavaScript file, and `import x = require('x')` anywhere;
- inside `declare module 'name' { … }`: nothing static when the file is itself a module, and only
  non-relative specifiers when it is not. Dynamic imports and import types are listed wherever
  they are.

### Which files a project holds, and in what order

- The files the tsconfig lists, plus every file the **first** tsconfig's files import outside
  `node_modules`, transitively. A workspace adds the other tsconfigs' files as listed and follows
  nothing from them.
- A specifier is resolved by the TypeScript module resolver, with the first tsconfig's options and
  no resolution mode.
- The files are listed as the loaded project lists them: directories by depth, the entries of a
  directory by name under the comparer ts-morph uses. Getting this wrong changes no verdict and
  changes the order of every report.

### How a rule runs

- A project hands out files that answer five things: their path, their base name, their project,
  their own text read from disk, and their edges. The project itself answers its compiler options,
  read from the tsconfig, and its file list.
- **Inside a rule's evaluation, anything else is refused.** The refusal ends the evaluation, the
  project is loaded as it is today, and that rule is run again from the start. A rule is judged
  entirely on facts or entirely on the loaded project, never on both.
- Once a project has been loaded, every later rule runs on it. Its edges are still taken from the
  facts, by path, until a file is edited.
- **Handing the loaded project to a caller ends the facts engine for that project.** The caller may
  edit it, and facts describe the files on disk.
- The reader is run when the project is declared, so a missing reader or an unreadable tsconfig is
  reported there and not inside the first rule.

In the prototype the engine is switched on by an environment variable that names the reader, read
by the CLI alone, and is off otherwise.

## Proposed API

Four asks. Each can be accepted or refused without the others, and the order is the order they
would be built in. No rule file changes for A, B or C.

### Ask A — the engine and its reader (the import-graph rules)

The loader gives a rule facts first and the loaded project on demand, by the rules above. The
reader ships with the package as a native binary per platform.

```bash
eess-ts check arch.rules.ts                  # facts where a rule allows it
eess-ts check arch.rules.ts --engine loaded  # today's behaviour, for comparison
```

A run with no reader for its platform is today's run, and says so on its summary line.

### Ask B — the built-in matchers on facts

`call`, `access`, `newExpr`, `typeAssertion`, `nonNullAssertion` and the rules built from them,
judged on the sites the reader prints. Two things the prototype does not yet have:

- **Reach.** A site must say which function and which class it sits in, so the function and class
  forms judge the same code the module form does. The class forms' "all the code the class runs"
  is defined in `packages/ts/src/helpers/body-traversal.ts`.
- **Whether a name is the global.** `packages/ts/src/helpers/global-binding.ts` gives three
  answers: the name is that global, it provably is not, or it cannot be followed, and the third is
  reported as written. The reader must give the same three from the file's own scopes and imports.
  The prototype asks only whether the file declares the name anywhere, which matched on every
  finding here and is not the same question.

### Ask C — unused exports without the reference search

Three proofs of "used" hold on facts and are already measured as never wrong: another file binds
the name from this file; a file other than a barrel binds a re-exported declaration's own name
from the file that declares it; the declaring file uses a re-exported declaration itself. The
third needs a name resolved inside one file, and "unused" needs every other route excluded:
a namespace import, an `export *` chain, and a reference from a file outside the project's own
sources. Where facts cannot exclude them the rule keeps the loaded project. It never reports
"unused" from an absence it did not check.

### Ask D — what a caller's matcher receives

A caller's `ExpressionMatcher` receives a live ts-morph node and may call anything on it, so a rule
that uses one always needs the loaded project, and one such rule makes the whole run load it.

```ts
// today, in this repository's own arch.rules.ts
matches(node) {
  return node.getKindName() === 'RegularExpressionLiteral' && HTML_READ.test(node.getText())
}
```

Two ways out, and they are the open question: a narrower node that facts can back (a kind, its
text, its line, its children), which breaks every matcher written today; or the matcher keeps the
loaded project and its cost, and a rule file that wants to be fast keeps such rules in a file of
their own.

## Alternatives considered

- **Tune the loaded project.** Done for one rule on the same branch: `haveNoUnusedExports` now
  proves "used" from the import graph before it searches, and `check:arch` went from 17.3 s to
  7.8 s with no verdict changed. What is left there is 10 to 15% at a time.
- **Another runtime.** Bun 1.4.3 ran the same check in 17.6 s against Node's 17.3 s. A compiled
  binary starts in 0.02 s and cannot load a rule file.
- **Threads.** A program and its checker cannot be shared between workers, and one run already
  peaks at 1.1 GB.
- **Rewrite the rule engine in another language.** Under 2% of a run is eess-ts's own code, and
  rule files are TypeScript that adopters write.
- **Wait for a native TypeScript checker.** No stable programmatic API for one was confirmed as
  shipped on 2026-11-26. It would answer the 7% that needs types, which this proposal leaves on the
  loaded project.

## Acceptance criteria

- **Identical verdicts, by differential.** For every condition moved onto facts, the findings on
  this repository's sources and tests equal the loaded project's, one for one, with their messages
  and identities. A condition with a difference is not moved.
- **Break class (A):** a file importing a banned module is reported by a rule that ran on facts,
  for each edge kind: `import`, `export … from`, `import()`, `import('…').T` and `require`.
- **Break class (A):** a reader that is missing, fails or prints something else fails the run with
  a configuration finding. It never yields an empty project.
- **Break class (B):** a call to `eval` is reported, and a call to a local function named `eval` is
  not, in a file where the two differ.
- **Break class (C):** an export no file uses is reported. An export used only through a namespace
  import, only through an `export *` chain, or only from a built declaration file of another
  package is not, and each of the three is a fixture.
- **Break class (D):** a rule that uses a caller's matcher gives the loaded project's findings,
  whichever engine the run started on.
- **Break class (engine):** a file edited through the loaded project after the facts were read is
  judged as edited. The fixture adds an import in memory and requires the rule to report it.
- **Non-vacuity:** `check:nonvacuity`'s architecture rows fire with the engine on, and each row
  says which engine judged it.
- **A run says what it used.** The summary line states how many rules were judged on facts and how
  many loaded the project, so a run that silently loaded everything is visible.

## Open questions

1. **May eess-ts ship a native binary?** It is the family's first. What it means for a runtime
   claim under [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md)
   was not examined.
2. **May the engine call the TypeScript API directly?** The prototype reads tsconfig files and
   resolves specifiers through the `ts` object ts-morph re-exports, which
   [ADR-002](../../adr/002-ts-morph-ast-engine.md) says not to do.
3. **Is ask D a break or a cost?** It decides whether a rule file that mixes rule kinds can ever
   be fast.
4. **Is being identical to the loaded project the goal, where the loaded project is arguably
   wrong?** Evidence 6 names two cases.
5. **Three pinned lists changed on the local branch**, each to admit the new engine file: the
   functions allowed to call `JSON.parse`, the files holding a cast waiver, and the files allowed
   to call `localeCompare`. Each needs accepting or another way found.
6. **Which parser.** Only one was measured, at a 0.x version.

## Scope

- The 7% of eess-ts that needs types stays on the loaded project.
- No rule file changes for asks A, B and C.
- The other dialects are untouched. A reader for another language is its own proposal, as
  [proposal 016](./016-eess-py-a-python-dialect.md) is.
- The tuning of `haveNoUnusedExports` named under Alternatives is built and separate. It is the
  verdict-preserving half of [proposal 010](./010-ts-performance-at-scale.md)'s ask C and needs a
  home of its own.
