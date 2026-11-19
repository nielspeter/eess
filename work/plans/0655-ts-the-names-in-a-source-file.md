# Plan 0655: ts: the names in a source file

## Status

- **State:** Draft — authored 2026-11-19, the first of the two plans that own
  [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A2, as
  [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) decided: eess-ts walks,
  eess-crossvalidate binds. The binding and its preset are a later plan, after
  [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s rewrite gives eess-md the
  contract they produce.
- **Priority:** High, as [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md) is. It reports nothing on its own; it is the input the line
  rule needs.
- **Effort:** Small to medium. An estimate of about two hours, not measured. The walk is already
  written and measured in `scripts/measure-code-facts.mjs`.
- **Created:** 2026-11-19
- **Decided, each overrulable:**
  - **A per-file extractor, not a builder.** eess-ts gains `namesIn(file)`, which returns every name
    in one source file. It is exported from the eess-ts root, beside its other model constructor,
    `fromCallExpression` (`packages/ts/src/models/arch-call.ts:125`). It is not a `names(project)`
    builder, for three reasons:
    - **Cost.** A builder's population is every file in the project (`calls()` collects
      `this.project.getSourceFiles().flatMap(…)`, `packages/ts/src/builders/call-rule-builder.ts`).
      [Spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) measured that at 4.1 s and about 0.5 GB of facts here, against 0.13 s for the 149
      files the references cite.
    - **No shared mechanism yet.** The family's mechanism for walking only the files a rule's globs
      select is [proposal 010](../proposals/010-ts-performance-at-scale.md)'s ask A, which is
      `Held`. A builder bounded some other way would be a parallel mechanism.
    - **No consumer for a builder.** The binder knows the cited files and asks for them, file by
      file. A `names(project)` builder for rules over names can be built later over this extractor,
      when a consumer asks for one.
  - **Plain data, not a wrapped node.** `ArchName` carries precomputed fields only, with no handle
    on a ts-morph node. That is
    [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s batch-first direction (one call per
    file, a materialised result). It differs on purpose from `ArchCall`, which wraps its node.
  - **The input is a source file eess-ts already hands out**, as `ArchProject.getSourceFiles()`
    returns it (`packages/ts/src/core/project.ts:20`). The binder reaches it through eess-ts's
    public API and imports no ts-morph, as eess-crossvalidate does today.
  - **The shape is [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s `CodeName` less its `file`**, which the binder adds as a path in
    the corpus's form. eess-ts cannot import eess-md (`eess/ts-isolated`), so the two types are
    bound by the binder's real import of both, as [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) decided, never structurally.

## Problem

[Plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s line rule judges a cited line against code facts: every declaration, import and use of
a name in a file, and each declaration's end line, scope, container and attached doc comment.

- eess-md holds no parser, and never will ([proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md), from its first review).
- No eess-ts builder yields names, uses or doc spans. Its builders are `modules`, `classes`,
  `functions`, `types`, `calls` and `slices`.

[Spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md) showed the facts can be produced from eess-ts's own project, and that the rule built on
them reproduces every judged verdict. The walk is a prototype in
`scripts/measure-code-facts.mjs`. This plan makes it a public, tested part of eess-ts.

## Phase 1 — the model and the extractor

```ts
// packages/ts/src/models/arch-name.ts
export type ArchName =
  | {
      readonly kind: 'declaration'
      readonly name: string
      /** The 1-based line of the name itself; a decorator's line is not it. */
      readonly line: number
      /** The declaration's last line. */
      readonly end: number
      /** `module`: a top-level statement. `member`: a class, interface or enum member, never an
       * object-literal key. `local`: anything else (in a body, a parameter, an object key). */
      readonly scope: 'module' | 'member' | 'local'
      /** The nearest enclosing named declaration's name; `null` at module scope. */
      readonly container: string | null
      /** The JSDoc attached to it, ending before `line`; `null` when it has none. */
      readonly doc: { readonly start: number; readonly end: number } | null
    }
  | { readonly kind: 'import' | 'use'; readonly name: string; readonly line: number }

/** Every name in one source file, in source order: one walk, materialised. */
export function namesIn(file: SourceFile): readonly ArchName[]
```

The definitions, as [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s prototype used them:

- **A name** is an `Identifier` or a `PrivateIdentifier`, as the walk (`forEachDescendant`) meets
  it. That walk does not enter JSDoc, so `{@link X}` is never a name, and neither is text in a
  comment or a string.
- **A declaration** is the name node of a declaration. The list is the instrument's: functions,
  classes, interfaces, type aliases, enums and their members, variables, methods and method
  signatures, properties and property signatures, property assignments, accessors, modules,
  parameters, binding elements, type parameters, and named function and class expressions. Its
  `end` is the last line of the statement that holds it (a variable's statement).
- **An import** is the name in an import specifier, an import clause, a namespace import, an export
  specifier or an `import x =` declaration.
- **A use** is every other name: a reference, a member access's property name, a type reference,
  a JSX attribute, a shorthand property.
- **The doc** is the last JSDoc block the parser attaches to the declaration (to its statement for
  a variable). A file-header block attached to the first declaration is not its doc when a blank
  line separates them. ts-morph attaches such a header ([plan 0648](./completed/0648-md-a-code-reference-still-appears-in-its-file.md)'s review); the build measures
  how many declarations this rule changes.

## Files changed

- `packages/ts/src/models/arch-name.ts` (new)
- `packages/ts/src/index.ts` (`namesIn` and `ArchName`)
- `packages/ts/tests/models/arch-name.test.ts` (new)
- `packages/ts/tests/fixtures/names/` (new: a TypeScript file and a JavaScript file)
- `scripts/measure-code-facts.mjs` (it calls `namesIn`, so the measurement and the product cannot
  drift)
- `packages/ts/README.md`, and the eess-ts guide page that lists the model constructors
- `.changeset/` (`@nielspeter/eess-ts` minor)

## Test inventory

Each test runs through the public root, over a fixture file loaded by `project()`.

- [ ] **Each declaration kind** in the list yields one `declaration` with its line, `end`, `scope`
      and `container`. One fixture line per kind.
- [ ] **Scope.** A top-level function is `module`; a class method and an enum member are
      `member`; an object-literal key, a parameter and a function's local are `local`.
- [ ] **Container.** A method's is its class; a local's is its function; a module-scope name's is
      `null`.
- [ ] **Doc.** A JSDoc'd function's `doc` ends before its line. A file-header block separated by a
      blank line is not the first declaration's `doc`. A `//` comment is never a `doc`.
- [ ] **Imports and uses.** An import specifier, a namespace import and an export specifier are
      `import`. A call, a member access, a type reference and a JSX attribute are `use`.
- [ ] **Not names.** `{@link X}` in a JSDoc, a name in a comment, and a name in a string yield
      nothing.
- [ ] **A decorated declaration's line** is its name's line, not the decorator's.
- [ ] **A JavaScript file** (`allowJs`) yields its names as a TypeScript file does.
- [ ] **The reconciliation.** Over this repository's six package projects, `namesIn` gives the same
      names per file as [spike 0651](../spikes/0651-where-the-typescript-code-facts-come-from.md)'s walk, except where the doc rule changes a `doc`. Each such
      declaration is counted and listed. The script then calls `namesIn`, and its counts are
      re-stated.
- [ ] **The sabotage matrix**, in a worktree with its own install, with a counter that reads
      vitest's "Tests" line ([plan 0652](./completed/0652-the-empty-source-helper-moves-into-the-kernel.md)'s correction):
  - each kind's branch removed;
  - scope collapsed to one value;
  - `container` always `null`;
  - the doc taken from the leading trivia;
  - the walk entering JSDoc.

## Out of scope

- The binding to eess-md's `CodeFacts`, the preset, this repository's wiring, and coverage of
  `scripts/`: the second A2 plan, after [plan 0649](./0649-md-a-code-reference-resolves-at-its-lines.md)'s rewrite.
- A `names(project)` builder for rules over names, and walking only the files a rule's globs
  select: [proposal 010](../proposals/010-ts-performance-at-scale.md)'s ask A.
- Names beyond identifiers (string-keyed members, computed property names).
