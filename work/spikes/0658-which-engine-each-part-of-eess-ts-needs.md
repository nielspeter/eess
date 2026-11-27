# Spike 0658: which engine each part of eess-ts needs

Measured 2026-11-26, at the maintainer's request, after a session that asked whether eess could be
made faster by a Rust port, by Bun, or by replacing ts-morph. Time-boxed to about an hour. It brings
back a recommendation for the maintainer to rule on, not a decision. Node 24.22.0, Linux, 12 cores,
at `main` cbc8eed2, after `npm install` and `npm run build`. Every timing is one run.

## The question

1. Where does an `eess-ts check` spend its time today?
2. How much of ts-morph does eess-ts use, and which parts of eess-ts need a type checker at all?
3. What does a Rust parser cost for the part that needs none?

## What the repository already decides

- ts-morph is the one AST and type engine ([ADR-002](../../adr/002-ts-morph-ast-engine.md)).
- [ADR-007](../../adr/007-isolate-ast-engine-boundary.md), Proposed with its confinement
  `pending`, says ts-morph goes behind one engine module with a batch-first boundary, so the engine
  can be swapped. It rejects maintaining a second engine before a real target exists.
- [Proposal 010](../proposals/010-ts-performance-at-scale.md) measured project construction and
  the checker build as the cost at scale. Its ask C (the unused-exports index) is `Held`, and its
  ask F (a native engine) was rejected in that lane, with re-entry named as an
  [ADR-007](../../adr/007-isolate-ast-engine-boundary.md) signal firing.
- [Spike 0366](./0366-where-validate-spends-its-time.md) measured `check:arch` at 7.7 s on another
  machine on 2026-09-29. The figure below is this machine's and is not compared with it.

## Measured

### 1. Where one check spends its time

`eess-ts check arch.rules.ts arch.internal.rules.ts`, 41 rules, under `node --cpu-prof`: 18.8 s
sampled, 19.0 s wall, 1.1 GB peak. Read with a throwaway script that is not kept.

| where                                                   | time   | share |
| ------------------------------------------------------- | ------ | ----- |
| `eess/no-unused-exports`, inside `hasExternalReference` | 12.9 s | 68%   |
| body-analysis rules, inside `findMatchesInNode`         | 2.5 s  | 13%   |
| loading the projects (`workspace` and `project`)        | 1.3 s  | 7%    |
| the rest                                                | 2.1 s  | 12%   |

By owner of the sampled function: the TypeScript compiler 75%, ts-morph 13%, eess-ts 1.8%, the
kernel 0.1%. The unused-exports rule is declared at `arch.internal.rules.ts:153` and asks the
language service once per export at `packages/ts/src/conditions/reverse-dependency.ts:336`.

The same check without the profiler: 17.3 s under Node, 17.6 s under Bun 1.4.3. A
`bun build --compile --bytecode` binary of the CLI starts in 0.02 s against 0.21 s under Node, is
117 MB, and cannot run a check: the rule file's import of `@nielspeter/eess-ts` does not resolve
from inside it. [Spike 0438](./0438-what-the-family-does-under-bun.md) found the same parity on
smaller calls.

### 2. How much of ts-morph eess-ts uses

Every property access in `packages/ts/src` (145 files), resolved to its ts-morph declaration by a
throwaway script that is not kept:

| measure                          | used  | ts-morph declares |
| -------------------------------- | ----- | ----------------- |
| members (methods and properties) | 242   | 2,915             |
| syntax kinds                     | 51    | 396               |
| call sites                       | 1,020 |                   |

A member reached without a property access is not counted, so 242 is a lower bound.

### 3. Which parts need which engine

`node scripts/measure-engine-needs.mjs`, committed with this record, 6.4 s. For each callable
eess-ts publishes (285 exported functions and constants, and 680 public methods of exported
classes), it follows the references made inside `packages/ts/src` and collects the ts-morph members
that can be reached. Each member is one of four classes: **syntax** (the tree alone answers it),
**binding** (a name is resolved to its declaration), **types** (the checker computes a type) and
**references** (the language service searches the project).

| published callables, by what they can reach | count | share |
| ------------------------------------------- | ----- | ----- |
| syntax only                                 | 835   | 87%   |
| binding, and neither types nor references   | 64    | 7%    |
| types                                       | 63    | 7%    |
| references                                  | 3     | 0.3%  |

The same walk over the four dogfood rule files, one row per rule chain:

| rule file                | chains | syntax only | binding | types | references |
| ------------------------ | ------ | ----------- | ------- | ----- | ---------- |
| `arch.rules.ts`          | 20     | 4           | 16      | 0     | 0          |
| `arch.internal.rules.ts` | 19     | 14          | 5       | 0     | 1          |
| `family.rules.ts`        | 1      | 1           | 0       | 0     | 0          |
| `spec.rules.ts`          | 4      | 4           | 0       | 0     | 0          |
| all                      | 44     | 23          | 21      | 0     | 1          |

The 21 chains that need binding reach it at three places:

- 17 through `packages/ts/src/core/module-edges.ts:421`, which resolves an import's specifier to
  the file it names. This is the import graph.
- 3 through `packages/ts/src/helpers/global-binding.ts:82`, which asks whether a name such as
  `eval` or `process` is the global or a local that shadows it.
