# Plan 0655: ts: the names in a project's files

## Status

- **State:** Draft — authored 2026-11-19, then rewritten the same day against its review by the
  architect, enforcement, method and product lenses ("Review, 2026-11-19" below).
- **Implements:** [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)
  (ask A2, its first part). This is the eess-ts extractor that
  [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) placed in eess-ts. The
  binding to eess-md and its preset are a later plan, after
  [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s rewrite gives eess-md the
  contract they produce.
- **Priority:** Medium. It is a building block, reporting nothing on its own; [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s
  High priority is carried by the rules built on it.
- **Effort:** Medium. An estimate of about four hours, not measured.
- **Created:** 2026-11-19
- **Decided, each overrulable:**
  - **An extractor, not a builder.** eess-ts gains `collectNames(project, filePaths)`, in its
    `collect*` family: `collectJsxElements(sourceFile)` and `collectFunctions(sourceFile)` are
    exported per-file extractors, and `calls()` is `getSourceFiles().flatMap(collectCalls)`
    (`packages/ts/src/builders/call-rule-builder.ts:83`). Two reasons, not a builder:
    - **Cost.** A builder's population is every file in the project. [Spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) measured that at
      4.1 s and 1,398 MB of heap here, against 0.13 s and 863 MB (almost all of it the projects'
      load) for the 149 covered files of the 170 the references cite. The binder knows the cited
      files and asks for them.
    - **No consumer for rules over names.** A `names(project)` builder can sit on top of this later,
      as `calls()` sits on `collectCalls`, when a consumer asks for one through a proposal.

    _This overrules [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s "selected by a builder"; the spike carries a dated correction._

  - **Paths in, plain data out.** It takes the project and the files' absolute paths and returns
    a map from each path to its names. A path the project does not hold is absent from the map,
    which is the coverage answer the binder needs. Neither side of the signature carries a
    ts-morph object, so it can be satisfied by one bulk call across any engine boundary
    ([ADR-007](../../adr/007-isolate-ast-engine-boundary.md) rule 2, input and output). This
    departs on purpose from the older `collect*(sourceFile)` signatures, which predate that ADR.
  - **The type is `CollectedName`, not `Arch*`.** `Arch*` is the family's prefix for element
    models that wrap a node behind getters (`ArchCall`, `ArchFunction`), and this is plain data.
    eess-md's planned `CodeName` is the binder's to map it to, never matched structurally.
  - **What it cannot read is reported, never dropped.** Each file's result lists the declarations
    it could not name (a string-literal or computed name), and says whether the file parsed
    without syntax errors. A binder then knows which files it cannot claim as fully covered.
  - **Releasing.** `collectNames` is a building block with a use of its own: a `defineCondition`
    over a project's names, shown in the README. So it may release before the binder. The line
    rule and the binder still release together, so eess-md's contract ships with a user. _This
    narrows [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s "release together" to those two, recorded in the spike and in
    [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s A2 row._

## Problem

[Plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s line rule judges a cited line against code facts: every declaration, import and use of a
name in a file, and for each declaration its end line, scope, container and attached doc comment.

- eess-md holds no parser ([proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md), from its first review).
- No eess-ts builder or extractor yields names, uses or doc spans.

[Spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s prototype, `scripts/measure-code-facts.mjs`, showed the facts can be produced from
eess-ts's own project. The four-lens review then measured how the prototype's definitions fall short
of a contract, and this plan settles them.

## Phase 1 — the extractor

```ts
// packages/ts/src/models/collected-name.ts
export type CollectedName =
  | {
      readonly kind: 'declaration'
      readonly name: string
      readonly line: number
      readonly end: number
      readonly scope: 'module' | 'member' | 'local'
      readonly container: string | null
      readonly doc: { readonly start: number; readonly end: number } | null
    }
  | { readonly kind: 'import' | 'use'; readonly name: string; readonly line: number }

export interface FileNames {
  readonly names: readonly CollectedName[]
  /** Declarations whose name is not an identifier: a string literal or a computed name. */
  readonly unnamed: readonly { readonly line: number; readonly text: string }[]
  /** The file had syntax errors (syntactic diagnostics only), so names after them may be missing. */
  readonly parseErrors: boolean
}

/** The names in each of `filePaths` the project holds; a path it does not hold is absent. */
export function collectNames(
  project: ArchProject,
  filePaths: readonly string[],
): ReadonlyMap<string, FileNames>
```

Lines are 1-based. A name is an `Identifier` or a `PrivateIdentifier` (`#x`, with its `#`), met by a
walk that does not enter JSDoc. So `{@link X}` is never a name, and neither is text in a comment or a
string.

**Kinds.**

- **Import:** the name in an import specifier, an import clause, a namespace import, an
  `import x =`, an export specifier, or `export * as ns`.
- **Declaration:** the name node of one of the declaration kinds in the table below.
- **Use:** every other name. That includes a reference, a member access's property, a type
  reference, a JSX attribute, and a shorthand property's name.

**Declarations**, per kind:

| declaration                                                                                                                     | `scope`                                               | is a container                                          | `end` is the end of    | its doc is attached to |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | ---------------------- | ---------------------- |
| a function, class, interface, type alias, enum, or namespace                                                                    | `module` if its statement is the file's, else `local` | yes, when it has an identifier name                     | the declaration        | the declaration        |
| a variable in a variable statement, by its identifier                                                                           | `module` if its statement is the file's, else `local` | yes                                                     | the variable statement | the variable statement |
| a destructured variable's binding element, in a variable statement                                                              | as its statement                                      | no: the walk continues upward                           | the variable statement | the variable statement |
| a variable with no variable statement (`for…of`, `for…in`, `for`, `catch`), and a binding element under it or under a parameter | `local`                                               | no                                                      | the declaration        | none                   |
| a class member (method, property, accessor)                                                                                     | `member`                                              | methods and accessors are; properties are not           | the member             | the member             |
| a class constructor                                                                                                             | `member`                                              | no: it has no name, and the walk continues to its class | the constructor        | the constructor        |
| a constructor parameter property (`private x`)                                                                                  | `member`, with its class as the container             | no                                                      | the parameter          | none                   |
| an interface or type-literal member, or an enum member                                                                          | `member`                                              | no                                                      | the member             | the member             |
| a declaration directly in a namespace body                                                                                      | `member`, with the namespace as the container         | as its kind                                             | as its kind            | as its kind            |
| an object-literal property, method or accessor                                                                                  | `local`                                               | methods and accessors are                               | the property           | none                   |
| a parameter, a type parameter                                                                                                   | `local`                                               | no                                                      | the declaration        | none                   |
| a named function or class expression                                                                                            | `local`                                               | yes                                                     | the expression         | none                   |

**Precedence.** A declaration directly in a namespace body takes that row's `scope` and
`container` over its kind's row; otherwise exactly one row applies.

**Any declaration the table does not name** is `local`, its `end` and doc owner the declaration
itself, and it is no container. A string-named module (`declare module 'x'`) is in `unnamed` and is
no container.

`container` is the name of the nearest enclosing declaration that is a container, or `null` at
module scope. A destructured variable never contributes its pattern text.

**The doc rule.** A declaration's doc is the last JSDoc block attached to its doc owner, as a
`{ start, end }` line span. It is `null` when there is none, and in two more cases:

- **When the block opens the file**, after any shebang, with only whitespace before it. Such a block
  documents the file, so it is never a doc. This fails closed: a doc it drops reds a correct
  citation of that comment (whose remedy is to cite the declaration's line). A header it kept would
  green a drifted one.
- **When the block is detached:** the doc owner's first token, its decorators and `export`
  included, is at least two lines below the last comment of the run of adjacent comments that holds
  the block. Comments of any kind count in the run. This is the TypeScript emitter's own rule for
  detached comments (`emitDetachedComments`), which measures from the run's last comment, not from
  the block. So a JSDoc followed directly by a `// eess-exclude …` line, then the declaration, keeps
  its doc: this repository's waiver pattern (`packages/core/src/stderr.ts:71`,
  `packages/ts/src/builders/cross-layer-builder.ts:142`), 25 docs here, measured by the architect
  lens at the re-check.

A block mid-file that sits directly above its declaration stays the doc, including after the
imports.

**Using it.** The cost is the walk of the files asked for. The project's load is the caller's.
Coverage is the caller's claim: the extractor answers for the text the project holds now. The map's
keys are the absolute paths as the project holds them; each input path is resolved first, so two
spellings of one file give one entry. `parseErrors` reads the program's syntactic diagnostics for
the file (`getProgram().getSyntacticDiagnostics(file)`, about 0 ms here).

## Files changed

- `packages/ts/src/models/collected-name.ts` (new)
- `packages/ts/src/index.ts` (`collectNames`, `CollectedName`, `FileNames`)
- an inline `// eess-exclude eess/no-unused-exports` at each new root export, the house waiver for
  [bug 0168](../bugs/0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md)'s
  known gap, if the build finds the rule flags them
- `packages/ts/tests/models/collected-name.test.ts` (new)
- `packages/ts/tests/fixtures/collected-names/` (new: `tsconfig.json` with `allowJs` and `jsx`, a
  `.ts`, a `.tsx` and a `.js` file)
- `scripts/measure-code-facts.mjs` (it calls `collectNames` after the reconciliation)
- `work/spikes/0651-where-the-typescript-code-facts-come-from.md` (corrections)
- `work/proposals/021-a-code-reference-points-at-the-code-it-names.md` and
  `work/proposals/PROPOSALS.md` (A2's row and its two plans)
- `packages/ts/README.md` and `docs/api-reference.md`, beside `collectJsxElements`
- `.changeset/` (`@nielspeter/eess-ts` minor)

## Test inventory

Each test drives the public root, `collectNames(project(fixtureTsconfig), paths)`, and asserts exact
values: the whole `CollectedName` for each name it names, with `toEqual`.

- [ ] **Each table row**, and the fallback, one fixture line per kind (a `for…of` variable, a
      `catch` binding and a constructor among them): `kind`, `line`, `end`, `scope`, `container`
      and `doc`, exactly. That includes an object-literal method (`local`), a type-literal member
      (`member`), a parameter property (`member` of its class), a namespace export (`member` of
      the namespace), and a top-level destructuring (`module`, `end` its statement, no pattern
      text as a container).
- [ ] **The doc rule, on both sides:**
  - two attached blocks: the last one's exact span;
  - a file-opening block above the first declaration, with no blank line: `null`;
  - a file-opening block, a blank line, then the declaration's own JSDoc: the own JSDoc;
  - a mid-file JSDoc, a blank line, then a declaration: `null` (detached);
  - a JSDoc, then a `// eess-exclude …` line, then the declaration: the doc (the run's last comment
    is the waiver line);
  - a JSDoc, then `// eslint-disable-next-line`, a blank line, then the declaration: `null`;
  - a mid-file JSDoc directly above, after the imports: the doc;
  - a decorator between the JSDoc and the name, with no blank line: the doc;
  - a `//` comment: never a doc.
- [ ] **Imports and uses:** each import form, and a call, a member access, a type reference, a JSX
      attribute and a shorthand property as `use`.
- [ ] **Not names:** `{@link X}`, a name in a comment, and a name in a string yield nothing.
- [ ] **`#private`** is named with its `#`.
- [ ] **What it cannot read:** a string-named member and a computed one are in `unnamed` with their
      line; a file with a syntax error has `parseErrors: true`.
- [ ] **A path the project does not hold** is absent from the map.
- [ ] **The `.tsx` and `.js` files** yield their names, asserted exactly.
- [ ] **The reconciliation, a recorded measurement, not a test,** run once before the script
      switches to `collectNames`:
  - both walks at one commit, over the six package projects;
  - the prototype's output transformed by this plan's table and doc rule, and equal to
    `collectNames`'s, fact for fact (`kind`, `name`, `line`, `end`, `scope`, `container`, `doc`),
    per file;
  - every difference from the untransformed prototype counted per category;
  - the classes of every reference the stock pattern reads at that commit, under
    [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s rule, before and after,
    with every change listed.

  The reviews' counts are the expected scale: 135 object-literal members, 1,027 pattern containers
  and 143 docs from the last block (at c03dc8fd); 55 docs dropped by the file-opening rule and 16 by
  the detached rule (at 5933e84c). None of them changes a verdict over the references the stock
  pattern read then (487); the doc rules' cost is latent, a future correct citation of a dropped
  comment. The result
  is recorded by value in this ledger and in [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s corrections. Afterwards the script calls
  `collectNames`, so the walk has one owner.

- [ ] **The sabotage matrix**, in a worktree with its own install, with a counter that reads vitest's
      "Tests" line. Each row names the test it must red, and a survivor is a finding:
  - the doc spans from the first block to the last;
  - the file-opening rule removed;
  - the detached rule removed;
  - the detached rule measured from the JSDoc block instead of the run's last comment;
  - `line` taken with leading trivia;
  - `end` narrowed to the name's line;
  - an object-literal method scoped `member`;
  - a binding pattern's text taken as a container;
  - `#private` names dropped;
  - the walk entering JSDoc;
  - an import specifier counted as a use;
  - an unnamed declaration dropped from `unnamed`;
  - a path the project does not hold mapped to an empty result;
  - `parseErrors` always `false`.

## Out of scope

- The binding to eess-md's `CodeFacts`, its preset, this repository's wiring and coverage of
  `scripts/`: the second A2 plan, after [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s rewrite. That plan owns the
  `check:nonvacuity` rows for a widened doc and for a walk entering JSDoc, since a gate first
  depends on these facts there.
- A `names(project)` builder: when a consumer asks for one, through a proposal.
- Judging a citation of a string-named member: the binder decides what an `unnamed` entry means.
- JSDoc type annotations in a `.js` file, which the walk does not enter: such a file's types are
  not names here.

## Review, 2026-11-19

The first draft was reviewed by the architect, enforcement, method and product lenses. Their full
reviews were written to the session's scratchpad and are not kept in the repository; what they
found is recorded here. All four held the draft; this rewrite answers them.

- **Critical, architect:** the reconciliation could not pass. The prototype differs from the
  draft's own definitions and from [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s contract in thousands of facts: object-literal
  members scoped `member`, pattern text as containers, undefined kinds. Answered by the per-kind
  table and a reconciliation of whole facts after the stated rules.
- **Critical, enforcement:** the prototype's doc spans from the first attached block to the last
  (141 declarations widened by 2,084 lines here), and nothing in the draft would catch an
  implementation that copied it. Answered by the last-block rule, exact doc spans, and a matrix row.
- **Important:**
  - [proposal 010](../proposals/010-ts-performance-at-scale.md)'s ask A is `Rejected`, not `Held` (architect), so the draft's reasoning and its
    out-of-scope home are corrected;
  - the draft overruled [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s builder without a correction (architect, method);
  - the precedent is the `collect*` family, and the name `collectNames` (architect, product);
  - [ADR-007](../../adr/007-isolate-ast-engine-boundary.md) applies to the input as well (architect);
  - the header rule is now testable, decided to fail closed, with fixtures on both sides
    (enforcement);
  - unreadable names are reported (enforcement);
  - the matrix is enumerated with targets (enforcement);
  - the release coupling, [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s A2 row and the plan's `Implements` line (method,
    product);
  - definitions written for a README (product).
- **Re-checked the same day** by the architect and enforcement lenses, at 5933e84c. Both
  criticals are closed. Folded in after the re-check:
  - the declarations the table left out (variables with no statement, constructors, string-named
    modules) and a fallback for any it does not name;
  - the detached rule restated as the emitter's, measured from the run's last comment, which keeps
    the repository's waiver pattern as a doc;
  - row precedence;
  - the map's keys;
  - the `parseErrors` call and a matrix row for it;
  - the measured scale (55 and 16 docs dropped, 0 verdicts changed);
  - object-literal members carry no doc.
- **Not taken:** keeping the export off the root (product's option), since eess-ts has no internal
  entry and the extractor has a use of its own.