- 1, `eess/no-unused-exports`, which also needs references.

Across the whole package the non-syntax surface is 9 binding members at 38 sites, 19 type members
at 92 sites, and 2 reference members at 2 sites.

**How far to trust the census.**

- It over-approximates in three ways: a reference to a function counts as a call, a method name in
  a rule file reaches every published method of that name, and a member called through an
  interface is followed once the code that builds its object is reachable.
- It under-approximates in one: a call through an interface declared outside `packages/ts/src`
  (the kernel's `Condition.evaluate`) is followed only from the function that built the object.
- Controls, read from its output: `haveReturnType` and `acceptParameterOfType` reach types,
  `haveNoUnusedExports` reaches references, `dependOn` and `beImported` reach binding,
  `resideInFolder`, `noMagicNumbers` and `project` reach none.
- The CLI reports 41 rules for the first two files where this counts 39 chains. The two it misses
  were not traced.
- No dogfood rule uses a type predicate, so the dogfood says nothing about the types class.

### 4. What a Rust parser costs for the syntax and binding parts

`oxc-parser` 0.160.0 and `oxc-resolver` 11.24.2 through their Node bindings, against ts-morph, over
the 338 source files of `packages/*/src`, by a throwaway script that is not kept:

| step                                    | ts-morph | oxc    |
| --------------------------------------- | -------- | ------ |
| load and parse                          | 2,296 ms | 71 ms  |
| walk every node, count call expressions | 262 ms   | 91 ms  |
| resolve imports to project files        | 572 ms   | 6 ms   |
| whole process                           | 3.37 s   | 0.21 s |
| peak memory                             | 1,067 MB | 194 MB |

- The load is not like for like: ts-morph also parses the standard library and dependency
  declarations, and the script built six projects where eess's own `workspace()` took 1.3 s above.
- The import rows count different edges (the oxc figure includes re-exports), so the times compare
  and the counts do not.
- The trees agree closely: 9,624 call expressions under oxc, 9,629 under ts-morph. The five were
  not traced.
- oxc emits an ESTree-shaped tree, not TypeScript's node kinds. It computes no types.

## What the measurement adds

1. **Today's cost is one rule, and it is not an engine problem.** 68% of `check:arch` is the
   per-export reference search that ask C of
   [proposal 010](../proposals/010-ts-performance-at-scale.md) replaces with an index.
2. **Neither the runtime nor threads are the lever.** Bun is at parity, and 75% of the time is
   inside a compiler whose program cannot be shared between workers.
3. **eess-ts separates into three tiers, and most of it is the cheapest one.** 87% of what it
   publishes needs the tree alone, a further 7% needs names resolved, and 7% needs types. No
   dogfood rule needs types.
4. **The middle tier is narrower than "the type checker".** On the dogfood it is two questions:
   which file an import names, and whether a name is a global.
5. **A parser-only engine is an order of magnitude cheaper to load here**, in time and in memory.

## Options

- **A. Keep ts-morph and build ask C only.** Removes most of today's `check:arch`. Leaves the load
  and checker cost [proposal 010](../proposals/010-ts-performance-at-scale.md) measured at scale,
  and leaves eess-ts pinned to the TypeScript version ts-morph supports.
- **B. A tiered engine behind [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s
  boundary.** The engine interface is cut along the three tiers. Syntax and binding are served by a
  parser and a resolver; the checker is built only when a rule reaches the types tier. This is a
  second engine, which [ADR-007](../../adr/007-isolate-ast-engine-boundary.md) rejected while no
  target existed; section 4 is the evidence that one now does for two of the three tiers.
- **C. Swap the whole engine for a native checker.** Not measured here. No stable programmatic API
  for the native TypeScript compiler was confirmed as shipped on the day of this spike, and the
  Rust checkers found were pre-1.0.

## Recommendation, for the maintainer's ruling

**A now, then B in two steps.**

1. Unhold ask C of [proposal 010](../proposals/010-ts-performance-at-scale.md) and review its
   corrected mechanism. It is independent of the engine and is the largest measured win.
2. Build [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s confinement with the interface
   cut into the three tiers this spike measured. Nothing about that step depends on a second engine
   existing.
3. Before any second engine is built, run one more spike: implement the syntax and binding tiers
   on a parser for a handful of dogfood rules and compare the findings with ts-morph's, rule by
   rule. A timing table is not evidence that the verdicts agree.

**Not decided here, and the maintainer's to decide:**

- **The public matcher API.** A user's `ExpressionMatcher` receives a ts-morph node and can call
  any of its members, not only the 242 eess-ts uses. A narrower node type breaks adopters' custom
  matchers; keeping ts-morph as a compatibility path keeps its cost for them.
- **A native dependency.** A Rust parser arrives as a per-platform binary. Whether eess-ts may
  depend on one, and what that means for a Bun claim under
  [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md), was not
  examined.
- **Which parser.** Only oxc was measured, at a 0.x version.
- **The global-binding question without a checker.** The reader at
  `packages/ts/src/helpers/global-binding.ts:82` treats a name with only ambient declarations as
  the global. What answers that without the declaration files loaded was not examined.

## Corrections

None yet.
